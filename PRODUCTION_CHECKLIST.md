# Before Real Data or Money

The current demo must not handle real membership information or actual money
until these requirements have been addressed and the production release has
been separately approved.

- [ ] Approve official content, supplied logo use, leadership, policies and contacts.
- [ ] Review and approve all Sesotho text and finish administrative translations.
- [ ] Obtain the official domain and configure TLS/HTTPS.
- [ ] Provision production PostgreSQL with restricted credentials and network access.
- [ ] Replace the loopback trust-authenticated demo database.
- [ ] Provision private object storage; implement and test its storage adapter.
- [ ] Define public/private upload rules, malware scanning and orphan cleanup.
- [ ] Obtain an authorised M-Pesa provider contract and actual API documentation.
- [ ] Implement the real provider instead of MockMpesaProvider.
- [ ] Verify real callbacks with provider authentication, replay protection and idempotency.
- [ ] Test pending, failed, cancelled, refunded, dispute and recovery workflows.
- [ ] Add production purchase identity, recovery, receipts and retention controls.
- [ ] Reconcile real provider statements; define adjustment and accounting controls.
- [ ] Add financial supporting documents with authorization and retention.
- [ ] Configure MFA for privileged accounts.
- [ ] Provision named production administrators through a reviewed process.
- [ ] Remove all demo accounts, synthetic transactions and demo assets from production data.
- [ ] Add secure invite, recovery and temporary-password-rotation workflows.
- [ ] Configure email/SMS providers if required; never imply delivery without a provider.
- [ ] Generate independent production secrets; secure rotation and revocation procedures.
- [ ] Add distributed rate limiting, abuse detection and ingress/request size limits.
- [ ] Audit cookie security, CSRF protections, CSP nonces and security headers under HTTPS.
- [ ] Audit roles, privilege changes, exports and constituency boundaries independently.
- [ ] Conduct a security review and penetration/access-control testing.
- [ ] Complete privacy, purpose, legal basis and data-retention reviews.
- [ ] Define sensitive record access, retention, deletion and export policies.
- [ ] Add tamper-resistant audit storage and failed-login monitoring.
- [ ] Configure logs, monitoring, availability alerts and incident contacts.
- [ ] Back up database and private storage with restricted, encrypted access.
- [ ] Test backups and restoration in a separate environment.
- [ ] Agree on recovery objectives, operational ownership and support procedures.
- [ ] Test production migrations, rollback planning and schema compatibility.
- [ ] Complete full media/video/CMS workflows required for the official launch.
- [ ] Add pagination and production-scale reporting; resolve first-version limits.
- [ ] Run accessibility, mobile usability and approved-content checks.
- [ ] Decide PWA/offline requirements without insecure member-data caching.
- [ ] Run final lint, tests, dependency audit and production build on the deployed stack.
