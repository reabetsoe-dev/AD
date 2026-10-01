"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, type FormEvent } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Download,
  Upload,
  CheckCircle2,
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  Users,
  Wallet,
  Music2,
  Newspaper,
  CalendarDays,
  Image,
  FileText,
  MapPin,
  ShieldCheck,
  ClipboardList,
  Settings,
  Activity,
  Search,
  LoaderCircle,
  Pencil,
  RefreshCw,
  Trash2,
  UserRoundCheck,
  UserRoundX,
} from "lucide-react";
import { Brand, LanguageSwitch } from "./public-shell";
import { Dialog } from "./dialog";
import { usePlatform } from "./platform-provider";
import type { WorkspaceData } from "@/lib/workspace";
import { money } from "./public-pages";
import type { TranslationKey } from "@/lib/translations";
import { uploadRules } from "@/lib/upload-rules";
type Row = {
  id: string;
  title?: string;
  name?: string;
  summary?: string;
  body?: string;
  image?: string | null;
  storageKey?: string | null;
  kind?: string;
  email?: string;
  role?: string;
  disabled?: boolean;
  assignedConstituencyId?: string | null;
  assignedConstituency?: { name: string };
  constituency?: { name: string };
  code?: string;
  district?: string | null;
  memberNumber?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  membershipStatus?: string;
  reportingPeriod?: string;
  memberCount?: number;
  status?: string;
  expectedAmount?: string;
  reportedAmount?: string;
  verifiedAmount?: string;
  currency?: string;
  paymentReference?: string;
  notes?: string | null;
  verificationNotes?: string | null;
  providerTransactionId?: string;
  amount?: string;
  artist?: string;
  description?: string;
  category?: string;
  downloadType?: string;
  price?: string;
  isPublished?: boolean;
  archived?: boolean;
  eventDate?: string | null;
  createdAt?: string;
  submittedAt?: string;
  action?: string;
  entityType?: string;
  actorUser?: { name: string };
  purchase?: { track: { title: string }; phoneMasked: string };
  _count?: { members?: number; purchases?: number; downloads?: number };
};
const icons: Record<string, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  content: FileText,
  news: Newspaper,
  events: CalendarDays,
  media: Image,
  music: Music2,
  documents: FileText,
  constituencies: MapPin,
  membership: Users,
  submit: Upload,
  collections: Wallet,
  payments: Wallet,
  reports: ClipboardList,
  users: Users,
  audit: ShieldCheck,
  history: ClipboardList,
  account: Settings,
};
const labels: Record<string, TranslationKey> = {
  dashboard: "overview",
  membership: "membership",
  collections: "collections",
  history: "history",
  account: "account",
  news: "news",
  events: "events",
  media: "media",
  music: "music",
  documents: "documents",
};
async function api(
  resource: string,
  body: unknown | FormData,
  method = "POST",
) {
  const isForm = body instanceof FormData;
  const r = await fetch(`/api/internal/${resource}`, {
    method,
    ...(isForm ? {} : { headers: { "Content-Type": "application/json" } }),
    body: isForm ? body : JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok)
    throw new Error(data.error || "Please check the form and try again.");
  return data;
}
export function Workspace({ data }: { data: WorkspaceData }) {
  const { t } = usePlatform(),
    router = useRouter(),
    [menu, setMenu] = useState(false),
    [version, setVersion] = useState(0),
    [rows, setRows] = useState<Row[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [dialog, setDialog] = useState<string | null>(null),
    [edit, setEdit] = useState<Row | null>(null),
    [removeTarget, setRemoveTarget] = useState<Row | null>(null),
    [accessTarget, setAccessTarget] = useState<Row | null>(null),
    [search, setSearch] = useState(""),
    [statusFilter, setStatusFilter] = useState("All"),
    [notice, setNotice] = useState(""),
    [tab, setTab] = useState("members");
  const { area, section, user } = data;
  const resource =
    section === "membership"
      ? area === "admin"
        ? tab
        : "members"
      : section === "submit" || section === "history"
        ? "submissions"
        : section;
  useEffect(() => {
    if (["dashboard", "account"].includes(resource)) return;
    let cancelled = false;
    fetch(`/api/internal/${resource}`, { cache: "no-store" })
      .then(async (r) => {
        const result = await r.json();
        if (!r.ok) throw new Error(result.error);
        if (!cancelled) setRows(result.records || []);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resource, version]);
  function refresh() {
    setLoading(true);
    setVersion((v) => v + 1);
    setError("");
    router.refresh();
  }
  function close() {
    setDialog(null);
    setEdit(null);
    setRemoveTarget(null);
    setAccessTarget(null);
  }
  function saved(message = "Saved successfully.") {
    close();
    setNotice(message);
    refresh();
  }
  function removed(message = "Record permanently deleted.") {
    const removedId = removeTarget?.id;
    if (removedId)
      setRows((current) => current.filter((row) => row.id !== removedId));
    close();
    setNotice(message);
    refresh();
  }
  async function logout() {
    await fetch("/api/auth/sign-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    router.push("/portal/login");
    router.refresh();
  }
  const href = (key: string) =>
    `/${area}${key === "dashboard" ? "" : `/${key}`}`;
  const title = data.nav.find((n) => n.key === section)?.label || "Overview";
  const filtered = rows.filter(
    (r) =>
      JSON.stringify(r).toLowerCase().includes(search.toLowerCase()) &&
      (statusFilter === "All" ||
        r.status === statusFilter ||
        r.membershipStatus === statusFilter),
  );
  const mayCreate =
    (area === "portal" &&
      ["membership", "submit", "collections"].includes(section)) ||
    [
      "music",
      "users",
      "constituencies",
      "content",
      "news",
      "events",
      "media",
      "documents",
    ].includes(section);
  const editableResources = [
    "members",
    "music",
    "users",
    "constituencies",
    "content",
    "news",
    "events",
    "media",
    "documents",
  ];
  function formKind(resourceName: string) {
    return resourceName === "members"
      ? "member"
      : resourceName === "collections"
        ? "collection"
        : resourceName === "submissions"
          ? "submission"
          : resourceName === "music"
            ? "track"
            : resourceName === "users"
              ? "user"
              : resourceName === "constituencies"
                ? "constituency"
                : "content";
  }
  function canEditRow(row: Row) {
    if (resource === "collections")
      return area === "portal" && row.status === "PENDING_VERIFICATION";
    if (resource === "submissions")
      return (
        area === "portal" &&
        ["SUBMITTED", "UNDER_REVIEW"].includes(row.status || "")
      );
    if (resource === "members") return area === "portal" || data.canReview;
    if (resource === "users")
      return (
        row.id !== user.id &&
        (user.role === "SUPER_ADMIN" || row.role !== "SUPER_ADMIN")
      );
    return editableResources.includes(resource);
  }
  function canRemoveRow(row: Row) {
    if (["payments", "reports", "audit"].includes(resource)) return false;
    if (resource === "members") return area === "portal" || data.canReview;
    if (resource === "collections")
      return (
        (area === "portal" || ["ADMIN", "SUPER_ADMIN"].includes(user.role)) &&
        row.status === "PENDING_VERIFICATION"
      );
    if (resource === "submissions")
      return (
        (area === "portal" || data.canReview) && row.status === "SUBMITTED"
      );
    if (resource === "users") return canEditRow(row);
    return editableResources.includes(resource);
  }
  const columns =
    resource === "members"
      ? ["Member", "Member number", "Constituency", "Status"]
      : resource === "submissions"
        ? ["Reporting period", "Constituency", "Members", "Status"]
        : resource === "collections" || resource === "reports"
          ? [
              "Reporting period",
              "Constituency",
              "Reported",
              "Verified",
              "Reference",
              "Status",
            ]
          : resource === "payments"
            ? ["Track", "Amount", "Reference", "Status", "Date"]
            : resource === "music"
              ? ["Track", "Type", "Price", "Downloads", "Status"]
              : resource === "users"
                ? ["User", "Role", "Constituency", "Status"]
                : resource === "constituencies"
                  ? ["Constituency", "Code", "Members", "Status"]
                  : resource === "audit"
                    ? ["Action", "Actor", "Entity", "Date"]
                    : resource === "events"
                      ? ["Title", "Event date", "Status", "Created"]
                      : ["Title", "Type", "Status", "Date"];
  function cells(r: Row) {
    if (resource === "members")
      return [
        <span key="member">
          <strong>
            {r.firstName} {r.lastName}
          </strong>
          {r.phone && <small>{r.phone}</small>}
        </span>,
        r.memberNumber,
        r.constituency?.name,
        <Status key="status" value={r.membershipStatus} />,
      ];
    if (resource === "submissions")
      return [
        r.reportingPeriod,
        r.constituency?.name,
        r.memberCount,
        <Status key="status" value={r.status} />,
      ];
    if (["collections", "reports"].includes(resource))
      return [
        r.reportingPeriod,
        r.constituency?.name,
        money(r.reportedAmount || 0, r.currency),
        r.verifiedAmount ? money(r.verifiedAmount, r.currency) : "--",
        r.paymentReference,
        <Status key="status" value={r.status} />,
      ];
    if (resource === "payments")
      return [
        r.purchase?.track.title,
        money(r.amount || 0, r.currency),
        r.providerTransactionId,
        <Status key="status" value={r.status} />,
        date(r.createdAt),
      ];
    if (resource === "music")
      return [
        <span key="title">
          <strong>{r.title}</strong>
          <small>{r.artist}</small>
        </span>,
        r.downloadType,
        money(r.price || 0, r.currency),
        r._count?.downloads || 0,
        <Status
          key="status"
          value={
            r.archived ? "ARCHIVED" : r.isPublished ? "PUBLISHED" : "DRAFT"
          }
        />,
      ];
    if (resource === "users")
      return [
        <span key="user">
          <strong>{r.name}</strong>
          <small>{r.email}</small>
        </span>,
        r.role?.replaceAll("_", " "),
        r.assignedConstituency?.name || "--",
        <Status key="status" value={r.disabled ? "DISABLED" : "ACTIVE"} />,
      ];
    if (resource === "constituencies")
      return [
        r.name,
        r.code,
        r._count?.members || 0,
        <Status key="status" value="DEMO" />,
      ];
    if (resource === "audit")
      return [
        r.action,
        r.actorUser?.name || "Test customer",
        r.entityType,
        date(r.createdAt),
      ];
    return [
      r.title,
      resource === "events" ? date(r.eventDate || undefined) : r.kind,
      <Status key="status" value={r.isPublished ? "PUBLISHED" : "DRAFT"} />,
      date(r.createdAt),
    ];
  }
  return (
    <div className="workspace">
      <a className="skip-link" href="#workspace-main">
        Skip to content
      </a>
      <aside className={`sidebar ${menu ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <Brand small />
          <button
            className="icon-button sidebar-close"
            aria-label="Close navigation"
            onClick={() => setMenu(false)}
          >
            <X size={19} />
          </button>
        </div>
        <span className="sidebar-label">
          {area === "admin" ? "ADMINISTRATION" : "CONSTITUENCY PORTAL"}
        </span>
        <nav aria-label={`${area} navigation`}>
          {data.nav.map((item) => {
            const Icon = icons[item.key] || FileText;
            return (
              <Link
                className={item.key === section ? "active" : ""}
                key={item.key}
                href={href(item.key)}
                onClick={() => {
                  setMenu(false);
                  setNotice("");
                  setSearch("");
                  setStatusFilter("All");
                  setRows([]);
                  setLoading(true);
                  setError("");
                }}
              >
                <Icon size={18} />
                {labels[item.key] ? t(labels[item.key]) : item.label}
                {item.key === section && <span className="nav-active-dot" />}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/">
            <ArrowUpRight size={17} />
            Public website
          </Link>
          <span className="sidebar-demo">AD DIGITAL PLATFORM</span>
        </div>
      </aside>
      {menu && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="workspace-body">
        <header className="workspace-header">
          <div>
            <button
              className="icon-button workspace-menu"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu size={21} />
            </button>
            <span className="workspace-breadcrumb">
              {area === "admin" ? t("admin") : t("portal")}
              <span>/</span>
              <strong>{title}</strong>
            </span>
          </div>
          <div>
            <LanguageSwitch />
            <span className="user-avatar">
              {user.name
                .split(" ")
                .slice(0, 2)
                .map((s) => s[0])
                .join("")}
            </span>
            <div className="user-label">
              <strong>{user.name}</strong>
              <span>{user.role.replaceAll("_", " ")}</span>
            </div>
            <button
              className="icon-button"
              onClick={logout}
              aria-label={t("signOut")}
              title={t("signOut")}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="workspace-main" id="workspace-main">
          <div className="workspace-title">
            <div>
              <span className="eyebrow">
                {area === "admin" ? "AD DIGITAL PLATFORM" : t("assigned")}
              </span>
              <h1>
                {section === "dashboard"
                  ? `${t("greeting")}, ${user.name.replace("Demo ", "")}`
                  : title}
              </h1>
              <p>
                {area === "portal"
                  ? user.constituency
                  : "Administration & constituency services"}
              </p>
            </div>
            <span className="badge">{t("synthetic")}</span>
          </div>
          {notice && (
            <div className="success-notice" role="status">
              <CheckCircle2 size={17} />
              {notice}
              <button
                className="icon-button"
                aria-label="Dismiss notice"
                onClick={() => setNotice("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {section === "dashboard" ? (
            <>
              <div className="metric-grid">
                {data.metrics.map((metric, index) => (
                  <div className="metric" key={metric.label}>
                    <div>
                      <span>{metric.label}</span>
                      {index % 2 === 0 ? (
                        <Users size={18} />
                      ) : (
                        <Activity size={18} />
                      )}
                    </div>
                    <strong>{metric.value}</strong>
                    <small>{metric.detail}</small>
                  </div>
                ))}
              </div>
              <div className="workspace-dashboard-lower">
                <section className="work-section">
                  <div className="section-heading">
                    <h2>
                      {area === "portal" ? "Your constituency" : "Workspace"}
                    </h2>
                  </div>
                  <div className="workspace-shortcuts">
                    {data.nav
                      .filter(
                        (n) => n.key !== "dashboard" && n.key !== "account",
                      )
                      .slice(0, 6)
                      .map((n) => {
                        const Icon = icons[n.key] || FileText;
                        return (
                          <Link key={n.key} href={href(n.key)}>
                            <Icon size={20} />
                            <div>
                              <strong>{n.label}</strong>
                              <span>
                                {area === "portal"
                                  ? "Your assigned constituency"
                                  : "Manage records"}
                              </span>
                            </div>
                            <ArrowRight size={17} />
                          </Link>
                        );
                      })}
                  </div>
                </section>
                <section className="work-section status-section">
                  <span className="eyebrow">PLATFORM STATUS</span>
                  <h2>Platform overview</h2>
                  <div>
                    <CheckCircle2 size={17} />
                    Public website
                  </div>
                  <div>
                    <CheckCircle2 size={17} />
                    Constituency access controls
                  </div>
                  <div>
                    <CheckCircle2 size={17} />
                    Simulated M-Pesa payments
                  </div>
                  <div>
                    <ShieldCheck size={17} />
                    Fictional records only
                  </div>
                  <p>
                    Collections require an independent Finance review. Simulated
                    payments do not transfer money.
                  </p>
                </section>
              </div>
            </>
          ) : section === "account" ? (
            <section className="account-section work-section">
              <h2>{user.name}</h2>
              <dl>
                <dt>Email</dt>
                <dd>{user.email}</dd>
                <dt>Role</dt>
                <dd>{user.role.replaceAll("_", " ")}</dd>
                <dt>Assigned constituency</dt>
                <dd>{user.constituency}</dd>
                <dt>Environment</dt>
                <dd>Test records and simulated payments</dd>
              </dl>
              <button className="button button-outline" onClick={logout}>
                <LogOut size={16} />
                {t("signOut")}
              </button>
            </section>
          ) : (
            <>
              {section === "membership" && area === "admin" && (
                <div className="tabs">
                  <button
                    className={tab === "members" ? "active" : ""}
                    onClick={() => {
                      setTab("members");
                      setRows([]);
                      setLoading(true);
                    }}
                  >
                    Members
                  </button>
                  <button
                    className={tab === "submissions" ? "active" : ""}
                    onClick={() => {
                      setTab("submissions");
                      setRows([]);
                      setLoading(true);
                    }}
                  >
                    Submissions
                  </button>
                </div>
              )}
              {section === "submit" && (
                <div className="inline-submission">
                  <div>
                    <ClipboardList size={25} />
                    <div>
                      <h2>Submit a membership report</h2>
                      <p>{user.constituency} · Current membership snapshot</p>
                    </div>
                  </div>
                  <button
                    className="button button-red"
                    onClick={() => setDialog("submission")}
                  >
                    <Upload size={16} />
                    Submit report
                  </button>
                </div>
              )}
              <div className="workspace-toolbar">
                <div className="search-input">
                  <Search size={17} />
                  <input
                    aria-label="Search records"
                    placeholder="Search records..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                {[
                  "collections",
                  "payments",
                  "reports",
                  "members",
                  "submissions",
                ].includes(resource) && (
                  <select
                    aria-label="Status filter"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option>All</option>
                    {[
                      ...new Set(
                        rows
                          .map((r) => r.status || r.membershipStatus)
                          .filter(Boolean),
                      ),
                    ].map((s) => (
                      <option key={s} value={s}>
                        {s?.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                )}
                <div className="toolbar-actions">
                  <button
                    className="icon-button"
                    title="Refresh records"
                    aria-label="Refresh records"
                    onClick={refresh}
                  >
                    <RefreshCw size={17} />
                  </button>
                  <a
                    className="icon-button"
                    title="Export CSV"
                    aria-label="Export CSV"
                    href={`/api/internal/${resource}?export=csv`}
                  >
                    <Download size={18} />
                  </a>
                  {section === "membership" && area === "portal" && (
                    <button
                      className="button button-outline"
                      onClick={() => setDialog("import")}
                    >
                      <Upload size={16} />
                      Import CSV
                    </button>
                  )}
                  {mayCreate && section !== "submit" && (
                    <button
                      className="button button-red"
                      onClick={() => {
                        setEdit(null);
                        setDialog(formKind(resource));
                      }}
                    >
                      <Plus size={17} />
                      {section === "membership"
                        ? "Add member"
                        : section === "collections"
                          ? "New report"
                          : section === "music"
                            ? "Add track"
                            : section === "events"
                              ? "Add event"
                              : "Create"}
                    </button>
                  )}
                </div>
              </div>
              {section === "collections" && (
                <div className="finance-note">
                  <ShieldCheck size={16} />
                  {area === "portal"
                    ? "Payment references are submitted for independent verification."
                    : "SIMULATED VERIFICATION · No real money is transferred."}
                </div>
              )}
              {resource === "reports" && (
                <div className="report-totals">
                  <span>
                    Reported{" "}
                    <strong>
                      {money(
                        filtered.reduce(
                          (sum, r) => sum + Number(r.reportedAmount || 0),
                          0,
                        ),
                        filtered[0]?.currency,
                      )}
                    </strong>
                  </span>
                  <span>
                    Verified{" "}
                    <strong>
                      {money(
                        filtered.reduce(
                          (sum, r) => sum + Number(r.verifiedAmount || 0),
                          0,
                        ),
                        filtered[0]?.currency,
                      )}
                    </strong>
                  </span>
                  <span>
                    Difference{" "}
                    <strong>
                      {money(
                        filtered.reduce(
                          (sum, r) =>
                            sum +
                            Number(r.reportedAmount || 0) -
                            Number(r.verifiedAmount || 0),
                          0,
                        ),
                        filtered[0]?.currency,
                      )}
                    </strong>
                  </span>
                </div>
              )}
              <div className="table-wrap" aria-busy={loading}>
                <table>
                  <thead>
                    <tr>
                      {columns.map((c) => (
                        <th key={c} scope="col">
                          {c}
                        </th>
                      ))}
                      <th scope="col" className="table-action">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => (
                      <tr key={row.id}>
                        {cells(row).map((cell, i) => (
                          <td key={i} data-label={columns[i]}>
                            {cell ?? "--"}
                          </td>
                        ))}
                        <td className="table-action">
                          <div className="row-actions">
                            {resource === "collections" &&
                              data.canVerify &&
                              row.status === "PENDING_VERIFICATION" && (
                                <button
                                  className="button button-outline button-sm"
                                  onClick={() => {
                                    setEdit(row);
                                    setDialog("verify");
                                  }}
                                >
                                  Review
                                  <ArrowRight size={14} />
                                </button>
                              )}
                            {resource === "submissions" &&
                              data.canReview &&
                              row.status !== "ACCEPTED" && (
                                <button
                                  className="button button-outline button-sm"
                                  onClick={() => {
                                    setEdit(row);
                                    setDialog("review");
                                  }}
                                >
                                  Review
                                </button>
                              )}
                            {canEditRow(row) && (
                              <button
                                className="button button-outline button-sm"
                                title={`Edit ${rowName(row)}`}
                                onClick={() => {
                                  setEdit(row);
                                  setDialog(formKind(resource));
                                }}
                              >
                                <Pencil size={14} />
                                Edit
                              </button>
                            )}
                            {resource === "users" && canEditRow(row) && (
                              <button
                                className="button button-outline button-sm"
                                title={`${row.disabled ? "Enable" : "Disable"} ${rowName(row)}`}
                                onClick={() => setAccessTarget(row)}
                              >
                                {row.disabled ? (
                                  <UserRoundCheck size={14} />
                                ) : (
                                  <UserRoundX size={14} />
                                )}
                                {row.disabled ? "Enable" : "Disable"}
                              </button>
                            )}
                            {canRemoveRow(row) && (
                              <button
                                className="button button-danger button-sm"
                                title={`Permanently delete ${rowName(row)}`}
                                onClick={() => setRemoveTarget(row)}
                              >
                                <Trash2 size={14} />
                                Remove
                              </button>
                            )}
                            {resource === "users" && !canEditRow(row) && (
                              <span className="muted">
                                {row.id === user.id
                                  ? "Your account"
                                  : "Super Admin only"}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {loading && (
                  <div className="loading-state" role="status">
                    <LoaderCircle className="spin" size={18} />
                    Loading records...
                  </div>
                )}
                {!loading && !filtered.length && (
                  <div className="empty-state compact">
                    <ClipboardList size={27} />
                    <h2>No records to display</h2>
                    <p>
                      {search || statusFilter !== "All"
                        ? "Try a different search or filter."
                        : "Records will appear here when they are available."}
                    </p>
                  </div>
                )}
              </div>
              <div className="table-footer">
                {filtered.length} record{filtered.length === 1 ? "" : "s"} ·
                SAMPLE RECORDS
              </div>
            </>
          )}
        </main>
        <footer className="workspace-footer">
          Alliance of Democrats · AD Digital Platform
        </footer>
      </div>
      {dialog === "import" ? (
        <ImportDialog onClose={close} onSaved={saved} />
      ) : (
        dialog && (
          <RecordForm
            kind={dialog}
            resource={resource}
            row={edit}
            data={data}
            onClose={close}
            onSaved={saved}
          />
        )
      )}
      {removeTarget && (
        <RemoveDialog
          resource={resource}
          row={removeTarget}
          onClose={close}
          onRemoved={removed}
        />
      )}
      {accessTarget && (
        <RemoveDialog
          resource="users"
          row={accessTarget}
          userAccess
          onClose={close}
          onRemoved={saved}
        />
      )}
    </div>
  );
}
function date(value?: string) {
  return value
    ? new Date(value).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "--";
}
function Status({ value }: { value?: string }) {
  return (
    <span className={`status status-${value?.toLowerCase() || "draft"}`}>
      {value?.replaceAll("_", " ") || "DRAFT"}
    </span>
  );
}
function rowName(row: Row) {
  if (row.title) return row.title;
  if (row.firstName || row.lastName)
    return `${row.firstName || ""} ${row.lastName || ""}`.trim();
  if (row.name) return row.name;
  if (row.reportingPeriod) return row.reportingPeriod;
  if (row.paymentReference) return row.paymentReference;
  return "this record";
}
function dateTimeLocal(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
function RemoveDialog({
  resource,
  row,
  userAccess = false,
  onClose,
  onRemoved,
}: {
  resource: string;
  row: Row;
  userAccess?: boolean;
  onClose: () => void;
  onRemoved: (message?: string) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const userRemoval = resource === "users",
    enableUser = userAccess && row.disabled,
    trackRemoval = resource === "music",
    title = userAccess
      ? enableUser
        ? "Enable user"
        : "Disable user"
      : userRemoval
        ? "Remove user"
        : trackRemoval
          ? "Remove track"
          : "Remove record";
  async function remove() {
    setBusy(true);
    setError("");
    try {
      const result = await api(
        resource,
        userAccess ? { id: row.id, disabled: !row.disabled } : { id: row.id },
        userAccess ? "PATCH" : "DELETE",
      );
      onRemoved(
        result.message ||
          (userAccess
            ? enableUser
              ? "User enabled."
              : "User disabled and sessions revoked."
            : "Record permanently deleted."),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not remove this record.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title={title} onClose={onClose}>
      <div className="form">
        <div className="remove-summary">
          {userAccess ? (
            enableUser ? (
              <UserRoundCheck size={20} />
            ) : (
              <UserRoundX size={20} />
            )
          ) : (
            <Trash2 size={20} />
          )}
          <div>
            <strong>{rowName(row)}</strong>
            <p>
              {userAccess
                ? enableUser
                  ? "This user will be able to sign in again with their existing account."
                  : "This user will lose access immediately. Their history stays in the audit log."
                : userRemoval
                  ? "This permanently deletes the account and sign-in credentials, and ends active sessions. Submitted reports must be removed or reassigned first. This cannot be undone."
                  : trackRemoval
                    ? "This permanently deletes the track, its downloads, purchases, payment transactions, and download access. This cannot be undone."
                    : "This permanently deletes the record. This cannot be undone."}
            </p>
          </div>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="button button-outline"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button button-red"
            disabled={busy}
            onClick={remove}
          >
            {busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <Trash2 size={17} />
            )}
            {userAccess
              ? enableUser
                ? "Enable user"
                : "Disable user"
              : "Remove"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
function RecordForm({
  kind,
  resource,
  row,
  data,
  onClose,
  onSaved,
}: {
  kind: string;
  resource: string;
  row: Row | null;
  data: WorkspaceData;
  onClose: () => void;
  onSaved: (message?: string) => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [type, setType] = useState(row?.downloadType || "FREE"),
    [role, setRole] = useState(row?.role || "SECRETARY_GENERAL");
  const title =
    kind === "verify"
      ? "Review collection"
      : kind === "review"
        ? "Review membership submission"
        : kind === "submission"
          ? "Submit membership report"
          : `${row ? "Edit" : "New"} ${kind === "content" && resource === "events" ? "event" : kind}`;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const form = new FormData(e.currentTarget);
      if (row) form.set("id", row.id);
      if (data.cloudUploads && (kind === "track" || kind === "content")) {
        const { upload } = await import("@vercel/blob/client");
        for (const [field, category, isPublic] of [
          ["audio", "audio", false],
          ["preview", "audio", true],
          ["artwork", "image", true],
          ["attachment", "document", false],
        ] as const) {
          const file = form.get(field);
          if (!(file instanceof File) || !file.size) continue;
          const rules = uploadRules[category];
          const extension = file.name
            .slice(file.name.lastIndexOf("."))
            .toLowerCase();
          if (
            !rules.types.includes(file.type) ||
            !rules.extensions.includes(extension) ||
            file.size > rules.limit
          )
            throw new Error(`Invalid ${category} file type or size.`);
          const pathname = `${isPublic ? "public" : "private"}/${category}/${data.user.id}/${crypto.randomUUID()}${extension}`;
          const blob = await upload(pathname, file, {
            access: "private",
            handleUploadUrl: "/api/internal/uploads",
            contentType: file.type,
            multipart: true,
            clientPayload: JSON.stringify({ category, isPublic }),
          });
          form.set(field, blob.pathname);
        }
      }
      let endpoint = resource;
      let body: unknown = form;
      const isEventContent = kind === "content" && resource === "events";
      if (kind === "track" || isEventContent) {
        form.set("isPublished", form.has("isPublished") ? "true" : "");
        if (kind === "track")
          form.set("archived", form.has("archived") ? "true" : "");
      } else {
        const values: Record<string, unknown> = Object.fromEntries(form);
        ["isPublished", "disabled"].forEach((key) => {
          if (form.has(key)) values[key] = form.get(key) === "true";
        });
        if (kind === "user") {
          values.disabled = form.get("disabled") === "true";
          if (!values.password) delete values.password;
          values.assignedConstituencyId = values.assignedConstituencyId || null;
        }
        if (kind === "content")
          values.isPublished = form.get("isPublished") === "true";
        body = values;
      }
      if (kind === "member") endpoint = "members";
      if (kind === "collection" || kind === "verify") endpoint = "collections";
      if (kind === "submission" || kind === "review") endpoint = "submissions";
      if (kind === "track") endpoint = "music";
      await api(endpoint, body);
      onSaved(
        kind === "verify"
          ? "Collection simulation reviewed. No money transferred."
          : kind === "submission"
            ? "Membership snapshot submitted for review."
            : kind === "collection"
              ? "Collection submitted. Status: pending verification."
              : "Record saved successfully.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this record.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title={title} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {kind === "member" && (
          <>
            <label>
              Member number
              <input
                name="memberNumber"
                defaultValue={row?.memberNumber}
                required
                maxLength={40}
                pattern="[A-Za-z0-9-]+"
              />
            </label>
            <div className="form-grid">
              <label>
                First name
                <input
                  name="firstName"
                  defaultValue={row?.firstName}
                  required
                  maxLength={80}
                />
              </label>
              <label>
                Last name
                <input
                  name="lastName"
                  defaultValue={row?.lastName}
                  required
                  maxLength={80}
                />
              </label>
            </div>
            <label>
              Phone (optional)
              <input
                name="phone"
                defaultValue={row?.phone}
                inputMode="tel"
                maxLength={24}
              />
            </label>
            <label>
              Membership status
              <select
                name="membershipStatus"
                defaultValue={row?.membershipStatus || "ACTIVE"}
              >
                <option>ACTIVE</option>
                <option>INACTIVE</option>
              </select>
            </label>
            <p className="form-note">
              {data.user.constituency} · Fictional records only
            </p>
          </>
        )}
        {["collection", "submission"].includes(kind) && (
          <>
            <label>
              Reporting period
              <input
                name="reportingPeriod"
                defaultValue={row?.reportingPeriod || ""}
                placeholder="October 2026"
                required
                maxLength={80}
              />
            </label>
            {kind === "collection" && (
              <>
                <label>
                  Collected amount ({data.currency})
                  <input
                    name="amount"
                    type="number"
                    defaultValue={row?.reportedAmount || row?.expectedAmount}
                    min="0.01"
                    max="1000000"
                    step="0.01"
                    required
                  />
                </label>
                <label>
                  Test M-Pesa reference
                  <input
                    name="paymentReference"
                    defaultValue={row?.paymentReference || ""}
                    placeholder="DEMO-COLLECTION-002"
                    required
                    minLength={4}
                    maxLength={120}
                  />
                </label>
                <div className="finance-note">
                  <ShieldCheck size={16} />
                  Pending independent Finance verification
                </div>
              </>
            )}
            <label>
              Notes (optional)
              <textarea
                name="notes"
                defaultValue={row?.notes || ""}
                rows={3}
                maxLength={1000}
              />
            </label>
            <p className="form-note">
              {data.user.constituency} · Fictional records only
            </p>
          </>
        )}
        {kind === "verify" && (
          <>
            <div className="demo-payment-banner">
              <ShieldCheck size={19} />
              <div>
                <strong>SIMULATED VERIFICATION</strong>
                <span>No real payment is being verified.</span>
              </div>
            </div>
            <div className="review-summary">
              <span>
                Reference<strong>{row?.paymentReference}</strong>
              </span>
              <span>
                Reported amount
                <strong>
                  {money(row?.reportedAmount || 0, row?.currency)}
                </strong>
              </span>
            </div>
            <label>
              Decision
              <select name="status" defaultValue={row?.status || "VERIFIED"}>
                <option value="VERIFIED">Verified (simulation)</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </label>
            <label>
              Verified amount
              <input
                name="verifiedAmount"
                type="number"
                defaultValue={row?.reportedAmount}
                min={0}
                max={1000000}
                step="0.01"
                required
              />
            </label>
            <label>
              Verification notes
              <textarea
                name="verificationNotes"
                defaultValue={row?.verificationNotes || ""}
                required
                minLength={5}
                maxLength={1000}
                rows={3}
                placeholder="Simulation review; no actual money transferred."
              />
            </label>
          </>
        )}
        {kind === "review" && (
          <>
            <p>
              {row?.reportingPeriod} · {row?.memberCount} members
            </p>
            <label>
              Decision
              <select
                name="status"
                defaultValue={row?.status || "UNDER_REVIEW"}
              >
                <option value="UNDER_REVIEW">Under review</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </label>
            <label>
              Review notes
              <textarea
                name="notes"
                defaultValue={row?.notes || ""}
                required
                maxLength={1000}
                rows={3}
              />
            </label>
          </>
        )}
        {kind === "track" && (
          <>
            <label>
              Title
              <input
                name="title"
                defaultValue={row?.title}
                required
                maxLength={120}
              />
            </label>
            <label>
              Artist
              <input
                name="artist"
                defaultValue={row?.artist || ""}
                required
                maxLength={100}
              />
            </label>
            <label>
              Description
              <textarea
                name="description"
                defaultValue={row?.description || ""}
                rows={3}
                maxLength={2000}
              />
            </label>
            <div className="form-grid">
              <label>
                Category
                <input
                  name="category"
                  defaultValue={row?.category || "Instrumental"}
                  required
                  maxLength={60}
                />
              </label>
              <label>
                Download type
                <select
                  name="downloadType"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option>FREE</option>
                  <option>PAID</option>
                </select>
              </label>
            </div>
            <label>
              Price
              <input
                name="price"
                type="number"
                defaultValue={row?.price || 0}
                min={type === "PAID" ? 0.01 : 0}
                max={100000}
                step=".01"
                required
              />
            </label>
            <label>
              Full audio (private, max 30 MB)
              <input
                type="file"
                name="audio"
                accept=".wav,.mp3,.ogg"
                required={!row}
              />
            </label>
            <label>
              Preview audio (public, max 30 MB)
              <input
                type="file"
                name="preview"
                accept=".wav,.mp3,.ogg"
                required={!row}
              />
            </label>
            <label>
              Artwork (PNG, JPG, WebP, max 5 MB)
              <input
                type="file"
                name="artwork"
                accept=".png,.jpg,.jpeg,.webp"
              />
            </label>
            <label className="checkbox-label">
              <input
                name="isPublished"
                type="checkbox"
                defaultChecked={row?.isPublished}
              />
              Published
            </label>
            {row && (
              <label className="checkbox-label">
                <input
                  name="archived"
                  type="checkbox"
                  defaultChecked={row.archived}
                />
                Archived
              </label>
            )}
          </>
        )}
        {kind === "user" && (
          <>
            <label>
              Name
              <input
                name="name"
                defaultValue={row?.name}
                required
                maxLength={100}
              />
            </label>
            <label>
              Email
              <input
                name="email"
                type="email"
                defaultValue={row?.email}
                required
              />
            </label>
            <label>
              Role
              <select
                name="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {[
                  ...(data.user.role === "SUPER_ADMIN" ? ["SUPER_ADMIN"] : []),
                  "ADMIN",
                  "FINANCE_OFFICER",
                  "MEDIA_MANAGER",
                  "EDITOR",
                  "SECRETARY_GENERAL",
                  "AUDITOR",
                ].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            {role === "SECRETARY_GENERAL" && (
              <label>
                Assigned constituency
                <select
                  name="assignedConstituencyId"
                  defaultValue={row?.assignedConstituencyId || ""}
                  required
                >
                  <option value="">Select a constituency</option>
                  {data.constituencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              {row ? "New temporary password (optional)" : "Temporary password"}
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={128}
                required={!row}
                autoComplete="new-password"
              />
            </label>
            {row && (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="disabled"
                  value="true"
                  defaultChecked={row.disabled}
                />
                Disabled
              </label>
            )}
            <p className="form-note">
              Changes revoke existing sessions. Invite email is not configured.
            </p>
          </>
        )}
        {kind === "constituency" && (
          <>
            <label>
              Name
              <input
                name="name"
                defaultValue={row?.name || ""}
                placeholder="Demonstration Constituency C"
                required
                maxLength={100}
              />
            </label>
            <label>
              Demo code
              <input
                name="code"
                defaultValue={row?.code || ""}
                placeholder="DEMO-C"
                pattern="DEMO-[A-Z0-9-]+"
                required
              />
            </label>
            <label>
              District (optional)
              <input
                name="district"
                defaultValue={row?.district || ""}
                maxLength={100}
              />
            </label>
          </>
        )}
        {kind === "content" && (
          <>
            <label>
              Title
              <input
                name="title"
                defaultValue={row?.title}
                required
                maxLength={200}
              />
            </label>
            <label>
              Summary
              <textarea
                name="summary"
                defaultValue={row?.summary}
                required
                maxLength={500}
                rows={2}
              />
            </label>
            <label>
              Content
              <textarea
                name="body"
                defaultValue={row?.body}
                required
                maxLength={20000}
                rows={5}
              />
            </label>
            {resource === "events" && (
              <>
                <label>
                  Event date
                  <input
                    name="eventDate"
                    type="datetime-local"
                    defaultValue={dateTimeLocal(row?.eventDate)}
                  />
                </label>
                <label>
                  Upload file (PDF, max 10 MB)
                  <input
                    name="attachment"
                    type="file"
                    accept=".pdf,application/pdf"
                  />
                </label>
                {row?.storageKey && (
                  <p className="form-note">
                    Existing file will be kept unless a new one is selected.
                  </p>
                )}
              </>
            )}
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="isPublished"
                value="true"
                defaultChecked={row?.isPublished}
              />
              Published
            </label>
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="button button-outline"
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="button button-red" disabled={busy}>
            {busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <CheckCircle2 size={17} />
            )}{" "}
            {kind === "verify"
              ? "Save decision"
              : kind === "submission" && !row
                ? "Submit report"
                : row
                  ? "Save changes"
                  : "Save"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
function ImportDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (message?: string) => void;
}) {
  const [csv, setCsv] = useState(""),
    [preview, setPreview] = useState<{
      rows: { memberNumber: string; firstName: string; lastName: string }[];
      errors: { row: number; message: string }[];
      valid: boolean;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function validate(confirm = false) {
    setBusy(true);
    setError("");
    try {
      const result = await api("import", { csv, confirm });
      if (confirm) onSaved(`Imported ${result.count} fictional members.`);
      else setPreview(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }
  function downloadErrors() {
    if (!preview) return;
    const blob = new Blob(
      [
        "row,error\n" +
          preview.errors
            .map((e) => `${e.row},"${e.message.replaceAll('"', '""')}"`)
            .join("\n"),
      ],
      { type: "text/csv" },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "import-errors.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Dialog title="Import membership CSV" onClose={onClose}>
      <div className="form">
        <a className="text-link" href="/demo-members.csv" download>
          <Download size={16} />
          Download fictional CSV template
        </a>
        <label>
          CSV file (max 1 MB, 500 rows)
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 1024 * 1024) {
                setError("Maximum file size is 1 MB.");
                return;
              }
              setCsv(await file.text());
              setPreview(null);
              setError("");
            }}
          />
        </label>
        <button
          className="button button-outline"
          disabled={!csv || busy}
          onClick={() => validate()}
        >
          <ShieldCheck size={17} />
          Validate & preview
        </button>
        {preview && (
          <>
            {preview.errors.length ? (
              <div className="import-errors" role="alert">
                <strong>{preview.errors.length} validation error(s)</strong>
                {preview.errors.map((e, i) => (
                  <p key={i}>
                    Row {e.row}: {e.message}
                  </p>
                ))}
                <button className="text-link" onClick={downloadErrors}>
                  <Download size={16} />
                  Download error report
                </button>
              </div>
            ) : (
              <div className="success-notice">
                <CheckCircle2 size={17} />
                {preview.rows.length} valid fictional records
              </div>
            )}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Member number</th>
                    <th>Name</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 10).map((r) => (
                    <tr key={r.memberNumber}>
                      <td>{r.memberNumber}</td>
                      <td>
                        {r.firstName} {r.lastName}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              className="button button-red"
              disabled={!preview.valid || busy}
              onClick={() => validate(true)}
            >
              {busy ? (
                <LoaderCircle size={17} className="spin" />
              ) : (
                <Upload size={17} />
              )}
              Confirm import
            </button>
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
