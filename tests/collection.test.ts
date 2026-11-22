import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  emptyEntry,
  filterItems,
  getRegionProgress,
  makeBackup,
  parseBackup,
  readCollection,
  STORAGE_KEY,
  toCSV,
  validateEntries,
  writeCollection,
} from "../src/collection.ts";
import type {
  Collection,
  Filters,
  Flavour,
  MarketNames,
  Region,
} from "../src/types.ts";
const catalogue = JSON.parse(
  readFileSync(new URL("../data/catalogue.json", import.meta.url), "utf8"),
) as { items: Flavour[]; markets: MarketNames; regions: Region[] };
const ids = new Set(catalogue.items.map((item) => item.id));
const filters: Filters = {
  query: "",
  market: "",
  group: "",
  view: "all",
  sort: "catalogue",
};
const sample: Collection = {
  1: {
    tasted: true,
    rating: 5,
    note: "Crisp, salty & good.\nWould pop again! 🥔",
  },
  2: { tasted: false, rating: 0, note: "Try in Japan." },
};
function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
test("checklist, ratings, Unicode and multiline notes persist across a fresh read", () => {
  const storage = memoryStorage();
  assert.deepEqual(readCollection(storage, ids), {});
  writeCollection(storage, sample);
  assert.deepEqual(readCollection(storage, ids), sample);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)!).version, 1);
});
test("backup round trip preserves every user field", () => {
  assert.deepEqual(
    parseBackup(JSON.stringify(makeBackup(sample)), ids),
    sample,
  );
});
test("invalid backups fail before import, and unknown IDs cannot become flavours", () => {
  for (const content of [
    "not json",
    "null",
    "[]",
    "{}",
    '{"format":"another-app","version":1,"entries":{}}',
  ])
    assert.throws(() => parseBackup(content, ids));
  const invalid = [
    null,
    [],
    true,
    { tasted: "yes", rating: 3, note: "" },
    { tasted: true, rating: 6, note: "" },
    { tasted: true, rating: 2.5, note: "" },
    { tasted: true, rating: 1, note: "x".repeat(2001) },
  ];
  for (const entry of invalid)
    assert.throws(() => validateEntries({ 1: entry }, ids));
  assert.deepEqual(
    validateEntries(
      { 999: emptyEntry(), "01": emptyEntry(), 1: sample[1] },
      ids,
    ),
    { 1: sample[1] },
  );
  assert.throws(() =>
    parseBackup(JSON.stringify({ ...makeBackup({}), version: 2 }), ids),
  );
});
test("corrupt stored data and storage permission failures are not silently treated as a successful save", () => {
  assert.throws(() => readCollection({ getItem: () => "{broken" }, ids));
  assert.throws(() =>
    readCollection({ getItem: () => '{"version":2,"entries":{}}' }, ids),
  );
  assert.throws(
    () =>
      writeCollection(
        {
          setItem: () => {
            throw new Error("Quota exceeded");
          },
        },
        sample,
      ),
    /Quota exceeded/,
  );
});
test("market, collection, tasting state and rating filters combine", () => {
  assert.deepEqual(
    filterItems(
      catalogue.items,
      sample,
      { ...filters, view: "tasted" },
      catalogue.markets,
    ).map((i) => i.id),
    [1],
  );
  assert.equal(
    filterItems(
      catalogue.items,
      sample,
      { ...filters, view: "untasted" },
      catalogue.markets,
    ).length,
    catalogue.items.length - 1,
  );
  assert.deepEqual(
    filterItems(
      catalogue.items,
      sample,
      { ...filters, view: "favourites" },
      catalogue.markets,
    ).map((i) => i.id),
    [1],
  );
  assert.equal(
    filterItems(
      catalogue.items,
      sample,
      { ...filters, market: "JP", group: "China" },
      catalogue.markets,
    ).length,
    0,
  );
  assert(
    filterItems(
      catalogue.items,
      sample,
      { ...filters, market: "JP" },
      catalogue.markets,
    ).every((i) => i.markets.includes("JP")),
  );
});
test("search handles accents, country names and apostrophes", () => {
  assert(
    filterItems(
      catalogue.items,
      {},
      { ...filters, query: "jamon" },
      catalogue.markets,
    ).some((i) => i.name.startsWith("Jamón")),
  );
  assert(
    filterItems(
      catalogue.items,
      {},
      { ...filters, query: "JAPAN" },
      catalogue.markets,
    ).every((i) => i.markets.includes("JP") || i.group === "Japan"),
  );
  assert(
    filterItems(
      catalogue.items,
      {},
      { ...filters, query: "rosé" },
      catalogue.markets,
    ).some((i) => i.name.includes("Rosé")),
  );
});
test("sorts by personal rating without mutating the catalogue", () => {
  const original = catalogue.items.map((i) => i.id);
  const sorted = filterItems(
    catalogue.items,
    {
      4: { tasted: true, rating: 5, note: "" },
      2: { tasted: true, rating: 4, note: "" },
    },
    { ...filters, sort: "rating" },
    catalogue.markets,
  );
  assert.deepEqual(
    sorted.slice(0, 2).map((i) => i.id),
    [4, 2],
  );
  assert.deepEqual(
    catalogue.items.map((i) => i.id),
    original,
  );
});
function tastedEntries(...ids: number[]): Collection {
  return Object.fromEntries(
    ids.map((id) => [id, { ...emptyEntry(), tasted: true }]),
  );
}
function regionalCounts(entries: Collection) {
  return getRegionProgress(catalogue.items, entries, catalogue.regions).map(
    ({ region, tasted, total, percent }) => ({
      region: region.id,
      tasted,
      total,
      percent,
    }),
  );
}
test("empty collections and shared classics alone start no regional progress", () => {
  assert.deepEqual(regionalCounts({}), []);
  // Original, Sour Cream & Onion, BBQ and Salt & Vinegar span several regions.
  assert.deepEqual(regionalCounts(tastedEntries(1, 2, 3, 4)), []);
});
test("a Europe-only flavour starts Europe and includes shared classics in its progress", () => {
  // Original + Emmental. The 40 available flavours include other collections.
  assert.deepEqual(regionalCounts(tastedEntries(1, 28)), [
    { region: "europe", tasted: 2, total: 40, percent: 5 },
  ]);
});
test("availability determines the region regardless of the collection label", () => {
  // Prawn Cocktail (UK + EU) and Bacon are Classics; Pigs in Blankets is Seasonal.
  // The UK + EU flavour is counted once, and each can start the same region.
  for (const id of [14, 15, 49]) {
    assert.deepEqual(regionalCounts(tastedEntries(id)), [
      { region: "europe", tasted: 1, total: 40, percent: 3 },
    ]);
  }
  assert.deepEqual(regionalCounts(tastedEntries(1, 14, 15, 49)), [
    { region: "europe", tasted: 4, total: 40, percent: 10 },
  ]);
});
test("shared classics contribute to every started region without starting the rest", () => {
  // Original + Emmental + Texas BBQ Brisket + Hi! CHEESE!.
  assert.deepEqual(regionalCounts(tastedEntries(1, 28, 51, 87)), [
    { region: "europe", tasted: 2, total: 40, percent: 5 },
    { region: "north-america", tasted: 2, total: 46, percent: 4 },
    { region: "japan", tasted: 2, total: 10, percent: 20 },
  ]);
});
test("a flavour shared across two regions counts towards both but starts neither", () => {
  // Butter Caramel is sold in Australia and Korea, despite its collection label.
  assert.deepEqual(regionalCounts(tastedEntries(82)), []);
  assert.deepEqual(regionalCounts(tastedEntries(82, 80)), [
    { region: "asia-oceania", tasted: 2, total: 15, percent: 13 },
  ]);
  assert.deepEqual(regionalCounts(tastedEntries(82, 80, 95)), [
    { region: "asia-oceania", tasted: 2, total: 15, percent: 13 },
    { region: "korea", tasted: 2, total: 15, percent: 13 },
  ]);
});
test("unchecking the last regional flavour hides its bar even when its rating and note remain", () => {
  const entries = tastedEntries(1, 28);
  assert.equal(regionalCounts(entries).length, 1);
  entries[28] = { tasted: false, rating: 5, note: "Would try again." };
  assert.deepEqual(regionalCounts(entries), []);
  // Deriving progress leaves the saved entry untouched.
  assert.deepEqual(entries[28], {
    tasted: false,
    rating: 5,
    note: "Would try again.",
  });
});
test("completed regional bars use all available flavours and never exceed 100 percent", () => {
  const entries = tastedEntries(...catalogue.items.map((item) => item.id));
  assert.deepEqual(regionalCounts(entries), [
    { region: "europe", tasted: 40, total: 40, percent: 100 },
    { region: "north-america", tasted: 46, total: 46, percent: 100 },
    { region: "asia-oceania", tasted: 15, total: 15, percent: 100 },
    { region: "japan", tasted: 10, total: 10, percent: 100 },
    { region: "korea", tasted: 15, total: 15, percent: 100 },
    { region: "china", tasted: 14, total: 14, percent: 100 },
    { region: "brazil", tasted: 5, total: 5, percent: 100 },
    { region: "africa-middle-east", tasted: 12, total: 12, percent: 100 },
  ]);
});
test("CSV preserves notes and quotes while neutralizing spreadsheet formulas", () => {
  const data = {
    1: { tasted: true, rating: 4, note: '=HYPERLINK("bad")\nsecond line' },
  };
  const csv = toCSV(catalogue.items.slice(0, 1), data, catalogue.markets);
  assert(csv.startsWith("\ufeff"));
  assert(csv.includes('"Yes","4"'));
  assert(csv.includes('"\'=HYPERLINK(""bad"")\nsecond line"'));
  assert(csv.includes("Product source"));
});
