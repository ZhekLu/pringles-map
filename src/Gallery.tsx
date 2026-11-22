import { useRef, useState } from "react";
import type { Flavour } from "./types.ts";
import { CanIcon, StackIcon } from "./icons.tsx";
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

export default function Gallery({
  item,
  detail = false,
  onZoom,
  onPhotoChange,
}: {
  item: Flavour;
  detail?: boolean;
  onZoom: (item: Flavour, index: number) => void;
  onPhotoChange?: (index: number) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  function go(next: number) {
    track.current?.scrollTo({
      left: next * track.current.clientWidth,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  function onScroll() {
    if (!track.current?.clientWidth) return;
    const next = Math.round(
      track.current.scrollLeft / track.current.clientWidth,
    );
    setIndex(next);
    onPhotoChange?.(next);
  }
  const pending = (
    <div className="photo-unavailable">
      <CanIcon />
      <span>Photo unavailable</span>
    </div>
  );
  return (
    <div className={`gallery ${detail ? "detail-gallery" : "card-gallery"}`}>
      <div
        className="photo-track"
        ref={track}
        onScroll={onScroll}
        aria-label={`${item.name} photos`}
      >
        {item.photos.length ? (
          item.photos.map((photo, i) => (
            <button
              className="photo-slide"
              key={photo.src}
              disabled={failed.has(photo.src)}
              onClick={() => onZoom(item, i)}
              aria-label={`Enlarge ${item.name}${photo.region ? ` · ${photo.region}` : ""} photo ${i + 1} of ${item.photos.length}`}
            >
              {failed.has(photo.src) ? (
                <div className="photo-unavailable">
                  <CanIcon />
                  <span>
                    Photo unavailable.
                    <br />
                    See catalogue source.
                  </span>
                </div>
              ) : (
                <img
                  src={asset(photo.src)}
                  alt={`Pringles ${item.name} · ${photo.label || "product photo"}`}
                  loading={detail ? "eager" : "lazy"}
                  decoding="async"
                  width="1000"
                  height="1000"
                  onError={() =>
                    setFailed((prev) => new Set(prev).add(photo.src))
                  }
                />
              )}
            </button>
          ))
        ) : (
          <div className="photo-slide">{pending}</div>
        )}
      </div>
      {item.photos.length > 1 && (
        <span className="gallery-region">{item.photos[index]?.region}</span>
      )}
      {item.photoNote?.includes("regional reference") && (
        <span className="gallery-badge">Reference photo</span>
      )}
      {item.photos.length > 1 && (
        <>
          <span
            className="gallery-badge"
            title={`${item.photos.length} regional designs`}
            aria-hidden="true"
          >
            <StackIcon />
            {item.photos.length}
          </span>
          <button
            className="gallery-nav prev"
            disabled={index === 0}
            onClick={() => go(index - 1)}
            aria-label={`Previous ${item.name} photo`}
          >
            ‹
          </button>
          <button
            className="gallery-nav next"
            disabled={index === item.photos.length - 1}
            onClick={() => go(index + 1)}
            aria-label={`Next ${item.name} photo`}
          >
            ›
          </button>
          <div
            className="gallery-dots"
            role="group"
            aria-label={`Choose ${item.name} photo`}
          >
            {item.photos.map((photo, i) => (
              <button
                key={photo.src}
                className={`gallery-dot ${i === index ? "active" : ""}`}
                onClick={() => go(i)}
                aria-label={`${photo.region || "Photo"} ${i + 1} of ${item.photos.length}`}
                aria-pressed={i === index}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
