"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  LockKeyhole,
  LoaderCircle,
  ShieldCheck,
  Eye,
  EyeOff,
} from "lucide-react";
import { Brand, LanguageSwitch } from "./public-shell";
import { usePlatform } from "./platform-provider";
export function Login({ demo }: { demo: boolean }) {
  const { t } = usePlatform(),
    router = useRouter(),
    [email, setEmail] = useState(demo ? "admin@demo.invalid" : ""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [show, setShow] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe: false }),
      });
      if (!response.ok)
        throw new Error(
          "Sign-in failed. Check your details or try again shortly.",
        );
      const me = await fetch("/api/me").then((r) => r.json());
      router.push(me.role === "SECRETARY_GENERAL" ? "/portal" : "/admin");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <header className="container login-header">
        <Brand />
        <LanguageSwitch />
      </header>
      <main className="login-main">
        <Link className="text-link" href="/">
          <ArrowLeft size={16} />
          Back to website
        </Link>
        <div className="login-title-icon">
          <LockKeyhole size={25} />
        </div>
        <span className="eyebrow">AD DIGITAL PLATFORM</span>
        <h1>{t("signIn")}</h1>
        <p>Administration & constituency services</p>
        {demo && <span className="badge">FICTIONAL TEST ACCOUNTS</span>}
        <form className="form login-form" onSubmit={submit}>
          {demo && (
            <label>
              Test account
              <select value={email} onChange={(e) => setEmail(e.target.value)}>
                <option value="super@demo.invalid">Super Admin</option>
                <option value="admin@demo.invalid">Admin</option>
                <optgroup label="Constituency Portal">
                  {[
                    ["secretary-a", "Secretary General A"],
                    ["secretary-b", "Secretary General B"],
                  ].map(([key, label]) => (
                    <option key={key} value={`${key}@demo.invalid`}>
                      {label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
          )}
          <label>
            {t("email")}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            {t("password")}
            <span className="password-input">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={show ? "text" : "password"}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="icon-button"
                onClick={() => setShow(!show)}
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="button button-red full-width" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <ArrowRight size={18} />
            )}{" "}
            {t("signIn")}
          </button>
        </form>
        <div className="login-security">
          <ShieldCheck size={16} />
          Authorised access only
        </div>
      </main>
      <footer className="login-footer">
        Alliance of Democrats · AD Digital Platform
      </footer>
    </div>
  );
}
