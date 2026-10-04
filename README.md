# AD Digital Platform

A full-stack digital platform for Alliance of Democrats, Lesotho, using the
supplied AD logo. The public interface uses direct platform branding, without
proposal banners. The current local environment still contains fictional
internal records and simulated payments; it must not receive real membership
data or money until the production checklist is completed.

The first version deliberately keeps the screens and implementation small.
Read [DEMO.md](DEMO.md) for the presentation and [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md)
for the implemented scope and remaining work.

## Start on This Computer

Node.js 22 and PostgreSQL 18 are installed on this computer. Setup creates a
separate PostgreSQL cluster inside `.demo/postgres`, listening only on
`127.0.0.1:55432`. It does not change any existing PostgreSQL installation or
database. Local trust authentication is for fictional demo data only.

In PowerShell use `npm.cmd` and `npx.cmd` if script execution is restricted:

```powershell
npm.cmd install
npm.cmd run demo:setup
npm.cmd run dev
```

Open **http://127.0.0.1:3000**. Use that exact host for cookies and login.
The generated demo password is in `.demo/accounts.txt`, an ignored local file.
Use `/portal/login` and select a demo role. No passwords are committed.

The database and records have already been created in this workspace. On later
starts, use `npm.cmd run db:start` followed by `npm.cmd run dev`.
`npm.cmd run db:stop` stops only the project-local database. Stop the app before
regenerating Prisma on Windows because a running app locks its engine DLL.

For an existing PostgreSQL server, configure `DATABASE_URL` in `.env` instead of
running `db:setup`. Copy the names from `.env.example`, supply generated secrets,
then run `db:generate`, `db:migrate` and `db:seed`. The seed refuses to run unless
`DEMO_MODE=true`. Use an isolated demonstration database. On another machine,
set `POSTGRES_BIN` to the PostgreSQL executable directory for the local helper;
its Windows default is `C:/Program Files/PostgreSQL/18/bin`.

## Vercel Deployment

The repository includes `vercel.json` and a `vercel-build` command that
generates Prisma Client, applies committed database migrations, and builds
Next.js. Node.js 22 is selected in `package.json`.

1. Import `reabetsoe-dev/AD` into Vercel and select the `main` branch.
2. Connect a hosted PostgreSQL database, such as Neon, to the project. Set
   `DATABASE_URL` to its pooled connection URL. The local loopback database
   cannot be reached from Vercel.
3. Create and connect a **private** Vercel Blob store. It supplies
   `BLOB_READ_WRITE_TOKEN`. Set `STORAGE_PROVIDER=vercel-blob`.
4. Set `AUTH_SECRET`, `APP_URL` (the HTTPS production domain),
   `DEMO_MODE=true`, `PAYMENT_PROVIDER=mock-mpesa`,
   `PAYMENT_CALLBACK_SECRET`, and `STORE_CURRENCY=LSL` in Vercel's production
   environment. Generate independent secrets for the hosted environment.
5. Transfer existing records and referenced files to the hosted database and
   Blob store, or initialize an isolated demo database with `db:seed` and
   provide its demo audio files. Set `DEMO_SEED_PASSWORD` only when seeding.
   Seeds are deliberately not run on every build, so removed records stay
   removed after redeployment.
6. Deploy and verify public pages, sign-in, uploads, downloads, and removal.

Cloud uploads go directly from the browser to Blob with short-lived tokens
restricted by role, user, path, MIME type, and file size. Saving a record
also verifies the uploaded file signature. Full audio and documents stay
private. Public preview and image routes only serve files referenced by a
record. Downloads stream through the existing authorization checks.

`.env` files, local database files, private storage, and generated uploads are
excluded from Git and Vercel source uploads. Configure secrets through Vercel,
not in the repository. The local development environment continues to use
filesystem storage. Payments remain simulated in this hosted demonstration.

## Architecture

```text
                    AD DIGITAL PLATFORM
                             |
          +------------------+------------------+
          |                  |                  |
     PUBLIC WEBSITE     ADMINISTRATION     CONSTITUENCY PORTAL
     News / Media       Content / Music    Assigned membership
     Music / Resources  Users / Finance    Members / Submissions
          |                  |                  |
          +---------- Next.js server -----------+
                             |
                 Better Auth + Permissions
                             |
                      Prisma / PostgreSQL
                             |
               +-------------+-------------+
               |                           |
         PaymentProvider             StorageProvider
         MockMpesaProvider           LocalStorageProvider
         No real payments            Private authorised audio
```

Next.js App Router, React, TypeScript, Prisma and PostgreSQL provide the runtime.
Better Auth manages passwords and database sessions. Zod validates input;
Papa Parse parses CSV files; Lucide supplies icons. A shared CSS stylesheet is
used instead of adding a Tailwind layer in this first version. There is no
custom cryptography or homemade authentication. Membership forms use pdf-lib
to produce branded A4 landscape PDFs with the Sesotho headings from the supplied
paper form. Constituencies require a branch and district; members require first
name, surname, sex, ID or IEC number, village, membership-card number and phone.
Submissions keep these details as a snapshot and download the completed form.

Routes use Server Components to load public data and authorize workspaces.
Client Components handle forms, dialogs, language preferences and the player.
Sensitive operations run in route handlers. PostgreSQL transactions keep
payment confirmation, imports, submissions and reviews consistent.

## Screens

Public routes: `/`, `/about`, `/leadership`, `/policies`, `/manifesto`,
`/candidates`, `/news`, `/events`, `/media`, `/music`, `/documents`, `/contact`.
Most sections without published content display neutral empty states. Seeded sample
news, events, media, documents and synthesized tracks are unpublished by default
and remain available internally. Publish approved material through Administration.
To unpublish the original samples in an existing local database without deleting
them, run `node scripts/unpublish-samples.mjs`. The cleanup matches only the
known sample identifiers and titles and records the changes in the audit log.

About AD (`/about`) now focuses on **The Manifesto**. `/manifesto` shows the same
manifesto content. The page retains the manifesto overview until an approved
edition is published in `/admin/manifesto`. Editors can enter its title, summary
and full text, attach a PDF, and publish or unpublish it. The newest published
edition appears on both public pages. Draft editions and their attachments are
not publicly accessible; uploaded PDFs are served only while published.

Administration: `/admin`, `/admin/content`, `/admin/news`, `/admin/events`,
`/admin/media`, `/admin/music`, `/admin/documents`, `/admin/manifesto`, `/admin/constituencies`,
`/admin/membership`, `/admin/collections`, `/admin/payments`, `/admin/reports`,
`/admin/users`, `/admin/audit`. Unauthorized sections return a not-found page;
their APIs return 403. Anonymous workspace visits redirect to login.

Constituency: `/portal`, `/portal/membership`, `/portal/submit`,
`/portal/collections`, `/portal/history`, `/portal/account`.
`/portal/login` is the unified login; `/admin/login` redirects there.

EN/ST uses a central dictionary in `lib/translations.ts`. Navigation and core
public labels are translated; administrative text is partially translated.
Sample articles and some operational labels remain English. Sesotho is
draft text and requires an official language review. Only the language
preference uses browser storage; membership records do not.

## Roles and Isolation

| Role              | Scope                                                                  |
| ----------------- | ---------------------------------------------------------------------- |
| SUPER_ADMIN       | All permissions; can manage Super Admins                               |
| ADMIN             | Publishing, media/music, users, constituencies, membership review, finance verification and audit |
| FINANCE_OFFICER   | Finance read and independent collection verification                   |
| MEDIA_MANAGER     | Media and music; no Finance or membership                              |
| EDITOR            | Public content                                                         |
| SECRETARY_GENERAL | Assigned constituency membership, submissions and collections          |
| AUDITOR           | Finance and audit read                                                 |

`lib/permissions.ts` is the central permission map. The database user is loaded
after session authentication on every protected operation; browser-supplied
roles and constituency IDs cannot grant access. Constituency queries always
derive their scope from `user.assignedConstituencyId`. Normal Admins cannot
manage Super Admins. User updates revoke sessions, and self-modification in the
management screen is blocked. Login has database-backed rate limits.

## Membership and Finance

Members require name, sex, ID or IEC number, village, membership-card number
and phone, alongside membership status and joining timestamps.
The portal membership screen supports manual add/edit without exposing the old
CSV import workflow. The server-side import parser remains covered for
controlled data-loading paths and keeps private source files outside `/public`.

The public home page includes **Check Voter Registration** beside **Discover
AD**, available without signing in. It opens the
[official IEC Lesotho self-service portal](https://selfreg.iec.org.ls/)
in a separate tab without passing identity details or a referrer. The IEC
portal provides the result through its **Check Your Status** action. Automatic
verification would require a documented IEC API and access supplied by IEC.

Submissions preserve a member snapshot and count. Subsequent member changes do
not change that snapshot. Admin review changes status and writes an audit
event, with review notes in safe metadata.

Collection entry always creates `PENDING_VERIFICATION`. A typed reference does
not verify anything. Administrator, Finance Officer or Super Admin can simulate independent approval
or rejection, with notes, verifier and timestamp. Reports preserve expected,
reported and verified amounts separately. Final decisions cannot be silently
replaced. Reconciliation is a basic collection summary, not a full accounting
ledger. Supporting-document uploads and post-verification adjustment workflows
are deferred. PDF exports require the same role and constituency checks and
are audited.

## Music and Payments

The store includes search, FREE/PAID and category filters, artwork, previews,
prices, a persistent mini-player, seek, mute, volume, previous/next and playlist.
It never starts playback without an interaction. Seed audio is synthesised demo
instrumental sound, not an official song.

Full audio is stored under `private-storage/audio`, never `/public/audio`.
Only short previews and artwork are public. Free downloads use a controlled
endpoint and record analytics. Paid downloads require a successful purchase,
successful server-side transaction and entitlement matching an opaque purchase
cookie. That cookie is HttpOnly and SameSite=Strict; only its hash is stored in
the database. Losing the cookie loses access in this simple demo; production
purchase recovery is a later feature.

Checkout creates a PENDING payment. The clearly labelled demo control simulates
a signed provider event. The server verifies its signature, timestamp,
reference, amount, currency and purchase before granting entitlement. Unique
transaction references, a unique entitlement per purchase, transactions and
conditional status updates make duplicate confirmation idempotent. Failed
payments grant no download. There is no public invented M-Pesa webhook or API.

`PaymentProvider` defines initiate, verify, callback and status methods.
`MockMpesaProvider` is the only implementation. Replace it with an authorised
provider using the actual provider's specifications, credentials and callback
verification. Add provider-specific environment names only when known.
The current Finance simulation refuses to verify outside demo mode.

`StorageProvider` supports private storage and explicitly public images or
previews. Uploads check MIME, extension, size and file signatures; generated
keys prevent original filenames becoming paths. Private downloads stream
through authorization, rather than returning permanent public URLs. Vercel
Blob supplies durable private object storage for cloud deployments. Signed
download URLs remain deferred.

## Database and Environment

Prisma models: User, Session, Account, Verification, RateLimit, Constituency,
Member, MembershipSubmission, CollectionReport, Track, MusicPurchase,
PaymentTransaction, DownloadEntitlement, Download, Content and AuditLog.
A role enum supplies RBAC. Content represents news, events, media and documents
in a small shared model rather than separate CMS modules. Financial fields use
decimal database types. Foreign keys, indexes and unique constraints are in
`prisma/schema.prisma`; the initial SQL migration is checked in.

Required local environment: `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`,
`DEMO_MODE`, `DEMO_SEED_PASSWORD`, `PAYMENT_PROVIDER`,
`PAYMENT_CALLBACK_SECRET`, `STORE_CURRENCY`, `STORAGE_PROVIDER`, `STORAGE_ROOT`.
Cloud storage settings are in `.env.example`. Real secrets
are generated locally, ignored and never exposed through the UI. The helper
does not replace an existing `.env`. Seed runs preserve existing accounts and
most records; changing `DEMO_SEED_PASSWORD` does not reset existing passwords.
Use the authorized user-management screen for resets.

## Verification

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
node scripts/check-ui.mjs
```

The app and local demo database must be running for integration and browser
tests. Run the suites sequentially: both exercise the same login rate limit.
`npm test` uses actual HTTP endpoints and temporary fictional test
records; it cleans up those records afterwards. It authenticates five roles,
so allow the one-minute login-rate window to expire before immediately
repeating the suite. Windows browser checks use installed Microsoft Edge in
headless mode; other systems need Playwright Chromium installed. Screenshots
are stored in the ignored `.demo/screenshots` directory.

For the production demo build:

```powershell
# Stop the development app first. Leave the demo database running.
npm.cmd run build
npm.cmd start
```

Vercel deployment uses hosted PostgreSQL and a private Blob store as described
above. The local PostgreSQL and filesystem adapters remain available for
development. Complete [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)
before accepting real membership data or payments. Back up PostgreSQL and private files together, and
test restoration into a separate environment. See [SECURITY.md](SECURITY.md).

Later phases: official content, full editorial CMS and media upload flows,
approved bilingual content, MFA, real payments, object storage, account
recovery/invites, full reconciliation and PWA/offline planning. No service
worker caches sensitive records in this version.

Technical references: [Better Auth Next.js integration](https://better-auth.com/docs/integrations/next),
[Better Auth Prisma adapter](https://better-auth.com/docs/adapters/prisma).
Illustrative image: [Unsplash mountain photograph](https://images.unsplash.com/photo-1464822759023-fed622ff2c3b),
asset delivered from `images.unsplash.com/photo-1464822759023-fed622ff2c3b`.
