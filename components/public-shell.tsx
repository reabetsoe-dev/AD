"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Menu,
  X,
  Globe,
  ArrowRight,
  LockKeyhole,
} from "lucide-react";
import { usePlatform } from "./platform-provider";
import type { TranslationKey } from "@/lib/translations";
export const publicRoutes = [
  "about",
  "leadership",
  "policies",
  "manifesto",
  "candidates",
  "events",
  "media",
  "music",
  "documents",
  "contact",
] as const;
export function Brand({
  small = false,
  wordmark = false,
}: {
  small?: boolean;
  wordmark?: boolean;
}) {
  return (
    <Link
      className={`brand ${small ? "brand-small" : ""} ${wordmark ? "brand-wordmark" : ""}`}
      href="/"
      aria-label="Alliance of Democrats home"
    >
      <img src="/ad-logo.png" alt="Alliance of Democrats supplied logo" />
      {wordmark ? (
        <span className="brand-wordmark-text">
          <span className="brand-name">
            Alliance of <strong>Democrats</strong>
          </span>
          <span className="brand-subtitle">Lekhotla la Kopano ea Sechaba</span>
        </span>
      ) : (
        <span>
          ALLIANCE OF
          <br />
          <b>DEMOCRATS</b>
        </span>
      )}
    </Link>
  );
}
export function LanguageSwitch() {
  const { lang, setLang } = usePlatform();
  return (
    <div className="language" aria-label="Language">
      <Globe size={14} />
      {(["EN", "ST"] as const).map((l) => (
        <button
          key={l}
          className={lang === l ? "selected" : ""}
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
export function PublicShell({ children }: { children: ReactNode }) {
  const path = usePathname(),
    { t, current, lang } = usePlatform(),
    [open, setOpen] = useState(false);
  const internal = path.startsWith("/admin") || path.startsWith("/portal");
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);
  if (internal) return <>{children}</>;
  return (
    <div className={current ? "has-player" : ""}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div className="top-bar">
        <div className="container top-inner">
          <span>LESOTHO · PELE-FEELA</span>
          <div>
            <Link href="/portal/login">
              <LockKeyhole size={12} />
              {t("portal")}
            </Link>
            <LanguageSwitch />
          </div>
        </div>
      </div>
      <header className="public-header">
        <div className="container header-inner">
          <Brand wordmark />
          <nav aria-label="Main navigation" className="desktop-nav">
            {["home", "about", "events", "media", "music"].map(
              (key) => (
                <Link
                  className={
                    (key === "home" ? path === "/" : path === `/${key}`)
                      ? "active"
                      : ""
                  }
                  key={key}
                  href={key === "home" ? "/" : `/${key}`}
                >
                  {t(key as TranslationKey)}
                </Link>
              ),
            )}
          </nav>
          <Link className="button button-red header-contact" href="/contact">
            {t("contact")}
            <ArrowUpRight size={16} />
          </Link>
          <button
            className="icon-button mobile-menu-button"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <nav
            className="mobile-nav"
            id="mobile-nav"
            aria-label="Mobile navigation"
          >
            {["home", ...publicRoutes].map((key) => (
              <Link
                key={key}
                onClick={() => setOpen(false)}
                href={key === "home" ? "/" : `/${key}`}
              >
                {t(key as TranslationKey)}
                <ArrowRight size={16} />
              </Link>
            ))}
          </nav>
        )}
      </header>
      <main id="main">
        {lang === "ST" && (
          <div className="translation-note">{t("unapproved")}</div>
        )}
        {children}
      </main>
      <footer className="public-footer">
        <div className="container footer-top">
          <div>
            <Brand />
            <p>{t("tagline")}</p>
            <strong>PELE-FEELA</strong>
          </div>
          <div>
            <h3>{t("about")}</h3>
            {["about", "leadership", "policies", "manifesto", "candidates"].map(
              (k) => (
                <Link key={k} href={`/${k}`}>
                  {t(k as TranslationKey)}
                </Link>
              ),
            )}
          </div>
          <div>
            <h3>{t("resources")}</h3>
            {["events", "media", "music", "documents"].map((k) => (
              <Link key={k} href={`/${k}`}>
                {t(k as TranslationKey)}
              </Link>
            ))}
          </div>
          <div>
            <h3>{t("services")}</h3>
            <Link href="/portal/login">{t("portal")}</Link>
            <Link href="/admin">{t("admin")}</Link>
            <Link href="/contact">{t("contact")}</Link>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>
            © {new Date().getFullYear()} Alliance of Democrats · Lesotho
          </span>
          <span>{t("footerNote")}</span>
        </div>
      </footer>
    </div>
  );
}
