# Remaining compliance checklist

Only what's still open as of 2026-11-16. Evidence for each item is in [audit.md](audit.md) (findings F1-F18). The agreement draft is [student-data-privacy-agreement.md](../legal/student-data-privacy-agreement.md). How to run `useradmin` is in [useradmin.md](../useradmin.md).

On 2026-11-16 this list was compared with [district-readiness-playbook.md](district-readiness-playbook.md), written for another app (Math Fact Missions). Items added from it are marked *(playbook …)*, with the playbook's row number (#N) or section number. What the playbook asks for that's already done here, or doesn't apply, is in section 6.

Within each group, items are ordered by priority. **[Blocks charter]** marks what has to be settled before the charter can sign. Without it, the agreement would say something untrue.

## 0. Ship what's built

- [ ] **[Blocks charter] Review and commit the access log and account deletion** in both repos:
  - backend: migration 000041, `internal/accesslog`, `cmd/server/access_log.go`, `useradmin delete` and `useradmin access-log`
  - frontend: the student page's "Record of access", the privacy page and [useradmin.md](../useradmin.md)

  Deleting an account now holds its school classes for the school for 30 days.
- [ ] **[Blocks charter] Review and commit ending access (F2)** in both repos:
  - backend: migration 000040, `internal/auth/accounts.go`, the per-request check, `POST /auth/sign-out-everywhere`, `cmd/useradmin` and the Dockerfile line that ships it
  - frontend: Account → Sign out everywhere, the sign-in message for a turned-off account, the privacy page
- [ ] **[Blocks charter] Review and commit school classes** in both repos:
  - backend: migration 000039, `internal/classscope`, `cmd/server/class_guard.go`, and the school, classroom, behavior, conference and substitute changes
  - frontend: the School page card, the create-class choice, the admin's held-classes card and "Give back", the copy, and the privacy page
- [ ] **[Blocks charter] Deploy, in order:**
  1. Take a one-off snapshot of the database first. There are no backups, and migration 000039 changes who owns classes: classes members made after joining become the school's, and members are asked once about their older classes. Delete the snapshot once the deploy checks out, because the privacy page says there are no backups.
  2. Deploy the backend. It runs migrations 000039–000041.
  3. Deploy the frontend and the site.
  4. Check it: `useradmin status <your email>` answers from a shell in the server container, and a student page shows "Record of access".

## 1. Decisions I need to make

- [ ] **[Blocks charter] Backups: add them or not.**
  - Option A: daily encrypted US backups, kept 30 days, with the key backed up separately.
  - Option B: no backups.

  Updates privacy.md (frontmatter TODO), agreement §9.5, Exhibit B.7 and Exhibit C item 3.
- [ ] **[Blocks charter] Resend: strip event content from emails, or disclose it.**
  - Option A: keep the title, location and notes. The agreement already discloses them.
  - Option B: send only "an event on <date>" plus a link.

  Updates privacy.md (frontmatter TODO), agreement §11, Exhibit A.1 and A.3 item 5.
- [ ] **[Blocks charter] Who signs: you as an individual, or the LLC.** This sets the agreement's Parties section, the insurance holder and the privacy page's "Who we are". The playbook also puts the operator's mailing address and phone number on the privacy page, citing COPPA §312.4(d)(1). Ask the lawyer whether you need them (see section 4) *(playbook #32)*.
- [ ] **[Blocks charter] Year-end purge (agreement §9.3).**
  - Option A: the administrator confirms each July which classes to delete.
  - Option B: build an automatic purge.
- [ ] **Accounts that stop being used** *(playbook #24–25)*. The privacy page says "We keep your account and everything you've added until you delete it". Nothing ends that for a teacher who stops signing in, so a teacher without a school keeps student names forever. The playbook treats indefinite retention as a gap.
  - Option A: delete accounts after 24 months without a sign-in, with an email 30 days before. Never delete a school's held classes early.
  - Option B: keep them, and say on the privacy page why.

  Either way, the privacy page's "Keeping and deleting data" changes.
- [ ] **Calendar visibility (F3).** Every teacher sees events that aren't private, including titles like "IEP: Sam", and Private is off by default. Options:
  - make events private by default
  - a per-category "private by default" setting
  - a warning in the event form
- [ ] **Support email (F14).** A personal Gmail address is in effect a subprocessor. Move to a business address, or list it in agreement §11.
- [ ] **`AUTH_GOOGLE_ALLOWED_DOMAINS`.** It's one setting for the whole service, so turning it on would lock out every other school. Probably leave it empty, and say so in the questionnaire.
- [ ] **Later, not blocking the charter: initials or names-on-device mode** for schools without an agreement. What it touches is in audit.md ("Initials or names-on-device mode").

## 2. Code changes (proposals: none made; each needs your OK)

- [ ] **[Blocks charter] Export and delete tooling.** Deleting a school's row now deletes exactly its classes (and the students only in them), so deleting at contract end is one statement. There's still no button or script for it. Still needed:
  1. Export one student's data.
  2. Export a school's classes (CSV or JSON) for an administrator, ideally from the held-classes card and the dashboard.
  3. A safe, logged "delete this school" for you.

  The privacy page already promises "email us and we'll send you a copy of your data", so (1) and a teacher-level export are also owed to teachers today *(playbook #27)*. Export needs the production key, so where it runs has to be designed.
- [ ] **Teachers confirm their school allows it, before adding students to a personal class** *(playbook #7–8, 9–10; F18)*. This is the code half of "Terms for free teachers" in section 4. School classes are covered by the school's agreement, so it's only needed for personal classes. Do it before marketing more to individual teachers.
  - **New teachers:** a checkbox, "My school allows me to use TeachForFree with my students", stored as a timestamp. The server refuses every path that creates students until it's set: typed or pasted names, and Google Classroom import.
  - **Existing teachers:**
    1. First count, read-only and counts only, how many teachers already have students in personal classes. I'd need your OK to run that against production, or I can hand you the query.
    2. Show them a dialog on each visit until they confirm. "Not now" closes it, so nobody is locked out mid-year.
    3. Decide a deadline, with the lawyer, for accounts that never confirm.
- [ ] **A "Delete account" button** on the Account page *(playbook #26)*. The privacy page says "There isn't a delete button yet". `useradmin delete` already does the work (`Accounts.Delete`), so the button would reuse it, with the same retype-your-email confirmation. Also have deletion revoke the teacher's Google Classroom grant at Google, as Disconnect does. Today the connection row is deleted, but Google still lists the app as allowed.
- [ ] **In-app reminders not to enter diagnoses or disability information** in mark notes, conference notes and the event form. Also change the category placeholder from "IEP/504" (`src/components/calendar/categories.tsx:237`).
- [ ] **Separate migration role (F7).** Run migrations with a privileged `MIGRATE_DATABASE_URL`, and give the server a role that can only read and write rows. This makes the checklist's "least-privilege DB user" true.
- [ ] **Calendar private by default** (if that's your decision in group 1).
- [ ] **Strip Resend content** (if you choose Option B in group 1).
- [ ] **Exited students:** a flag plus a purge after 30 days, or reuse archiving with a deadline.
- [ ] **Failed-login logging with IP, and alerting.** Log the IP (rate-limited) on Google login failures, so spikes can be seen.
- [ ] **Data minimization (F11).** Add `fields=students(userId,profile/name),nextPageToken` to the Classroom roster call, and delete the unused `scopeClassroomEmails` constant and its outdated comment.
- [ ] **Security headers.** HSTS, a Content-Security-Policy and a Permissions-Policy *(playbook #23)* in `nginx-security-headers.conf`, unless Cloudflare already sets HSTS (check first).
- [ ] **Remove `staff-list.json` from git (F8)** if the two rows are real people. Removing it from history needs a force-push, so it's your call.
- [ ] **Local `.env` errors (low).** Stop logging godotenv's parse error text, which quotes the bad line (`cmd/server/main.go:50-51`).
- [ ] **Later:** Microsoft sign-in, Clever and ClassLink, and names-on-device mode.

## 3. Server and ops

- [ ] **[Blocks charter] Confirm the Hetzner location** (Ashburn or Hillsboro). Fill it in on the privacy page and in agreement §7.4 and §11.
- [ ] **[Blocks charter] Cloudflare SSL/TLS mode is "Full (strict)"** *(playbook #29)*. "Flexible" sends traffic, student names included, unencrypted between Cloudflare and the Hetzner server. Check it in the Cloudflare dashboard (SSL/TLS → Overview), then add it to Exhibit B.2, which today only covers browser to Cloudflare.
- [ ] **[Blocks charter] Back up `STUDENT_DATA_ENCRYPTION_KEY`** (and `GOOGLE_TOKEN_ENCRYPTION_KEY`) offline, separately from any database backup. Do this whatever you decide about backups: losing the key loses every name.
- [ ] **[Blocks charter, if backups = A] Set up daily encrypted US backups** kept 30 days, then do a first restore test that includes decrypting with the backed-up key.
- [ ] **[Blocks charter] Confirm and write down the items you marked [x]:**
  - firewall: only Cloudflare on 80/443, SSH restricted
  - SSH keys only
  - Postgres not reachable from outside
  - `IS_PRODUCTION=true`
  - `CLIENT_IP_HEADER` set
  - MFA on Hetzner, Coolify, Cloudflare, GitHub and the Google Cloud console

  Exhibit B marks each one **[Confirm]**.
- [ ] **[Blocks charter] Coolify and the key.** Check whether Coolify backs up its own database, where environment variables live, and where to. If it does, the master key is in those backups.
- [ ] **Check each production host's response headers** *(playbook #6)*. Run `curl -sI` on the app, API and site to confirm what's in front of each one (`server: cloudflare`, `cf-ray`), and whether HSTS is on. This is a request to production, so you run it, or tell me to.
- [ ] **Log retention.** Ship container logs to US storage kept 1 year. Today they're lost when a deploy replaces the container. Until then, make sure Docker rotates them on disk *(playbook #22)*. The access log already keeps who opened student records for 1 year, in the database.
- [ ] **Uptime monitoring and alerts** (downtime, and failed-login spikes once they're logged).
- [ ] **Disk encryption decision** (Exhibit B.1). Hetzner Cloud likely needs your own setup, such as LUKS; confirm in its docs.
- [ ] **Automatic OS security updates on the host** (for example unattended-upgrades), plus Dependabot or Renovate on both repos.
- [ ] **Redis:** confirm where `REDIS_URL` points. If it isn't Hetzner, add it to the subprocessor table.
- [ ] **Resend settings:** its data region, and how long it keeps message logs (Exhibit C item 5 needs the number).

## 4. Paperwork and business

- [ ] **[Blocks charter] Ask the charter:**
  - CSDPA or a custom agreement?
  - Do they have a security questionnaire?
  - What insurance do they require?
- [ ] **[Blocks charter] Lawyer review** of the agreement, the privacy policy and the terms. Questions to include:
  - The COPPA "teacher acting for the school" flag (agreement §5).
  - **Does COPPA apply at all?** Students never sign in; teachers and administrators type everything. COPPA is about collecting personal information *from* children online. The playbook was written for an app students use, and its COPPA-only items may not be strictly required here: the written security program (§312.8), the retention policy in the notice (§312.10), and the operator's address (§312.4(d)(1)). Schools ask for the same things anyway.
  - The operator contact details the privacy page needs (section 1, "Who signs").
- [ ] **[Blocks charter] Write the information security program** *(playbook section 6)*. A few pages, which you sign:
  - who's responsible
  - what's protected
  - the risks
  - the safeguards in place (Exhibit B, mostly)
  - monitoring
  - vendors
  - incident response
  - training
  - a review log

  The **one-page incident response plan and the 72-hour breach notice template** that agreement §8 requires go in it. Base the template on the notice contents in §8.2. The charter's questionnaire will probably ask for it.
- [ ] **Terms for free teachers (F18).** Teachers must have their school's permission to add student information. The terms say nothing about it today. The privacy page's FERPA and COPPA wording should also cover teachers without a school agreement. The code half is the confirmation checkbox in section 2.
- [ ] **[Blocks charter] Name the school contact and your responsible security person** (agreement §1, §7.2).
- [ ] **[Blocks charter] Complete FERPA and IDEA confidentiality training**, and record the date (agreement §7.2).
- [ ] **[Blocks charter] Subprocessor terms** *(playbook #28)*: accept or download the data processing terms for Hetzner, Cloudflare, Resend and Google, and save PDF copies. Finish the table in agreement §11.
- [ ] **[Blocks charter if required] Cyber liability and technology E&O insurance** (agreement §14). The playbook says $1M–2M each is typical. Ask the charter what it requires.
- [ ] **Form the LLC and open a business bank account** (if that's your decision in group 1). Then update the privacy page's "Who we are" (frontmatter TODO) and the agreement's Parties section, and move vendor accounts and their terms into the LLC's name.
- [ ] **Ask the charter's Google Workspace admin** to allow TeachForFree (Classroom scopes) and to require 2-Step Verification for staff.
- [ ] **Google OAuth verification** for the Classroom scopes, so teachers don't see the "unverified app" warning (`internal/auth/google.go:25-28`).
- [ ] **Fill out the charter's security questionnaire** from Exhibit B and the security program.
- [ ] **Catholic school:** the principal's written approval, and a check of diocese policy.
- [ ] **Business support email**, W-9 and invoicing.
- [ ] **WCAG 2.1 AA check and VPAT.**
- [ ] **Later:** a one-semester pilot, a case study, the CSDPA for other districts, other states' laws (Illinois SOPPA requires a signed agreement before any student data, though private schools are exempt; New York Ed Law §2-d has its own rules), a Clever/ClassLink plan, a status page, and approaching districts in spring.

## 5. Recurring duties (once an agreement is signed)

| When | Duty | What supports it today |
| --- | --- | --- |
| Within 1 business day of notice | Disable departed staff | The administrator removes them in the app, which cuts off school data at once. If the school asks, `useradmin disable <email>` ([useradmin.md](../useradmin.md)) |
| Within 72 hours | Notify the school of an incident | The security program's incident plan and template (not written yet) |
| Within 5 business days | Export or correct a student's records | Correction: in the app. Export: needs tooling |
| Within 10 business days | Delete on request | An account: `useradmin delete <email>`. A student or a class: in the app |
| Every request (school, parent, teacher) | Log it: the date, who asked, how you checked it was them, what you did, and the line `useradmin` printed *(playbook 4.8)* | A private spreadsheet |
| Within 30 days of exit | Delete exited students | Needs an exited flag, or the school's list |
| Each new school | Agreement signed before its teachers add students to school classes *(playbook 4.8)* | |
| Each new vendor, 30 days before | Notify schools of subprocessor changes; update the privacy page and agreement §11 | Calendar reminder |
| Monthly | OS and dependency patching (`npm audit`, `govulncheck`); log review; a glance at vendor dashboards | Needs log retention first |
| Quarterly | Review who has access to Hetzner, Coolify, Cloudflare, GitHub, Google Cloud and Resend; remove unused API keys *(playbook 4.8)* | |
| Each semester | Restore test, including decryption | Needs backups (if A) |
| By July 31 | Purge prior-year data | Depends on decision §9.3 |
| Yearly | Training; risk assessment and security program review; review the access list, the privacy page, the subprocessor table and vendor terms; renew insurance | |
| Within 30 days of contract end | Return data, delete it, sign Exhibit C | Delete: the school's row (exact). Return: needs export tooling |

## 6. Playbook items already done here, or not applicable

Checked 2026-11-16, so they don't need redoing.

**Done:**
- **Data inventory, outbound calls, browser storage, logs, and the policy checked against the code** (#1–5): audit.md Part 1. The built app was rechecked on 2026-11-16. It loads nothing from outside hosts: no CDN scripts, fonts or files, no analytics or trackers (#20–21).
- **Encryption** (#13): AES-256-GCM with a fresh nonce for every value, a key per kind of data, and each value bound to its row and field.
- **Google tokens stay on the server, encrypted** (#16).
- **Error logs** (#19): IDs, statuses and routes only. Errors from bad input, which can quote what was typed, are never logged (audit 1.4).
- **Authorization on every request** (#15): the class guard, co-teacher scopes and school scopes, with tests.
- **Sessions end the moment an account is turned off or deleted** (#23). The playbook still lists this as open for its own app.
- **A school-level path** (#12): school accounts, administrators, school classes and the agreement.
- **A record of access**, kept 1 year.
- **No compliance claims** (#36): the site and the app were searched on 2026-11-16. The FAQ's FERPA and COPPA answer describes practices. Words inside images and videos can't be searched this way.

**Doesn't apply:**
- **Student passwords, student sign-in, and real-time identity** (#14, #18): students never sign in. The one live feature, conference updates for families, only sends; who's listening comes from the family's code, never from a message.
- **The AI opt-in and AI vendor terms** (#11, #17): the app uses no AI service.
