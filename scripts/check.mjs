import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
const catalogue = JSON.parse(await readFile("data/catalogue.json", "utf8"));
const ids = new Set();
const usedImages = new Set();
const regionIds = new Set();
const regionMarkets = new Set();
for (const region of catalogue.regions) {
  assert(
    region.id && !regionIds.has(region.id),
    `Duplicate/invalid region: ${region.id}`,
  );
  regionIds.add(region.id);
  assert(
    region.name && region.markets.length,
    `Incomplete region: ${region.id}`,
  );
  for (const market of region.markets) {
    assert(catalogue.markets[market], `Unknown regional market: ${market}`);
    assert(
      !regionMarkets.has(market),
      `Market belongs to multiple regions: ${market}`,
    );
    regionMarkets.add(market);
  }
}
assert.deepEqual(
  [...regionMarkets].sort(),
  Object.keys(catalogue.markets).sort(),
  "Every market must belong to a region.",
);
let images = 0;
for (const item of catalogue.items) {
  assert(
    Number.isInteger(item.id) && !ids.has(item.id),
    `Duplicate/invalid ID: ${item.id}`,
  );
  ids.add(item.id);
  assert(
    item.name && item.group && item.sourceUrl.startsWith("https://"),
    `Incomplete flavour ${item.id}`,
  );
  assert(
    item.markets.length && item.markets.every((m) => catalogue.markets[m]),
    `Unknown market: ${item.id}`,
  );
  assert(item.photos.length > 0, `Missing product photo: ${item.name}`);
  if (item.photos.length > 1) {
    const regions = item.photos.map((photo) =>
      photo.region?.trim().toLowerCase(),
    );
    assert(
      regions.every(Boolean),
      `Every gallery photo needs a region: ${item.name}`,
    );
    assert(
      new Set(regions).size === regions.length,
      `Repeated regional design: ${item.name}`,
    );
    assert(
      item.photos.every(
        (photo) =>
          !/nutrition|packaging detail|size comparison/i.test(photo.label),
      ),
      `Gallery must contain regional can designs: ${item.name}`,
    );
  }
  const paths = new Set();
  for (const photo of item.photos) {
    assert(
      /^assets\/cans\/[a-zA-Z0-9_-]+\.webp$/.test(photo.src),
      `Invalid photo path: ${photo.src}`,
    );
    assert(!paths.has(photo.src), `Duplicate image: ${photo.src}`);
    paths.add(photo.src);
    usedImages.add(photo.src);
    assert(
      photo.creditUrl.startsWith("https://") &&
        photo.originalUrl.startsWith("https://"),
      `Missing photo credit: ${photo.src}`,
    );
    const info = await stat(resolve("public", photo.src));
    assert(
      info.size > 500 && info.size < 1_500_000,
      `Unexpected image size: ${photo.src}`,
    );
    const bytes = await readFile(resolve("public", photo.src));
    assert(
      bytes.toString("ascii", 0, 4) === "RIFF" &&
        bytes.toString("ascii", 8, 12) === "WEBP",
      `Not a WebP image: ${photo.src}`,
    );
    images++;
  }
}
assert(
  catalogue.items.find((item) => item.id === 1)?.photos.length === 1,
  "Original should have one representative can photo.",
);
for (const name of await readdir("public/assets/cans")) {
  assert(usedImages.has(`assets/cans/${name}`), `Unused image: ${name}`);
}
console.log(
  `Checked ${ids.size} flavours, ${images} local images, ${catalogue.items.filter((i) => i.photos.length > 1).length} galleries.`,
);
