# Local Test Walkthrough

The public site no longer carries proposal branding. Original sample content
and tracks are unpublished; public sections remain empty until content is
published. Audio/lightbox steps below require explicitly labelled test uploads
in a local environment. Restore the original samples to unpublished status with
`node scripts/unpublish-samples.mjs` after any local presentation.

Open http://127.0.0.1:3000. The app and local database must be running.
The generated password is in `.demo/accounts.txt`. Never present real member
details, official claims or actual money as part of this demo.

## Demo Accounts

| Email                    | Role                                            |
| ------------------------ | ----------------------------------------------- |
| super@demo.invalid       | Super Admin: all demo areas                     |
| admin@demo.invalid       | Administrator: publishing, media/music and finance verification |
| media@demo.invalid       | Media Manager: media/music                      |
| finance@demo.invalid     | Finance Officer: collections/payments/reports   |
| editor@demo.invalid      | Editor: public content                          |
| secretary-a@demo.invalid | Secretary General: Demonstration Constituency A |
| secretary-b@demo.invalid | Secretary General: Demonstration Constituency B |

All share the generated local demo password. Use the unified login at
`/portal/login`. The role selector fills the email; it does not bypass login.
The five-attempt-per-minute sign-in limit is intentional. Avoid switching more
than five accounts within a minute. Use Sign out before switching accounts.

## Public Website and Music

1. Open the homepage and show the supplied logo and AD branding.
2. Switch EN to ST and back. Explain that Sesotho requires official review.
3. Show About, News, Events and the image lightbox in Media.
4. Visit Leadership/Policies to show that approved official content is awaited.
5. Open Music. Search and filter FREE/PAID. Press a preview play icon.
6. Show pause, seek, volume and playlist in the mini-player. No music autoplays.
7. Download a free track.
8. Select Buy track on a paid demo instrumental. Keep the demo phone number.
9. Start the clearly labelled DEMO M-PESA payment. It becomes pending.
10. Press Simulate successful demo payment. Download becomes available.
11. Repeat with Simulate failed payment to show that no download is granted.

These files are synthesised instrumentals, not official AD songs. No money is
charged. A browser must retain its purchase cookie to download the paid file.

## Administration

1. Sign in as Administrator. Publishing, media, music, membership review and
   finance verification are available in this same account; no role switching
   is required. Super Admin is only needed to manage Super Admin accounts.
2. Open Music. Choose Add track; upload separate full and short preview WAV,
   MP3 or OGG files. Existing synthetic files under private-storage/audio and
   public/preview-1.wav can be used for a local demo upload.
3. Enter a demo title/artist. Select FREE or PAID, price and Published.
4. Show edit, unpublish and archive controls.
5. Open Payments, Constituencies and Membership. Membership has Members and
   Submissions tabs. Review a submitted snapshot if desired.
6. Show Users and Audit log. Do not create real accounts or records.

Content screens support basic text creation/editing/publication. General media
uploads, videos and advanced editorial CMS tools are a later phase.

## Secretary General

1. Sign out and sign in as secretary-a@demo.invalid.
2. Show the assigned Demonstration Constituency A prominently on the screen.
3. Add a fictional member. Edit that member if desired.
4. Open Import CSV and download the fictional template. Select the CSV file.
5. Choose Validate & preview. No rows are saved at this point.
6. Choose Confirm import. The server imports into the assigned constituency.
7. For an error example, repeat the same CSV; duplicate member numbers are
   rejected and a row-error CSV is available.
8. Open Submit membership. Enter a period and submit. Show the saved snapshot
   count in Submission history.
9. Open Collections and create a report with a fictional amount and
   DEMO-COLLECTION reference. Show PENDING VERIFICATION immediately afterwards.

The template is reusable only with new fictional member numbers: duplicates
are correctly blocked. No spreadsheet rows are inserted before confirmation.

## Finance and Isolation

1. Sign out and sign in as finance@demo.invalid.
2. Open Collections. Review a pending report.
3. Choose Verified (simulation), enter the independently simulated amount and
   notes. Show VERIFIED and the recorded reported/verified amounts.
4. Open Reports for the difference and CSV export. Payments shows demo music
   transactions. Finance has no individual-membership screen.
5. Sign in as Secretary A and show the constituency list. Sign out and sign
   in as Secretary B; only B's fictional membership appears.
6. For the formal isolation/security demonstration, run `npm.cmd test` while
   the app is running. Its real HTTP tests change constituency query parameters
   and request bodies and attempt to edit B's record as A. Access is denied.

## Launch Again

```powershell
npm.cmd run db:start
npm.cmd run dev
```

For a presentation using the production build, stop dev, run
`npm.cmd run build`, then `npm.cmd start`. Keep the database running and open
the same http://127.0.0.1:3000 URL. This demo is local, not publicly hosted.
