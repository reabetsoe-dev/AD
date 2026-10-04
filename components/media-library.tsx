"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ArrowRight, ArrowUpRight, Download, FileText, Image as ImageIcon, Mic2, Music2, Newspaper, Play } from "lucide-react";
import type { PublicContent } from "@/lib/public-data";
import { linkedMediaType, mediaCategoryFor, mediaCategories, mediaLabels, type MediaCategory } from "@/lib/media";
import { Dialog } from "./dialog";
import { usePlatform } from "./platform-provider";

const mediaIcons = { photos: ImageIcon, videos: Play, speeches: Mic2, press: Newspaper };

function mediaPreview(item: PublicContent) {
  if (item.attachment) return { type: item.attachment.category, url: item.attachment.url };
  if (item.image) return { type: "image", url: item.image };
  return {
    type: linkedMediaType(item.externalUrl) || (item.mediaCategory === "photos" && item.externalUrl ? "image" : null),
    url: item.externalUrl,
  };
}

function MediaVisual({ item, expanded = false }: { item: PublicContent; expanded?: boolean }) {
  const [failed, setFailed] = useState(false);
  const preview = mediaPreview(item);
  const Icon = mediaIcons[mediaCategoryFor(item)];
  if (!failed && preview.url && preview.type === "image")
    return <img className={expanded ? "lightbox-image" : "media-thumbnail"} src={preview.url} alt={item.title} loading={expanded ? "eager" : "lazy"} referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
  if (!failed && preview.url && preview.type === "video")
    return <video className={expanded ? "media-player" : "media-thumbnail"} src={preview.url} controls={expanded} muted={!expanded} playsInline preload="metadata" title={item.title} onError={() => setFailed(true)} />;
  if (expanded && preview.url && preview.type === "audio")
    return <audio className="media-audio" src={preview.url} controls preload="metadata" title={item.title} />;
  return (
    <div className={`media-placeholder media-placeholder-${mediaCategoryFor(item)}`}>
      <Icon size={expanded ? 40 : 32} aria-hidden="true" />
      <span>{mediaLabels[mediaCategoryFor(item)]}</span>
    </div>
  );
}

export function MediaLibrary({ content, empty }: { content: PublicContent[]; empty: ReactNode }) {
  const { t } = usePlatform();
  const [filter, setFilter] = useState<MediaCategory | "all" | "music">("all");
  const [selected, setSelected] = useState<PublicContent | null>(null);
  const visible = content.filter((item) => filter === "all" || mediaCategoryFor(item) === filter);
  const filters = ["all", ...mediaCategories.slice(0, 2), "music", ...mediaCategories.slice(2)] as const;
  return (
    <>
      <div className="tabs" role="group" aria-label="Media categories">
        {filters.map((category) => (
          <button key={category} aria-pressed={filter === category} className={filter === category ? "active" : ""} onClick={() => setFilter(category)}>
            {category === "all" ? "All" : category === "music" ? t("music") : mediaLabels[category]}
          </button>
        ))}
      </div>
      {visible.length > 0 && (
        <div className="media-grid">
          {visible.map((item) => {
            const category = mediaCategoryFor(item);
            const Icon = mediaIcons[category];
            return (
              <button className="media-item" key={item.id} onClick={() => setSelected(item)} aria-label={`View ${item.title}`}>
                <MediaVisual item={item} />
                <div className="media-item-info">
                  <span className="media-item-category"><Icon size={16} />{mediaLabels[category]}</span>
                  <strong>{item.title}</strong>
                  <p>{item.summary}</p>
                  {item.externalUrl && <ArrowUpRight className="media-link-icon" size={16} />}
                </div>
              </button>
            );
          })}
        </div>
      )}
      {["all", "music"].includes(filter) && (
        <Link className="media-music-link" href="/music">
          <Music2 size={24} />
          <div><strong>{t("music")}</strong><p>{t("musicDescription")}</p></div>
          <ArrowRight size={20} />
        </Link>
      )}
      {!visible.length && filter !== "music" && empty}
      {selected && (
        <Dialog title={selected.title} onClose={() => setSelected(null)}>
          <MediaVisual key={selected.id} item={selected} expanded />
          <p>{selected.summary}</p>
          {selected.body && <p className="article-body">{selected.body}</p>}
          <div className="actions media-detail-actions">
            {selected.attachment && (
              <>
                {selected.attachment.category === "document" && (
                  <a className="button button-outline" href={selected.attachment.url} target="_blank" rel="noopener noreferrer"><FileText size={17} />Open document<ArrowUpRight size={16} /></a>
                )}
                <a className="button button-outline" href={selected.attachment.downloadUrl} download><Download size={17} />{t("download")}</a>
              </>
            )}
            {selected.externalUrl && (
              <a className="button button-red" href={selected.externalUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><ArrowUpRight size={17} />Open link</a>
            )}
          </div>
        </Dialog>
      )}
    </>
  );
}
