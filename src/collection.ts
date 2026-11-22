import type {
  Collection,
  Tasting,
  Flavour,
  Filters,
  MarketNames,
  Region,
  RegionProgress,
} from "./types.ts";

export const STORAGE_KEY = "pringles-map.collection.v1";
export const BACKUP_FORMAT = "pringles-map";
export const MAX_NOTE_LENGTH = 2000;
export const emptyEntry = (): Tasting => ({
  tasted: false,
  rating: 0,
  note: "",
});

function normalizeEntry(value: unknown): Tasting | null {
  const entry = value as Partial<Tasting> | null;
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  if (
    typeof entry.tasted !== "boolean" ||
    !Number.isInteger(entry.rating) ||
    typeof entry.rating !== "number" ||
    entry.rating < 0 ||
    entry.rating > 5 ||
    typeof entry.note !== "string" ||
    entry.note.length > MAX_NOTE_LENGTH
  )
    return null;
  return { tasted: entry.tasted, rating: entry.rating, note: entry.note };
}

export function validateEntries(
  entries: unknown,
  validIds: ReadonlySet<number>,
): Collection {
  if (!entries || typeof entries !== "object" || Array.isArray(entries))
    throw new Error("This backup has no valid collection entries.");
  const clean: Collection = {};
  for (const [id, entry] of Object.entries(entries)) {
    if (!validIds.has(Number(id)) || String(Number(id)) !== id) continue;
    const normalized = normalizeEntry(entry);
    if (!normalized)
      throw new Error(
        `The saved entry for flavour ${id} is invalid. Nothing was imported.`,
      );
    clean[id] = normalized;
  }
  return clean;
}

export function readCollection(
  storage: Pick<Storage, "getItem">,
  validIds: ReadonlySet<number>,
): Collection {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  if (parsed.version !== 1)
    throw new Error("Unsupported saved collection version.");
  return validateEntries(parsed.entries, validIds);
}

export function writeCollection(
  storage: Pick<Storage, "setItem">,
  entries: Collection,
): void {
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, entries }));
}

export function makeBackup(entries: Collection) {
  return {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    entries,
  };
}

export function parseBackup(
  text: string,
  validIds: ReadonlySet<number>,
): Collection {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      "That file is not valid JSON. Choose a Pringles Map backup.",
    );
  }
  if (!data || data.format !== BACKUP_FORMAT || data.version !== 1)
    throw new Error("Please choose a Pringles Map v1 collection backup.");
  const entries = validateEntries(data.entries, validIds);
  if (!Object.keys(entries).length)
    throw new Error("This backup contains no matching flavours.");
  return entries;
}

export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[’‘]/g, "'");
}

export function filterItems(
  items: readonly Flavour[],
  entries: Collection,
  filters: Filters,
  marketNames: MarketNames,
): Flavour[] {
  const query = normalizeSearch(filters.query || "").trim();
  const rows = items.filter((item) => {
    const entry = entries[item.id] || emptyEntry();
    return (
      (!filters.market || item.markets.includes(filters.market)) &&
      (!filters.group || item.group === filters.group) &&
      (filters.view !== "tasted" || entry.tasted) &&
      (filters.view !== "untasted" || !entry.tasted) &&
      (filters.view !== "favourites" || entry.rating >= 4) &&
      (!query ||
        normalizeSearch(
          [
            item.name,
            item.group,
            item.evidence,
            ...item.markets.map((code) => `${code} ${marketNames[code]}`),
          ].join(" "),
        ).includes(query))
    );
  });
  if (filters.sort === "name")
    rows.sort((a, b) => a.name.localeCompare(b.name));
  if (filters.sort === "rating")
    rows.sort(
      (a, b) =>
        (entries[b.id]?.rating || 0) - (entries[a.id]?.rating || 0) ||
        a.name.localeCompare(b.name),
    );
  return rows;
}

export function getRegionProgress(
  items: readonly Flavour[],
  entries: Collection,
  regions: readonly Region[],
): RegionProgress[] {
  return regions.flatMap((region) => {
    const markets = new Set(region.markets);
    // Shared flavours contribute, but only a region-specific flavour starts a bar.
    const started = items.some(
      (item) =>
        entries[item.id]?.tasted &&
        item.markets.length > 0 &&
        item.markets.every((market) => markets.has(market)),
    );
    if (!started) return [];

    const available = items.filter((item) =>
      item.markets.some((market) => markets.has(market)),
    );
    const tasted = available.filter((item) => entries[item.id]?.tasted).length;
    return [
      {
        region,
        tasted,
        total: available.length,
        percent: Math.round((tasted / available.length) * 100),
      },
    ];
  });
}

export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

export function toCSV(
  items: readonly Flavour[],
  entries: Collection,
  marketNames: MarketNames,
): string {
  const rows: (string | number)[][] = [
    [
      "Flavour",
      "Markets",
      "Collection",
      "Evidence",
      "Tasted",
      "Rating (1-5)",
      "Note",
      "Product source",
      "Photos",
    ],
  ];
  for (const item of items) {
    const entry = entries[item.id] || emptyEntry();
    rows.push([
      item.name,
      item.markets.map((c) => marketNames[c]).join("; "),
      item.group,
      item.evidence,
      entry.tasted ? "Yes" : "No",
      entry.rating || "",
      entry.note,
      item.sourceUrl,
      item.photos.map((p) => p.src).join("; "),
    ]);
  }
  return "\ufeff" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
