"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Download,
  FileArchive,
  FileText,
  Music2,
  Play,
  Pause,
  Search,
  ShieldCheck,
  CheckCircle2,
  Smartphone,
  LoaderCircle,
  Users,
  UserRoundSearch,
} from "lucide-react";
import { usePlatform } from "./platform-provider";
import { Dialog } from "./dialog";
import { MediaLibrary } from "./media-library";
import type { PublicContent, PublicTrack } from "@/lib/public-data";
import type { TranslationKey } from "@/lib/translations";
export const money = (price: string | number, currency = "LSL") =>
  new Intl.NumberFormat("en-LS", { style: "currency", currency }).format(
    Number(price),
  );
export function Homepage({ events }: { events: PublicContent[] }) {
  const { t } = usePlatform();
  return (
    <>
      <section className="hero">
        <img
          className="hero-background"
          src="/ad-logo.png"
          alt=""
          aria-hidden="true"
        />
        <div className="hero-shade" />
        <div className="container hero-content">
          <span className="hero-eyebrow">
            <span />
            LESOTHO · PELE-FEELA
          </span>
          <h1>{t("name")}</h1>
          <p className="hero-sesotho">{t("tagline")}</p>
          <p className="hero-description">{t("intro")}</p>
          <div className="hero-actions">
            <Link className="button button-red" href="/about">
              {t("discover")}
              <ArrowRight size={18} />
            </Link>
            <a
              className="button button-outline"
              href="https://selfreg.iec.org.ls/"
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              title="Official IEC Lesotho registration service (opens in a new tab)"
            >
              <UserRoundSearch size={18} />
              {t("checkVoterRegistration")}
              <ArrowUpRight size={16} />
            </a>
          </div>
        </div>
        <div className="hero-bottom">
          <div className="container">
            <span>{t("tagline")}</span>
            <span>PELE-FEELA</span>
          </div>
        </div>
      </section>
      <section className="about-band">
        <div className="container about-inner">
          <div className="about-brand">
            <img src="/ad-logo.png" alt="Supplied Alliance of Democrats logo" />
          </div>
          <div>
            <span className="eyebrow">ALLIANCE OF DEMOCRATS</span>
            <h2>{t("aboutTitle")}</h2>
            <p>{t("aboutIntro")}</p>
            <Link className="text-link" href="/about">
              {t("explore")}
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
      <section
        className="container section events-home"
        aria-labelledby="home-events-title"
      >
        <div className="section-heading">
          <h2 id="home-events-title">{t("events")}</h2>
          <Link className="text-link" href="/events">
            {t("viewEvents")}
            <ArrowUpRight size={18} />
          </Link>
        </div>
        <EventList content={events} headingAs="h3" />
      </section>
      <section className="container section media-home">
        <div>
          <span className="eyebrow">{t("media")}</span>
          <h2>{t("mediaIntro")}</h2>
          <p>{t("mediaDescription")}</p>
          <div className="actions">
            <Link className="button button-dark" href="/music">
              <Music2 size={18} />
              {t("listen")}
            </Link>
            <Link className="text-link" href="/media">
              {t("viewMedia")}
              <ArrowUpRight size={18} />
            </Link>
          </div>
        </div>
        <Link className="featured-track" href="/music">
          <div className="record-art">
            <img src="/ad-logo.png" alt="AD logo" />
            <span className="record-label">AD MUSIC</span>
          </div>
          <div className="featured-track-info">
            <span>
              <small>{t("music")}</small>
              <strong>{t("audioLibrary")}</strong>
              <span>{t("name")}</span>
            </span>
            <span className="round-play">
              <ArrowUpRight size={20} />
            </span>
          </div>
        </Link>
      </section>
      <section className="connection-band">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">AD DIGITAL PLATFORM</span>
              <h2>{t("quickTitle")}</h2>
              <p>{t("quickIntro")}</p>
            </div>
          </div>
          <div className="connection-links">
            {[
              { href: "/documents", icon: FileText, key: "documents" },
              { href: "/events", icon: CalendarDays, key: "events" },
              { href: "/portal", icon: Users, key: "portal" },
            ].map(({ href, icon: Icon, key }) => (
              <Link key={key} href={href}>
                <Icon size={22} />
                <strong>{t(key as TranslationKey)}</strong>
                <ArrowUpRight size={20} />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
function PageHeading({
  slug,
  description,
  title,
}: {
  slug: string;
  description?: string;
  title?: string;
}) {
  const { t } = usePlatform();
  return (
    <div className="page-heading">
      <div className="container">
        <div className="breadcrumb">
          <Link href="/">{t("home")}</Link>
          <span>/</span>
          <span>{t(slug as TranslationKey)}</span>
        </div>
        <span className="eyebrow">ALLIANCE OF DEMOCRATS</span>
        <h1>{title ?? t(slug as TranslationKey)}</h1>
        {description && <p>{description}</p>}
      </div>
    </div>
  );
}
export function PublicPage({
  slug,
  content,
}: {
  slug: string;
  content: PublicContent[];
}) {
  const { t } = usePlatform();
  if (slug === "music") return <MusicStore />;
  const isManifesto = slug === "about" || slug === "manifesto";
  return (
    <>
      <PageHeading
        slug={slug}
        title={isManifesto ? t("manifestoPageTitle") : undefined}
        description={
          isManifesto
            ? t("manifestoPageDescription")
            : slug === "contact"
              ? t("contactNote")
              : undefined
        }
      />
      <section className="container section public-page-content">
        {isManifesto && (content[0] ? <PublishedManifesto manifesto={content[0]} /> : (
          <div className="about-page">
            <img src="/ad-logo.png" alt="Supplied AD logo" />
            <div>
              <span className="eyebrow">LESOTHO · PELE-FEELA</span>
              <h2>{t("manifestoStatementTitle")}</h2>
              <p className="manifesto-lede">{t("manifestoLead")}</p>
              <div className="manifesto-pillar-list">
                <article>
                  <ShieldCheck size={20} />
                  <div>
                    <h3>{t("manifestoAccountabilityTitle")}</h3>
                    <p>{t("manifestoAccountabilityText")}</p>
                  </div>
                </article>
                <article>
                  <Users size={20} />
                  <div>
                    <h3>{t("manifestoServicesTitle")}</h3>
                    <p>{t("manifestoServicesText")}</p>
                  </div>
                </article>
                <article>
                  <CheckCircle2 size={20} />
                  <div>
                    <h3>{t("manifestoOpportunityTitle")}</h3>
                    <p>{t("manifestoOpportunityText")}</p>
                  </div>
                </article>
                <article>
                  <FileText size={20} />
                  <div>
                    <h3>{t("manifestoParticipationTitle")}</h3>
                    <p>{t("manifestoParticipationText")}</p>
                  </div>
                </article>
              </div>
              <div className="divider" />
              <p>{t("manifestoBody")}</p>
              <Link className="button button-red" href="/documents">
                {t("manifestoDocumentsCta")}
                <ArrowRight size={17} />
              </Link>
            </div>
          </div>
        ))}
        {slug === "events" && <EventList content={content} />}
        {slug === "documents" && (
          <div className="document-list">
            {content.map((c) => (
              <article key={c.id} className="document-row">
                <FileText size={27} />
                <div>
                  <h2>{c.title}</h2>
                  <p>{c.summary}</p>
                </div>
                <a
                  className="button button-outline"
                  href={`/api/documents/${c.id}`}
                  download
                >
                  <Download size={17} />
                  {t("download")}
                </a>
              </article>
            ))}
          </div>
        )}
        {slug === "media" && <MediaLibrary content={content} empty={<EmptyContent />} />}
        {slug === "contact" && <ContactForm />}
        {["leadership", "policies", "candidates"].includes(
          slug,
        ) && <EmptyContent />}
        {!content.length && slug === "documents" && (
          <EmptyContent />
        )}
      </section>
    </>
  );
}
function EventList({
  content,
  headingAs: Heading = "h2",
}: {
  content: PublicContent[];
  headingAs?: "h2" | "h3";
}) {
  const { t } = usePlatform();
  const [article, setArticle] = useState<PublicContent | null>(null);
  if (!content.length) return <EmptyContent />;
  return (
    <>
      <div className="event-list">
        {content.map((event) => (
          <article key={event.id} className="event-row">
            <div className="event-date">
              <strong>
                {event.eventDate ? new Date(event.eventDate).getUTCDate() : "--"}
              </strong>
              <span>
                {event.eventDate
                  ? new Date(event.eventDate).toLocaleDateString("en-GB", {
                      month: "short",
                      timeZone: "UTC",
                    })
                  : ""}
              </span>
            </div>
            <div className="event-info">
              <Heading>{event.title}</Heading>
              <p>{event.summary}</p>
            </div>
            <EventAttachmentPreview content={event} variant="row" />
            <button
              className="icon-button"
              aria-label={`View ${event.title}`}
              title={`View ${event.title}`}
              onClick={() => setArticle(event)}
            >
              <ArrowUpRight />
            </button>
          </article>
        ))}
      </div>
      {article && (
        <Dialog title={article.title} onClose={() => setArticle(null)}>
          <EventAttachmentPreview content={article} variant="dialog" />
          <p className="article-body">{article.body}</p>
          {article.hasAttachment && (
            <a
              className="button button-outline"
              href={
                article.attachment?.downloadUrl || `/api/documents/${article.id}`
              }
              download
            >
              <Download size={17} />
              {t("download")}
            </a>
          )}
        </Dialog>
      )}
    </>
  );
}

function EventAttachmentPreview({
  content,
  variant,
}: {
  content: PublicContent;
  variant: "row" | "dialog";
}) {
  const attachment = content.attachment;
  if (!attachment) return null;
  const className = `event-file event-file-${variant}`;
  const label = `${content.title} uploaded file`;
  if (attachment.category === "image")
    return (
      <div className={`${className} event-file-image`}>
        <img src={attachment.url} alt={label} />
      </div>
    );
  if (attachment.category === "video")
    return (
      <div className={`${className} event-file-video`}>
        <video src={attachment.url} controls preload="metadata" title={label} />
      </div>
    );
  if (attachment.category === "audio")
    return (
      <div className={`${className} event-file-audio`}>
        <div className="event-file-label">
          <Music2 size={18} />
          <span>Uploaded audio</span>
        </div>
        <audio src={attachment.url} controls preload="metadata" />
      </div>
    );
  const Icon = attachment.category === "archive" ? FileArchive : FileText;
  return (
    <a
      className={`${className} event-file-download`}
      href={attachment.downloadUrl}
      download
    >
      <Icon size={20} />
      <span>
        <strong>Uploaded file</strong>
        <small>{attachment.extension.replace(".", "").toUpperCase()}</small>
      </span>
    </a>
  );
}

function PublishedManifesto({ manifesto }: { manifesto: PublicContent }) {
  const { t } = usePlatform();
  return (
    <article className="manifesto-content">
      <header className="manifesto-header">
        <img src="/ad-logo.png" alt="Alliance of Democrats logo" width={108} height={72} />
        <div>
          <h2>{manifesto.title}</h2>
          <p>{manifesto.summary}</p>
        </div>
      </header>
      {manifesto.hasAttachment && (
        <div className="manifesto-actions">
          <a className="button button-outline" href={`/api/documents/${encodeURIComponent(manifesto.id)}`}>
            <Download size={18} />
            {t("downloadManifesto")}
          </a>
        </div>
      )}
      <div className="manifesto-text">{manifesto.body}</div>
    </article>
  );
}
function EmptyContent() {
  const { t } = usePlatform();
  return (
    <div className="empty-state">
      <FileText size={34} />
      <h2>{t("awaiting")}</h2>
      <p>{t("empty")}</p>
    </div>
  );
}
function ContactForm() {
  const { t } = usePlatform(),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))),
      });
      const json = await res.json();
      setMessage(json.message || json.error);
    } catch {
      setMessage("Your message could not be submitted.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="contact-layout">
      <div>
        <span className="eyebrow">{t("contact")}</span>
        <h2>{t("contactTitle")}</h2>
        <p>{t("contactNote")}</p>
        <div className="contact-brand">
          <img src="/ad-logo.png" alt="Supplied AD logo" />
        </div>
      </div>
      <form onSubmit={submit} className="form">
        <label>
          {t("yourName")}
          <input name="name" required maxLength={100} />
        </label>
        <label>
          {t("email")}
          <input name="email" type="email" required />
        </label>
        <label>
          {t("message")}
          <textarea
            name="message"
            required
            minLength={10}
            maxLength={2000}
            rows={5}
          />
        </label>
        <button className="button button-red" disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <ArrowUpRight size={17} />
          )}{" "}
          {t("send")}
        </button>
        {message && (
          <p role="status" className="form-notice">
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
function MusicStore() {
  const { t, tracks, playTrack, current, playing } = usePlatform(),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("All"),
    [category, setCategory] = useState("All"),
    [checkout, setCheckout] = useState<PublicTrack | null>(null);
  const list = tracks.filter(
    (track) =>
      (filter === "All" || track.downloadType === filter) &&
      (category === "All" || track.category === category) &&
      `${track.title} ${track.artist}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading slug="music" description={t("musicDescription")} />
      <section className="container section">
        <div className="music-intro">
          <div>
            <span className="eyebrow">AD DIGITAL STORE</span>
            <h2>{t("musicIntro")}</h2>
          </div>
        </div>
        <div className="store-toolbar">
          <div className="search-input">
            <Search size={18} />
            <input
              aria-label={t("search")}
              placeholder={t("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="segmented">
            {["All", "FREE", "PAID"].map((f) => (
              <button
                key={f}
                aria-pressed={filter === f}
                className={filter === f ? "active" : ""}
                onClick={() => setFilter(f)}
              >
                {f === "All" ? t("all") : f === "FREE" ? t("free") : t("paid")}
              </button>
            ))}
          </div>
          <select
            aria-label="Track category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="All">All categories</option>
            {[...new Set(tracks.map((t) => t.category))].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="track-grid">
          {list.map((track, index) => (
            <article className="track-card" key={track.id}>
              <div className={`track-art track-art-${index % 3}`}>
                <img src={track.artwork} alt={`${track.title} artwork`} />
                <span className="track-type">
                  {track.downloadType === "FREE" ? t("free") : t("paid")}
                </span>
                <button
                  className="art-play"
                  title={t("preview")}
                  aria-label={`${t("preview")}: ${track.title}`}
                  onClick={() => playTrack(track)}
                >
                  {current?.id === track.id && playing ? (
                    <Pause size={24} />
                  ) : (
                    <Play size={24} />
                  )}
                </button>
              </div>
              <div className="track-info">
                <span className="eyebrow">{track.category}</span>
                <h3>{track.title}</h3>
                <p>{track.artist}</p>
                <div className="track-purchase">
                  <strong>
                    {track.downloadType === "FREE"
                      ? t("free")
                      : money(track.price, track.currency)}
                  </strong>
                  {track.downloadType === "FREE" ? (
                    <a
                      className="button button-outline"
                      href={`/api/download/${track.id}`}
                      download
                    >
                      <Download size={16} />
                      {t("download")}
                    </a>
                  ) : (
                    <button
                      className="button button-red"
                      onClick={() => setCheckout(track)}
                    >
                      {t("buy")}
                      <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
        {!list.length && (
          <div className="empty-state">
            <Music2 size={30} />
            <h2>{tracks.length ? "No tracks found" : t("awaiting")}</h2>
            <p>{tracks.length ? "Try another search or filter." : t("empty")}</p>
          </div>
        )}
      </section>
      {checkout && (
        <Checkout track={checkout} onClose={() => setCheckout(null)} />
      )}
    </>
  );
}
function Checkout({
  track,
  onClose,
}: {
  track: PublicTrack;
  onClose: () => void;
}) {
  const [phone, setPhone] = useState("58000000"),
    [purchaseId, setPurchaseId] = useState(""),
    [status, setStatus] = useState("START"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function pay(outcome?: "SUCCESSFUL" | "FAILED") {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        outcome ? `/api/checkout/${purchaseId}` : "/api/checkout",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            outcome ? { outcome } : { trackId: track.id, phone },
          ),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPurchaseId(json.id);
      setStatus(json.status);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Payment could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="Music checkout" onClose={onClose}>
      <div className="demo-payment-banner">
        <Smartphone size={19} />
        <div>
          <strong>SIMULATED M-PESA PAYMENT</strong>
          <span>No real money will be charged.</span>
        </div>
      </div>
      <div className="checkout-track">
        <img src={track.artwork} alt="Track artwork" />
        <div>
          <h3>{track.title}</h3>
          <p>{track.artist}</p>
          <strong>{money(track.price, track.currency)}</strong>
        </div>
      </div>
      {status === "START" && (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            pay();
          }}
        >
          <label>
            Test phone number
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              pattern="[+0-9 ()-]{8,20}"
              inputMode="tel"
            />
          </label>
          <button className="button button-red full-width" disabled={busy}>
            {busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <Smartphone size={17} />
            )}
            Start simulated M-Pesa payment
          </button>
        </form>
      )}
      {status === "PENDING" && (
        <div className="payment-state">
          <span className="pending-dot" />
          <h3>Waiting for payment confirmation</h3>
          <p>Simulated payment pending.</p>
          <button
            disabled={busy}
            className="button button-red full-width"
            onClick={() => pay("SUCCESSFUL")}
          >
            {busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <CheckCircle2 size={17} />
            )}
            Simulate successful payment
          </button>
          <button
            className="text-link"
            disabled={busy}
            onClick={() => pay("FAILED")}
          >
            Simulate failed payment
          </button>
        </div>
      )}
      {status === "SUCCESSFUL" && (
        <div className="payment-state">
          <CheckCircle2 size={38} className="success-icon" />
          <h3>Simulated payment confirmed</h3>
          <p>Your download is ready. No money was transferred.</p>
          <a
            className="button button-red full-width"
            href={`/api/download/${track.id}`}
            download
          >
            <Download size={18} />
            Download track
          </a>
        </div>
      )}
      {status === "FAILED" && (
        <div className="payment-state">
          <h3>Simulated payment failed</h3>
          <p>No download was granted and no money was charged.</p>
          <button
            className="button button-red"
            onClick={() => setStatus("START")}
          >
            Try again
          </button>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="checkout-security">
        <ShieldCheck size={15} />
        Server-verified simulated purchase
      </div>
    </Dialog>
  );
}
