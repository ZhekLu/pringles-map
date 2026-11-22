import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  emptyEntry,
  filterItems,
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
} from "../src/types.ts";
const catalogue = JSON.parse(
  readFileSync(new URL("../data/catalogue.json", import.meta.url), "utf8"),
) as { items: Flavour[]; markets: MarketNames };
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
