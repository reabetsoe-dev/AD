# Security of the Demonstration

This application is for fictional records and simulated money only. It is not
approved for real political-party membership data, public operations or actual
payments. Production work is tracked in PRODUCTION_CHECKLIST.md.

## Authentication and Access

Better Auth handles password hashing and cookie-based database sessions. Public
sign-up is disabled. Sessions expire after eight hours; sign-in has a
database-backed limit of five attempts per minute. Errors shown by the login
screen are generic. HTTPS cookie protection depends on the configured HTTPS
APP_URL. Development uses loopback HTTP; production must use TLS.

Sessions alone do not authorize an operation: the current database user must
exist and be enabled. Central permissions restrict every internal API. Role
and constituency fields are not writable through public authentication.
User changes revoke existing sessions. Admins cannot manage Super Admins or
change their own management record. Passwords and tokens are never audited.
Invitation email, MFA, forced temporary-password rotation and account recovery
are deferred and required for production provisioning.

Secretary General queries derive scope only from the database relationship.
Member edits combine member ID and that scope before updating. Import ignores
no scope: browser-supplied constituency/role columns are rejected. Exports use
the same authorization. Tests exercise cross-constituency reads and writes.
Finance cannot access individual membership records.

Internal pages use noindex/nofollow and private no-store headers. Metadata also
prevents indexing of this proposal as a whole. No service worker or browser
membership database exists. The only browser preference stored is language.

## Input and Storage

Zod validates mutations and Prisma parameterizes database queries. React
escapes content; the CMS does not render arbitrary HTML. Mutations check the
configured exact Origin. Better Auth provides its own session and Origin
checks. Response headers include nosniff, frame denial and a basic CSP.
The current CSP permits inline/evaluated scripts for Next.js development; a
nonce-based production policy is a deployment follow-up, not a claim of CSP
hardening already complete.

Uploads validate allowed MIME, extensions, maximum sizes and recognizable
file signatures. CSV is parsed with Papa Parse. Generated UUID filenames
prevent user filenames being used as storage paths. Full audio and import
sources are outside the public web root; local path resolution must remain
inside the private root. Cloud deployments use a private Vercel Blob store,
with role-limited direct uploads and file-owner checks before attaching files.
Public asset routes only serve accepted previews and images referenced by a
record; full audio still requires download authorization. No private
arbitrary-file route is exposed. Malware scanning, retention cleanup and
authorized support-document retrieval are not implemented yet. Orphaned files after failed transactions may require
cleanup. Configure private roots outside publicly served directories.

Local PostgreSQL is a separate demo cluster bound to 127.0.0.1 with trust
authentication. Other local processes can access it. It must never be used for
real data or bound to external interfaces. Production requires independent
database credentials, least-privilege roles, network access controls and
encryption appropriate to the deployment. Database and storage encryption at
rest are deployment responsibilities, not provided by this demo.

## Payments and Entitlements

The only payment provider is Mock M-Pesa. Mock operation requires both
DEMO_MODE=true and PAYMENT_PROVIDER=mock-mpesa. A signed demo event must match
its timestamp, unique provider reference, purchase, amount and currency.
Successful payment, purchase status and entitlement are committed together.
Conditional updates and unique constraints prevent duplicate grants. No
internet-facing production callback is invented.

Paid audio authorization checks the opaque HttpOnly purchase cookie hash,
purchase status, transaction status and entitlement. Streaming exposes no
permanent storage URL. The cookie lasts seven days; purchase recovery and
renewed identity are not implemented. Demo checkout is not suitable as the
production identity/recovery model without further review.

A collection reference is only reported information. It remains pending until
an Administrator, Finance Officer or Super Admin independently simulates verification.
Self-verification is blocked. Reported and verified amounts remain separate.
Finalized reports cannot be repeatedly overwritten. Refunds, provider disputes
and accounting adjustments require additional production workflows.

## Audit and Privacy

Audit events include login success, member creation/updates/import/submission,
collection submission/verification/rejection, track uploads/updates/publication/
price changes, payment results, downloads, user/role changes and exports.
Safe metadata uses IDs, counts and status information, not credentials or
entire membership rows. Failed-login auditing, tamper-resistant external audit
storage and retention policies are later work. Submission snapshots contain
minimal member names/numbers and are not exposed by the list API.

Rate limits cover authentication and cookie-scoped checkout; broad distributed
abuse control is not yet implemented. Private exports are audited and scope
checked, and formula-like strings are escaped in record exports. Row/page
limits are deliberate first-version limits, not a complete pagination design.

## Deployment and Incident Handling

Never commit .env, .demo, private-storage or exported personal records. The
build explicitly excludes private runtime files from server file tracing.
Generate separate production secrets; do not promote demo accounts/passwords.
The source dependencies use a lockfile; run dependency audit after updates.

Before handling real data, establish an incident contact and escalation path,
revoke affected sessions, rotate compromised credentials, preserve audit
evidence securely and follow the applicable notification process. Restore
tests must cover both PostgreSQL and private media/import sources. Define
retention periods, backup access, deletion procedures and recovery objectives
before launch. Do not cache member records for offline use without a separate
approved security design.
