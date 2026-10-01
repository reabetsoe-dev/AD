"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Download,
  FileText,
  Music2,
  Play,
  Pause,
  Search,
  ShieldCheck,
  CheckCircle2,
  Smartphone,
  LoaderCircle,
  Image as ImageIcon,
  Users,
} from "lucide-react";
import { usePlatform } from "./platform-provider";
import { Dialog } from "./dialog";
import type { PublicContent, PublicTrack } from "@/lib/public-data";
import type { TranslationKey } from "@/lib/translations";
export const money = (price: string | number, currency = "LSL") =>
  new Intl.NumberFormat("en-LS", { style: "currency", currency }).format(
    Number(price),
  );
export function Homepage() {
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
            <span className="eyebrow">{t("about")}</span>
            <h2>{t("aboutTitle")}</h2>
            <p>{t("aboutIntro")}</p>
            <Link className="text-link" href="/about">
              {t("explore")}
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
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
}: {
  slug: string;
  description?: string;
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
        <h1>{t(slug as TranslationKey)}</h1>
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
  const { t } = usePlatform(),
    [article, setArticle] = useState<PublicContent | null>(null),
    [filter, setFilter] = useState("All"),
    [photo, setPhoto] = useState<PublicContent | null>(null);
  if (slug === "music") return <MusicStore />;
  return (
    <>
      <PageHeading
        slug={slug}
        description={slug === "contact" ? t("contactNote") : undefined}
      />
      <section className="container section public-page-content">
        {slug === "about" && (
          <div className="about-page">
            <img src="/ad-logo.png" alt="Supplied AD logo" />
            <div>
              <span className="eyebrow">LESOTHO · PELE-FEELA</span>
              <h2>{t("tagline")}</h2>
              <p>{t("aboutBody")}</p>
              <div className="divider" />
              <p>{t("aboutIntro")}</p>
              <Link className="button button-red" href="/portal/login">
                {t("portal")}
                <ArrowRight size={17} />
              </Link>
            </div>
          </div>
        )}
        {slug === "events" && (
          <div className="event-list">
            {content.map((c) => (
              <article key={c.id} className="event-row">
                <div className="event-date">
                  <strong>
                    {c.eventDate ? new Date(c.eventDate).getUTCDate() : "--"}
                  </strong>
                  <span>
                    {c.eventDate
                      ? new Date(c.eventDate).toLocaleDateString("en-GB", {
                          month: "short",
                        })
                      : ""}
                  </span>
                </div>
                <div>
                  <h2>{c.title}</h2>
                  <p>{c.summary}</p>
                </div>
                <button
                  className="icon-button"
                  aria-label={`View ${c.title}`}
                  onClick={() => setArticle(c)}
                >
                  <ArrowUpRight />
                </button>
              </article>
            ))}
          </div>
        )}
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
        {slug === "media" && (
          <>
            <div className="tabs">
              {["All", "Photos", "Videos", "Music", "Speeches", "Press"].map(
                (f) => (
                  <button
                    key={f}
                    className={filter === f ? "active" : ""}
                    onClick={() => setFilter(f)}
                  >
                    {f}
                  </button>
                ),
              )}
            </div>
            {["All", "Photos"].includes(filter) && (
              <div className="media-grid">
                {content.map((c) => (
                  <button
                    className="media-item"
                    key={c.id}
                    onClick={() => setPhoto(c)}
                  >
                    <img src={c.image || "/ad-logo.png"} alt={c.title} />
                    <div>
                      <ImageIcon size={16} />
                      <span>{c.title}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {["All", "Music"].includes(filter) && (
              <Link className="media-music-link" href="/music">
                <Music2 size={24} />
                <div>
                  <strong>{t("music")}</strong>
                  <p>{t("musicDescription")}</p>
                </div>
                <ArrowRight size={20} />
              </Link>
            )}
            {["Videos", "Speeches", "Press"].includes(filter) && (
              <EmptyContent />
            )}
            {!content.length && ["All", "Photos"].includes(filter) && (
              <EmptyContent />
            )}
          </>
        )}
        {slug === "contact" && <ContactForm />}
        {["leadership", "policies", "manifesto", "candidates"].includes(
          slug,
        ) && <EmptyContent />}
        {!content.length && ["events", "documents"].includes(slug) && (
          <EmptyContent />
        )}
      </section>
      {article && (
        <Dialog title={article.title} onClose={() => setArticle(null)}>
          <p className="article-body">{article.body}</p>
        </Dialog>
      )}
      {photo && (
        <Dialog title={photo.title} onClose={() => setPhoto(null)}>
          <img
            className="lightbox-image"
            src={photo.image || "/ad-logo.png"}
            alt={photo.title}
          />
          <p>{photo.summary}</p>
        </Dialog>
      )}
    </>
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
