# Pringles Map

A personal checklist of Pringles flavours, with ratings and notes saved in your browser. Made for fun, unaffiliated with Pringles, with no sponsorship, advertising or sales.

[![Tests and build](https://img.shields.io/github/check-runs/ZhekLu/pringles-map/main?nameFilter=Test%20%26%20build%20React%20app&label=tests%20%26%20build&logo=github)](https://github.com/ZhekLu/pringles-map/actions/workflows/pages.yml?query=branch%3Amain)
[![Deploy](https://img.shields.io/github/check-runs/ZhekLu/pringles-map/main?nameFilter=Publish%20GitHub%20Pages&label=deploy&logo=github)](https://github.com/ZhekLu/pringles-map/actions/workflows/pages.yml?query=branch%3Amain)
[![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-static_site-24292F?logo=github&logoColor=white)](.github/workflows/pages.yml)

[![Check it out](https://img.shields.io/badge/Check_it_out-Open_checklist-b8332b?style=for-the-badge&logo=githubpages&logoColor=white)](https://zheklu.github.io/pringles-map/)

![Checklist preview](docs/preview.jpg)

## Using the checklist

- Search the 126 entries by flavour or country, filter by market, and mark flavours as tasted.
- Regional progress appears after you taste a flavour available only within that region.
- Optionally give a 1-5 rating or add a note. Rating a flavour also marks it as tasted; unchecking it keeps your rating and note.
- Each flavour has one can photo. Only distinct regional designs get a gallery, labelled by region. Tap any photo to enlarge it.
- Download a JSON backup to keep your entries or move them to another browser. CSV export and printing are also available.

There is no account or backend. Entries use `localStorage` under `pringles-map.collection.v1`. Clearing browser data removes them, so keep a backup if you want to retain them. Imports update matching flavours and keep other entries.

## Run locally

Requires **Node.js 24 or newer**.

```sh
npm ci
npm run dev
```

```sh
npm test          # Collection behavior tests
npm run build    # Type-check, validate data/images, and compile to dist/
npm run preview  # Preview the compiled site
```

## Maintaining the catalogue

`data/catalogue.json` contains the flavours, source links, image credits and regional market groups.
Photos are stored in `public/assets/cans/`. Flavour IDs are kept stable so existing saved entries continue to match.
