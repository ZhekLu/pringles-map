import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, TouchEvent } from "react";
import catalogue from "../data/catalogue.json";
import type {
  Collection,
  CollectionView,
  Filters,
  Flavour,
  Tasting,
} from "./types.ts";
import {
  emptyEntry,
  filterItems,
  getRegionProgress,
  makeBackup,
  MAX_NOTE_LENGTH,
  parseBackup,
  readCollection,
  STORAGE_KEY,
  toCSV,
  writeCollection,
} from "./collection.ts";
import Gallery, { asset } from "./Gallery.tsx";
import Dialog from "./Dialog.tsx";
import {
  ChecklistIcon,
  NoteIcon,
  SearchIcon,
  StackIcon,
  StarIcon,
} from "./icons.tsx";

const items: Flavour[] = catalogue.items;
const marketNames: Record<string, string> = catalogue.markets;
const validIds = new Set(items.map((item) => item.id));
const defaultFilters: Filters = {
  query: "",
  market: "",
  group: "",
  view: "all",
  sort: "catalogue",
};
const ratingCaptions = [
  "Not rated",
  "1 of 5",
  "2 of 5",
  "3 of 5",
  "4 of 5",
  "5 of 5",
];
function loadInitial(): { entries: Collection; error: string } {
  try {
    return { entries: readCollection(localStorage, validIds), error: "" };
  } catch {
    return {
      entries: {},
      error:
        "Saved collection could not be read. New changes can still be exported as a backup.",
    };
  }
}
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Brand() {
  return (
    <a className="brand" href="./" aria-label="Pringles Map home">
      <span className="brand-mark">
        <ChecklistIcon />
      </span>
      Pringles Map
    </a>
  );
}

function CanCard({
  item,
  entry,
  onTasted,
  onDetails,
  onZoom,
}: {
  item: Flavour;
  entry: Tasting;
  onTasted: (id: number, tasted: boolean) => void;
  onDetails: (item: Flavour) => void;
  onZoom: (item: Flavour, index: number) => void;
}) {
  const markets = item.markets.map((code) => marketNames[code]);
  return (
    <article
      className={`can-card ${entry.tasted ? "is-tasted" : ""}`}
      aria-labelledby={`can-title-${item.id}`}
    >
      <Gallery item={item} onZoom={onZoom} />
      <div className="card-content">
        <span className="card-group">{item.group}</span>
        <h3 className="card-title" id={`can-title-${item.id}`}>
          <button onClick={() => onDetails(item)}>{item.name}</button>
        </h3>
        <p className="card-markets" title={markets.join(", ")}>
          {markets.length > 3
            ? `${markets.slice(0, 2).join(" · ")} +${markets.length - 2} more`
            : markets.join(" · ")}
        </p>
        <div className="card-rating">
          {entry.rating ? (
            <span aria-label={`Rated ${entry.rating} out of 5 stars`}>
              {"★".repeat(entry.rating)}
              <span style={{ color: "#e2ddd6" }}>
                {"☆".repeat(5 - entry.rating)}
              </span>
            </span>
          ) : (
            <span className="rating-empty">Not rated</span>
          )}
          {entry.note && (
            <span className="note-indicator" title="Has a tasting note">
              <NoteIcon />
              <span>Note</span>
            </span>
          )}
        </div>
        <div className="card-footer">
          <label className="card-check">
            <input
              type="checkbox"
              checked={entry.tasted}
              onChange={(e) => onTasted(item.id, e.target.checked)}
              aria-label={`Mark ${item.name} as tasted`}
            />
            <span className="custom-check" aria-hidden="true" />
            <span>{entry.tasted ? "Tasted" : "Mark tasted"}</span>
          </label>
          <button
            className="card-details"
            onClick={() => onDetails(item)}
            aria-label={`${entry.rating || entry.note ? "Edit" : "Add"} rating and note for ${item.name}`}
          >
            {entry.rating || entry.note ? "My notes" : "Rate & note"}
          </button>
        </div>
      </div>
    </article>
  );
}

function TastingPanel({
  item,
  entry,
  storageError,
  onUpdate,
  onZoom,
  onClose,
}: {
  item: Flavour | null;
  entry: Tasting;
  storageError: boolean;
  onUpdate: (id: number, patch: Partial<Tasting>) => void;
  onZoom: (item: Flavour, index: number) => void;
  onClose: () => void;
}) {
  const [photoIndex, setPhotoIndex] = useState(0);
  useEffect(() => {
    setPhotoIndex(0);
  }, [item?.id]);
  return (
    <Dialog
      open={!!item}
      onClose={onClose}
      className="detail-dialog"
      labelledBy="detail-name"
      closeLabel="Close flavour details"
    >
      {item && (
        <div className="detail-layout">
          <div className="detail-visual">
            <Gallery
              key={item.id}
              item={item}
              detail
              onZoom={onZoom}
              onPhotoChange={setPhotoIndex}
            />
            <p className="detail-photo-caption">
              {item.photos.length > 1
                ? "Swipe to compare regional cans · Tap to zoom"
                : item.photos.length
                  ? "Tap photo to enlarge"
                  : "Exact photo not yet verified"}
            </p>
            {item.photoNote && <p className="photo-note">{item.photoNote}</p>}
          </div>
          <div className="detail-content">
            <p className="eyebrow">{item.group}</p>
            <h2 id="detail-name">{item.name}</h2>
            <p className="detail-markets">
              {item.markets.map((code) => marketNames[code]).join(" · ")}
            </p>
            <div className="detail-evidence">{item.evidence} listing</div>
            <hr />
            <label className="tasted-toggle">
              <input
                type="checkbox"
                checked={entry.tasted}
                onChange={(e) =>
                  onUpdate(item.id, { tasted: e.target.checked })
                }
              />
              <span className="custom-check" aria-hidden="true" />
              <span>I’ve tasted this one</span>
            </label>
            <fieldset className="rating-field">
              <legend>Your taste rating</legend>
              <div
                className="stars"
                role="radiogroup"
                aria-label="Taste rating"
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <label
                    className={`star-option ${value <= entry.rating ? "filled" : ""}`}
                    key={value}
                  >
                    <input
                      type="radio"
                      name="taste-rating"
                      value={value}
                      checked={entry.rating === value}
                      onChange={() =>
                        onUpdate(item.id, { rating: value, tasted: true })
                      }
                      aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
                    />
                    <StarIcon />
                  </label>
                ))}
              </div>
              <div className="rating-meta">
                <span>{ratingCaptions[entry.rating]}</span>
                {!!entry.rating && (
                  <button
                    className="text-button"
                    onClick={() => onUpdate(item.id, { rating: 0 })}
                  >
                    Clear rating
                  </button>
                )}
              </div>
            </fieldset>
            <label className="note-label" htmlFor="detail-note">
              Notes <span>optional</span>
            </label>
            <textarea
              id="detail-note"
              maxLength={MAX_NOTE_LENGTH}
              rows={4}
              value={entry.note}
              onChange={(e) => onUpdate(item.id, { note: e.target.value })}
              placeholder="Your notes on this flavour…"
            />
            <div className="note-meta">
              <span role="status" className={storageError ? "error-text" : ""}>
                {storageError
                  ? "Not saved to this browser. Download a backup."
                  : "Saved automatically on this device"}
              </span>
              <span>
                {entry.note.length} / {MAX_NOTE_LENGTH}
              </span>
            </div>
            <div className="detail-source-links">
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Catalogue source
              </a>
              {item.photos[photoIndex] && (
                <a
                  href={item.photos[photoIndex].creditUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Photo credit
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function PhotoZoom({
  state,
  onClose,
}: {
  state: { item: Flavour; index: number } | null;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0),
    [zoomed, setZoomed] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const item = state?.item;
  useEffect(() => {
    setIndex(state?.index || 0);
    setZoomed(false);
  }, [state]);
  const change = useCallback(
    (delta: number) => {
      if (!item) return;
      setIndex((current) =>
        Math.max(0, Math.min(item.photos.length - 1, current + delta)),
      );
      setZoomed(false);
      viewport.current?.scrollTo(0, 0);
    },
    [item],
  );
  useEffect(() => {
    if (!state) return;
    const listener = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        change(event.key === "ArrowLeft" ? -1 : 1);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [state, change]);
  function endTouch(event: TouchEvent) {
    if (!touch.current || zoomed) return;
    const dx = event.changedTouches[0].clientX - touch.current.x,
      dy = event.changedTouches[0].clientY - touch.current.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swiped.current = true;
      change(dx < 0 ? 1 : -1);
    }
    touch.current = null;
  }
  const photo = item?.photos[index];
  return (
    <Dialog
      open={!!state}
      onClose={onClose}
      className="zoom-dialog"
      label="Enlarged product photo"
    >
      <div className="zoom-toolbar">
        <span>
          {item?.name}
          {photo?.region ? ` · ${photo.region}` : ""}
        </span>
        <div>
          <button
            className="button"
            aria-pressed={zoomed}
            onClick={() => setZoomed(!zoomed)}
          >
            {zoomed ? "Zoom out" : "Zoom in"}
          </button>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close enlarged photo"
          >
            ×
          </button>
        </div>
      </div>
      <div
        ref={viewport}
        className={`zoom-viewport ${zoomed ? "is-zoomed" : ""}`}
        onClick={() => {
          if (swiped.current) {
            swiped.current = false;
            return;
          }
          setZoomed(!zoomed);
        }}
        onTouchStart={(e) => {
          swiped.current = false;
          if (e.touches.length === 1)
            touch.current = {
              x: e.touches[0].clientX,
              y: e.touches[0].clientY,
            };
        }}
        onTouchEnd={endTouch}
      >
        {photo && (
          <img
            src={asset(photo.src)}
            alt={`Pringles ${item?.name} · ${photo.label}`}
          />
        )}
      </div>
      <div className="zoom-bottom">
        {(item?.photos.length || 0) > 1 && (
          <button
            className="icon-button"
            disabled={index === 0}
            onClick={() => change(-1)}
            aria-label="Previous photo"
          >
            ‹
          </button>
        )}
        <span>
          {index + 1} / {item?.photos.length}
        </span>
        {(item?.photos.length || 0) > 1 && (
          <button
            className="icon-button"
            disabled={index === (item?.photos.length || 0) - 1}
            onClick={() => change(1)}
            aria-label="Next photo"
          >
            ›
          </button>
        )}
      </div>
    </Dialog>
  );
}

export default function App() {
  const [initial] = useState(loadInitial);
  const [entries, setEntries] = useState<Collection>(initial.entries);
  const entriesRef = useRef(entries);
  const [storageError, setStorageError] = useState(!!initial.error);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [selected, setSelected] = useState<Flavour | null>(null);
  const [zoom, setZoom] = useState<{ item: Flavour; index: number } | null>(
    null,
  );
  const [backupOpen, setBackupOpen] = useState(false),
    [aboutOpen, setAboutOpen] = useState(false);
  const [importStatus, setImportStatus] = useState({ text: "", error: false });
  const [message, setMessage] = useState(initial.error);
  const searchRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notify = useCallback((text: string) => {
    clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => setMessage(""), 5000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  function persist(next: Collection) {
    entriesRef.current = next;
    setEntries(next);
    try {
      writeCollection(localStorage, next);
      setStorageError(false);
      return true;
    } catch {
      if (!storageError)
        notify(
          "Browser storage is unavailable. Download a backup to keep your changes.",
        );
      setStorageError(true);
      return false;
    }
  }
  function updateEntry(id: number, patch: Partial<Tasting>) {
    persist({
      ...entriesRef.current,
      [id]: { ...(entriesRef.current[id] || emptyEntry()), ...patch },
    });
  }
  useEffect(() => {
    function storage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      try {
        const next = readCollection(localStorage, validIds);
        entriesRef.current = next;
        setEntries(next);
        notify("Collection updated from another tab.");
      } catch {
        notify("Could not read the collection update from another tab.");
      }
    }
    window.addEventListener("storage", storage);
    return () => window.removeEventListener("storage", storage);
  }, [notify]);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (
        event.key === "/" &&
        !document.querySelector("dialog[open]") &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (event.target as HTMLElement)?.tagName,
        )
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);
  const rows = useMemo(
    () => filterItems(items, entries, filters, marketNames),
    [entries, filters],
  );
  const tasted = items.filter((x) => entries[x.id]?.tasted).length,
    rated = items.filter((x) => entries[x.id]?.rating).length;
  const percent = Math.round((tasted / items.length) * 100);
  const regionProgress = useMemo(
    () => getRegionProgress(items, entries, catalogue.regions),
    [entries],
  );
  const hasFilters =
    filters.query || filters.market || filters.group || filters.view !== "all";
  const onZoom = useCallback(
    (item: Flavour, index: number) => setZoom({ item, index }),
    [],
  );
  const tabs: {
    view: CollectionView;
    label: string;
    count: number | string;
  }[] = [
    { view: "all", label: "All flavours", count: items.length },
    { view: "untasted", label: "To try", count: items.length - tasted },
    { view: "tasted", label: "Tasted", count: tasted },
    { view: "favourites", label: "Top rated", count: "★" },
  ];
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target,
      file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 2_000_000)
        throw new Error(
          "This file is too large to be a collection backup (maximum 2 MB).",
        );
      const imported = parseBackup(await file.text(), validIds);
      const saved = persist({ ...entriesRef.current, ...imported });
      setImportStatus({
        text: `${Object.keys(imported).length} flavour entries imported.${saved ? " Saved on this device." : " Browser storage is unavailable. Download a backup before leaving."}`,
        error: !saved,
      });
    } catch (error) {
      setImportStatus({
        text:
          error instanceof Error
            ? error.message
            : "The backup could not be read.",
        error: true,
      });
    }
    input.value = "";
  }
  return (
    <>
      <a className="skip-link" href="#collection">
        Skip to the checklist
      </a>
      <header className="topbar wrap">
        <Brand />
        <div className="top-actions">
          <span className={`save-status ${storageError ? "error-text" : ""}`}>
            {!storageError && <span className="status-dot" />}
            {storageError
              ? "Not saved · Download a backup"
              : "Saved on this device"}
          </span>
          <button
            className="button button-quiet"
            onClick={() => setBackupOpen(true)}
          >
            Collection backup <span aria-hidden="true">↥</span>
          </button>
        </div>
      </header>
      <main>
        <section className="page-heading wrap" aria-labelledby="page-title">
          <h1 id="page-title">Pringles checklist</h1>
          <p>Track flavours you’ve tried, with optional ratings and notes.</p>
        </section>
        <section
          className="progress-summary wrap"
          aria-label="Your tasting progress"
        >
          <div className="progress-heading">
            <span className="progress-icon" aria-hidden="true">
              ✓
            </span>
            <div>
              <p className="eyebrow">WORLDWIDE</p>
              <p>
                <strong>{tasted}</strong>{" "}
                <span className="muted">of {items.length} flavours tasted</span>
              </p>
            </div>
          </div>
          <div className="progress-caption">
            <div
              className="progress-track"
              role="progressbar"
              aria-label="Worldwide flavours tasted"
              aria-valuemin={0}
              aria-valuemax={items.length}
              aria-valuenow={tasted}
            >
              <div style={{ width: `${percent}%` }} />
            </div>
            <span>
              {tasted === 0
                ? "No flavours marked yet."
                : `${items.length - tasted} remaining · ${percent}% tasted`}
            </span>
          </div>
          <div className="progress-stat">
            <strong>{rated}</strong>
            <span>rated</span>
          </div>
        </section>
        {regionProgress.length > 0 && (
          <section
            className="region-progress wrap"
            aria-labelledby="region-progress-title"
          >
            <div className="region-progress-heading">
              <h2 id="region-progress-title">Your regions</h2>
              <p>
                A regional flavour starts a bar. Shared classics count towards
                it too.
              </p>
            </div>
            <div className="region-progress-grid">
              {regionProgress.map(({ region, tasted, total, percent }) => (
                <div className="region-progress-item" key={region.id}>
                  <div className="region-progress-label">
                    <h3
                      title={region.markets
                        .map((code) => marketNames[code])
                        .join(", ")}
                    >
                      {region.name}
                    </h3>
                    <span>
                      <strong>{tasted}</strong> / {total}
                    </span>
                  </div>
                  <div className="region-progress-meter">
                    <div
                      className="progress-track"
                      role="progressbar"
                      aria-label={`${region.name} flavours tasted`}
                      aria-valuemin={0}
                      aria-valuemax={total}
                      aria-valuenow={tasted}
                      aria-valuetext={`${tasted} of ${total} flavours tasted (${percent}%)`}
                    >
                      <div style={{ width: `${percent}%` }} />
                    </div>
                    <span>{percent}%</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        <section
          className="collection wrap"
          id="collection"
          aria-labelledby="collection-title"
        >
          <div className="collection-heading">
            <div>
              <h2 id="collection-title">Flavours</h2>
            </div>
            <span className="catalog-label">
              {items.length} flavours <span>·</span>{" "}
              {Object.keys(marketNames).length} markets
            </span>
          </div>
          <div className="filters">
            <label className="search-box">
              <SearchIcon />
              <input
                ref={searchRef}
                type="search"
                value={filters.query}
                onChange={(e) =>
                  setFilters({ ...filters, query: e.target.value })
                }
                placeholder="Search flavours or countries…"
                aria-label="Search flavours and countries"
                autoComplete="off"
              />
              <kbd aria-hidden="true">/</kbd>
            </label>
            <label className="select-wrap">
              <span className="sr-only">Filter by market</span>
              <select
                value={filters.market}
                onChange={(e) =>
                  setFilters({ ...filters, market: e.target.value })
                }
              >
                <option value="">All markets</option>
                {Object.entries(marketNames).map(([code, name]) => (
                  <option value={code} key={code}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="select-wrap">
              <span className="sr-only">Filter by collection</span>
              <select
                value={filters.group}
                onChange={(e) =>
                  setFilters({ ...filters, group: e.target.value })
                }
              >
                <option value="">All collections</option>
                {[...new Set(items.map((item) => item.group))].map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="collection-controls">
            <div className="view-tabs" role="group" aria-label="Tasting status">
              {tabs.map((tab) => (
                <button
                  key={tab.view}
                  className={`view-tab ${filters.view === tab.view ? "active" : ""}`}
                  aria-pressed={filters.view === tab.view}
                  onClick={() => setFilters({ ...filters, view: tab.view })}
                >
                  {tab.label} <span>{tab.count}</span>
                </button>
              ))}
            </div>
            <label className="sort-label">
              Sort by{" "}
              <span className="select-wrap">
                <select
                  aria-label="Sort flavours"
                  value={filters.sort}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      sort: e.target.value as Filters["sort"],
                    })
                  }
                >
                  <option value="catalogue">Catalogue order</option>
                  <option value="name">Name, A-Z</option>
                  <option value="rating">My rating</option>
                </select>
              </span>
            </label>
          </div>
          <div className="results-line">
            <p role="status">
              {rows.length} {rows.length === 1 ? "flavour" : "flavours"} shown
            </p>
            {hasFilters && (
              <button
                className="text-button"
                onClick={() => setFilters(defaultFilters)}
              >
                Clear filters
              </button>
            )}
            <span className="gallery-hint">
              <StackIcon />
              Regional designs: swipe to compare.
            </span>
          </div>
          <div className="card-grid">
            {rows.map((item) => (
              <CanCard
                key={item.id}
                item={item}
                entry={entries[item.id] || emptyEntry()}
                onTasted={(id, value) => updateEntry(id, { tasted: value })}
                onDetails={setSelected}
                onZoom={onZoom}
              />
            ))}
          </div>
          {!rows.length && (
            <div className="empty-state">
              <span aria-hidden="true">✳</span>
              <h3>No matching flavours</h3>
              <p>Change the search or clear the filters.</p>
              <button
                className="button button-red"
                onClick={() => setFilters(defaultFilters)}
              >
                Show all flavours
              </button>
            </div>
          )}
        </section>
      </main>
      <footer className="site-footer wrap">
        <p className="footer-summary">A personal checklist for fun.</p>
        <div className="footer-links">
          <button className="text-button" onClick={() => setAboutOpen(true)}>
            About the collection
          </button>
          <button
            className="text-button"
            onClick={() =>
              download(
                "pringles-map-tastings.csv",
                toCSV(items, entries, marketNames),
                "text/csv;charset=utf-8",
              )
            }
          >
            Export CSV
          </button>
          <button className="text-button" onClick={() => window.print()}>
            Print checklist
          </button>
        </div>
        <p className="footer-fine">
          Unaffiliated with Pringles. Your entries stay in this browser.
        </p>
      </footer>
      <TastingPanel
        item={selected}
        entry={selected ? entries[selected.id] || emptyEntry() : emptyEntry()}
        storageError={storageError}
        onUpdate={updateEntry}
        onZoom={onZoom}
        onClose={() => setSelected(null)}
      />
      <PhotoZoom state={zoom} onClose={() => setZoom(null)} />
      <Dialog
        open={backupOpen}
        onClose={() => setBackupOpen(false)}
        className="small-dialog"
        labelledBy="backup-title"
        closeLabel="Close backup"
      >
        <p className="eyebrow">YOUR DATA</p>
        <h2 id="backup-title">Backup and restore</h2>
        <p>
          Download your checkmarks, ratings and notes as JSON. Import a backup
          to use them in another browser.
        </p>
        <button
          className="button button-red full-width"
          onClick={() => {
            download(
              `pringles-map-backup-${new Date().toISOString().slice(0, 10)}.json`,
              JSON.stringify(makeBackup(entries), null, 2),
              "application/json",
            );
            notify("Collection backup downloaded.");
          }}
        >
          Download collection backup
        </button>
        <div className="import-section">
          <h3>Restore a backup</h3>
          <p>
            Import a Pringles Map JSON backup. Entries in the file update
            matching flavours; your other entries stay as they are.
          </p>
          <label className="button full-width file-label">
            Choose backup file
            <input
              type="file"
              accept=".json,application/json"
              onChange={importFile}
            />
          </label>
          <p role="status" className={importStatus.error ? "error-text" : ""}>
            {importStatus.text}
          </p>
        </div>
      </Dialog>
      <Dialog
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        className="small-dialog about-dialog"
        labelledBy="about-title"
        closeLabel="Close about"
      >
        <h2 id="about-title">About this checklist</h2>
        <p>
          A personal hobby project for tracking which Pringles flavours you’ve
          tried. No sponsorship, advertising or sales.
        </p>
        <p>
          The catalogue contains {items.length} entries across{" "}
          {Object.keys(marketNames).length} markets, based on the supplied
          November 2026 list. Market labels may be incomplete. Mingles are
          listed separately.
        </p>
        <p>
          Photos are for recognising cans. Multiple images show distinct
          regional packaging, with the region labelled. Reference photos are
          marked separately.
        </p>
        <p>
          Checkmarks, ratings and notes stay in this browser. There’s no
          account, server storage or analytics. Clearing site data removes your
          entries; a JSON backup lets you restore them.
        </p>
        <details>
          <summary>Catalogue sources</summary>
          <div id="source-list">
            {Object.entries(catalogue.sources).map(([id, [label, url]]) => (
              <a key={id} href={url} target="_blank" rel="noopener noreferrer">
                {label}
              </a>
            ))}
          </div>
        </details>
        <p className="muted">
          Unaffiliated with Pringles. Product names and photos belong to their
          respective owners.
        </p>
      </Dialog>
      {message && (
        <div className="toast" role="status">
          {message}
        </div>
      )}
    </>
  );
}
