# District readiness: what Math Fact Missions did, and how to check another app against it

Written 2026-11-16, from the privacy work done in this repo between 2026-11-14 and 2026-11-16. Use it to compare another K–12 app for teachers and students against what was done here: find its gaps, and decide what to do first.

This is not legal advice. Section 2 gives the legal points the work relied on, with sources. The policy, terms and school agreement have not been reviewed by a lawyer yet.

File paths below are in the Math Fact Missions repo and are given for reference only. The other app will have its own.

---

## How to use this

The other app is in the same position Math Fact Missions was: teachers have already signed up and added students by name. Work in this order:

1. **Audit first, read-only** (section 4.1). Change no behavior, data or settings until the operator agrees. Never print, log or commit secrets or real student data. Don't touch production or call outside APIs during the audit.
2. For each row in section 4, record the other app's state as **Done**, **Partial**, **Missing** or **N/A**, with evidence: a `file:line`, a command's output, or "can't verify from code". Ask the operator about anything that only exists outside the code, such as hosting, consoles and contracts.
3. Read section 5 closely. It covers existing teachers and students and is the part most likely to differ between apps.
4. Rank each gap:
   - **P0:** it makes the published policy untrue, exposes student data, or blocks marketing.
   - **P1:** retention, rights and exposure.
   - **P2:** hardening.
5. Report using the template in section 9.

---

## 1. What "district ready" meant

Being able to say yes when a school or district asks, before letting students in:

- A privacy policy that matches what the code does, names every vendor that receives data, and says how long each kind of data is kept.
- A record, for every teacher with students, that their school authorized the app. This is COPPA's school-consent route.
- A school data privacy agreement (SDPA) ready to sign.
- A written information security program, including incident response.
- A data processing agreement (DPA) on file with every vendor.
- Deletion that actually happens on the published schedule.
- An operating entity (an LLC), insurance, and a lawyer's review of the documents.
- Marketing that describes practices and never claims compliance.

---

## 2. The legal frame we worked from (summary)

- **COPPA applies** to an app directed to children under 13. Its "personal information" includes a first and last name. It also includes:
  - a *persistent identifier*, such as a cookie holding an account ID or an IP address
  - "information concerning the child… that the operator collects online from the child and combines with an identifier", such as answers, scores and progress ([16 CFR 312.2](https://www.law.cornell.edu/cfr/text/16/312.2))
- **Shortening names does not remove the need for consent.** There is an exception for identifiers used only to run the site. It does not cover using them "to amass a profile on a specific individual", and a teacher's view of each student's history is exactly that. First name plus last initial is good data minimization, but a student app still needs consent.
- **How consent works for schools.** A school may authorize collection in place of parents, for school use only. The FTC recommends that the school or district decide, rather than individual teachers. Nothing requires it to be in writing. A teacher confirming it is the common minimum, and the weakest form ([FTC COPPA FAQ, section N](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions)).
- **The 2025 COPPA amendments** (compliance required since 2026-04-22) added:
  - a written information security program (§312.8)
  - a written retention policy, published in the privacy notice, with no indefinite retention (§312.10)
  - the vendors that receive children's data named in the notice
  - reasonable steps to confirm those vendors can protect it
  - The notice must also give the operator's name, address, phone and email (§312.4(d)(1)).
- **FERPA** binds the schools. Its definition of personally identifiable information includes "the student's name". It also includes anything that would let "a reasonable person in the school community" identify the student ([34 CFR 99.3](https://www.law.cornell.edu/cfr/text/34/99.3)). A first name and last initial in a named teacher's class still meets that test. A school that shares student records with a vendor needs the vendor to act as a "school official" under the school's direct control, which in practice means an agreement.
- **Some state laws require a signed agreement whatever the names look like.** Illinois SOPPA says an operator must "enter into a written agreement with the school, school district, or State Board" before receiving covered information, though private schools are exempt ([105 ILCS 85/15](https://codes.findlaw.com/il/chapter-105-schools/il-st-sect-105-85-15/)). New York Ed Law §2-d, California SOPIPA and California Ed Code §49073.1 have their own requirements. Only Illinois's text was checked here.
- **OpenAI's under-18 API guidance** says not to send personal data of children under 13 without zero data retention (ZDR).
- **Never claim "COPPA compliant" or "FERPA compliant"**, whether in the policy, the terms or marketing. Describe practices instead. The FTC treats inaccurate privacy claims as deception.

---

## 3. The order we did it in

1. **Audit, read-only**, producing `docs/compliance/coppa-audit.md`. It covers:
   - a data inventory
   - third parties and outbound calls
   - cookies and browser storage
   - retention
   - logs
   - the AI integration
   - passwords
   - other security findings
   - the status of each legal requirement
   - every sentence of the live policy that the code contradicted
2. **Proposed changes, ranked P0/P1/P2** (`proposed-changes.md`), each built only after the operator approved it. The documents were drafted alongside.
3. **First deploy** (D1–D11). The worker ran its retention job, then a one-time re-encryption script was run against production, after a backup. Old code can't read the new format, so the script must run after the new code is live.
4. **The corrected privacy policy and terms were published** with that deploy.
5. **Second deploy** (D12–D15), covering existing users (section 5), safe error logging, and the removal of a third-party CDN:
   - the app first, because it runs the migration
   - then the worker, which reads the new columns
   - then the socket server
6. **Live checks.** We fetched the production headers, which showed every host sits behind Cloudflare's proxy, and corrected the policy. Then we searched the code and the live pages for compliance claims.
7. **Vendor DPAs, infrastructure checks, insurance.** Under way.
8. **LLC and lawyer review.** Pending.
9. **Recurring duties** (section 4.8).

---

## 4. Control checklist

### 4.1 Know your data

| # | Control | What Math Fact Missions did | What to check in the other app | Pri |
|---|---|---|---|---|
| 1 | **Data inventory**: every student and teacher field, how it's stored, who sees it, and when it's deleted | One table per model from the Prisma schema. It also covered in-memory state (multiplayer lobbies) and fields nothing displays (Google Classroom IDs) | The same, from the schema, plus caches, queues, object storage, search indexes and analytics stores | P0 |
| 2 | **Every outbound call**, including calls libraries make from the browser | Found eight services where the live policy named one. A 3D library preset (`<Environment preset="city">` from `@react-three/drei`) quietly downloaded a file from raw.githack.com on student pages | Grep server and client code for SDK clients and `fetch`. Open each student page with the DevTools Network tab. Read the CSP's `connect-src`, `img-src` and `script-src` | P0 |
| 3 | **Cookies and browser storage** | Listed each cookie and localStorage key with its purpose, lifetime and contents. Found that teachers' Google OAuth tokens were copied onto the browser-visible session | The same. Look at what the session endpoint returns to the browser | P0 |
| 4 | **What server logs can contain** | Whole error objects were logged. Prisma validation errors print the call's arguments, including encrypted names and answers. `JSON.parse` errors quote their input. ioredis errors carry command arguments, including IP addresses in rate-limit keys and queued job data. Stripe errors can quote an email. The socket server logged usernames | Every server-side `console.error(…, error)` and every logger call that passes a caught error | P0 |
| 5 | **Live policy against the code** | Wrong in more than ten places: usernames "encrypted" (they weren't), "all PII encrypted", OpenAI "the only third party", answers "anonymous" and "not linked", a 3-year purge that didn't exist, "compliant with COPPA" | Take each sentence of the live policy and terms and find the code that makes it true | P0 |
| 6 | **Hosting facts the code can't show** | `curl -sI` on each production host showed every one (app, `ws.`, `assets.`) behind Cloudflare's proxy, which the policy didn't mention | Run `curl -sI` on each production host. Look for `server: cloudflare` and `cf-ray`, `x-vercel-*`, `via`. Ask the operator where the database, backups and logs live | P0 |

### 4.2 Consent: school authorization

| # | Control | What Math Fact Missions did | What to check in the other app | Pri |
|---|---|---|---|---|
| 7 | **New teachers confirm before their first student** | A step in Add Students explains what's kept and why the school authorizes it. It has a checkbox, "My school has authorized me to use Math Fact Missions with my students", and says "Not sure? Ask your principal or school office." The answer is stored as a timestamp, `User.schoolAuthorizedAt`. **Both** ways of adding students (typing names and Google Classroom import) refuse on the server until it is set | Every path that creates students: forms, CSV, roster import (Google Classroom, Clever, ClassLink), invite or class codes, APIs. The server must enforce it, not only the UI | P0 |
| 8 | **Existing teachers with students are asked** | See section 5 | See section 5 | P0 |
| 9 | **The terms say it** | Terms §2: teachers may create student accounts only if their school has authorized them, and creating them confirms that authorization | | P0 |
| 10 | **The policy says it** | Policy §5 explains the school-consent route and how new and existing teachers are asked | | P0 |
| 11 | **Riskier processing has its own opt-in** | AI grading of exit tickets is off by default and was turned off for every existing teacher. The first time a teacher turns it on, a dialog explains what is sent and asks them to confirm their school authorized AI grading. Two timestamps: `aiGradingEnabledAt` (set while it's on) and `aiGradingAuthorizedAt` (kept when they turn it off, so they aren't asked again). It is checked before a job is queued **and** again in the worker before calling OpenAI | Any feature that sends student content to an AI or other outside service | P0 |
| 12 | **A school-level path**, stronger than one teacher's word | Not built. A draft SDPA exists for schools that ask. Ideas not yet built: collect the school's name with the confirmation; let a principal confirm or sign for the school | | P1 |

### 4.3 Protect what you keep

| # | Control | What Math Fact Missions did | What to check in the other app | Pri |
|---|---|---|---|---|
| 13 | **Encrypted student names** (and passwords, if reversible), **a fresh IV for each value** | AES-256-GCM, stored as `v2:iv:authTag:ciphertext`. The key lives only in environment variables, and the app refuses to start without it. The old code encrypted a student's name and password under **one shared IV**. With GCM, anyone holding a database copy could recover both without the key. Reads accept both formats, and a one-time script rewrote all 1,012 production students, printing counts only | IV or nonce reuse, ECB mode, keys in the repo or hard-coded, a key that is the same in dev and production | P0 |
| 14 | **Student passwords** | Generated with `crypto.randomInt`, compared in constant time. Still reversible, because teachers view them for printed login cards. Hashing them is an open decision | `Math.random`, very short PINs, plaintext storage, no lockout | P1 |
| 15 | **Authorization on every read and write** | Three bugs fixed: any signed-in user, students included, could upload to or delete from the S3 bucket; a teacher could read another class's decrypted names and scores; uploads now go to a folder per teacher and only teachers can write | Call teacher actions with a student session. Swap class and student IDs across accounts. Check who can upload and delete files | P0 |
| 16 | **OAuth tokens never reach the browser** | Google access and refresh tokens were on the browser-visible session. Now they're read server-side from the encrypted cookie | Inspect the session payload in the browser | P0 |
| 17 | **Sending student work to an AI** | `store: false` on the call. Only the question and the answer are sent; the student's name, emails and phone numbers are removed from the copy. The question text and the scores come from the server, never the browser. Answers are capped at 1,000 characters. Finished jobs leave Redis after 7 days. Opt-in (row 11). ZDR requested from OpenAI | Provider data-retention settings, what identifiers go in the prompt, whether the browser can supply the prompt or the score | P0 |
| 18 | **Real-time features never take identity from a message** | The socket server learns who a player is from a token the app signs in the handshake. The public lobby list needs that token. The teacher's multiplayer switch is enforced when the token is issued. Every handler is wrapped so one bad message can't crash the server | Any websocket or realtime server, and any endpoint served without sign-in | P1 |
| 19 | **Safe error logging** | One helper, `logError(context, error)`. It logs what failed, the error's type and code, a first-line message of at most 200 characters with emails and phone numbers removed, and the top stack frames. It never logs a Prisma, `JSON.parse` or Stripe message, or extra properties (ioredis `command.args`, `raw`, headers). Every server site uses it. Auth.js's logger goes through it too | | P0 |
| 20 | **No runtime files from CDNs without an agreement** | The lighting file is self-hosted, and its hosts were removed from the CSP and the policy | | P1 |
| 21 | **No ads, analytics or tracking** | None in the code, confirmed with grep and the Network tab | Google Analytics, Meta pixel, Hotjar, session replay, error trackers that capture request bodies | P0 |
| 22 | **Limited log retention** | Docker logs rotate at 3 × 10 MB per container | | P1 |
| 23 | **Headers and server hardening** | Done: CSP, X-Frame-Options, nosniff and Referrer-Policy; the database listens only on 127.0.0.1. Still open: HSTS, Permissions-Policy, a cloud firewall, Cloudflare SSL set to Full (strict), and deleted users' sessions that still work for up to 30 days | | P1–P2 |

### 4.4 Retention and deletion

| # | Control | What Math Fact Missions did | What to check in the other app | Pri |
|---|---|---|---|---|
| 24 | **A written schedule, in the policy and in code** | A table in policy §11, and the same numbers in one constant (`lib/retention-policy.ts`):<br>• students: 12 months inactive<br>• teachers: 24 months inactive, warned 30 days before<br>• after a school agreement ends: 60 days<br>• grading jobs: 7 days<br>• sign-in links: 7 days<br>• a school license: 12 months after it ends<br>• server logs: 14 days<br>• billing records: 7 years | Any "kept indefinitely", or a promise with no code behind it | P0 |
| 25 | **Deletion that runs by itself** | A daily job in the worker:<br>• deletes inactive students, whose data cascades<br>• warns, then deletes, inactive teachers, but never one who is paying<br>• deletes old sign-in links, ended school licenses and old grading jobs<br>`lastActiveAt` is set once a day when a page loads. An account with no activity date counts from when it was created. `RETENTION_DRY_RUN=true` logs the counts without deleting, for the first deploy. Each run logs a one-line count report | | P0 |
| 26 | **One deletion path** | "Delete account" and the retention job share one function: database cascade, uploaded files and sign-in links. Still open: cancelling Stripe and revoking the Google grant on deletion | Orphaned files in storage, payment customers, OAuth grants | P1 |
| 27 | **Per-student export and delete**, for school and parent requests | Not built. Handled by hand, and the policy promises 30 days | | P1 |

### 4.5 Documents

See section 6.

### 4.6 Vendors and infrastructure

| # | Control | What Math Fact Missions did | What to check in the other app | Pri |
|---|---|---|---|---|
| 28 | **A DPA with every vendor that touches student data** | In progress, signed in the operator's own name now and moved to the LLC later:<br>• Hetzner: completed in the console<br>• OpenAI: a form or the Services Agreement<br>• Google Cloud: "Review and Accept" the data processing addendum<br>• AWS, Stripe, Cloudflare, Resend: already part of their terms; save PDF copies | Every service from row 2, plus hosting, email, storage, CDN, AI and payments | P0 |
| 29 | **Encryption all the way to the server** | Cloudflare SSL/TLS should be **Full (strict)**, not Flexible. Flexible leaves traffic unencrypted between Cloudflare and the server | | P0 |
| 30 | **Database not public; firewall; tested backups** | Postgres listens on 127.0.0.1. Hetzner keeps 7 daily backups. A test restore every quarter is planned | | P1 |
| 31 | **OAuth app verification** | Check whether Google requires verification for the Classroom roster permission | | P1 |

### 4.7 Business

| # | Control | What Math Fact Missions did | What to check in the other app | Pri |
|---|---|---|---|---|
| 32 | **The operator named in the policy**: name, address, phone and email (§312.4(d)(1)) | The individual operator until the LLC exists | | P0 |
| 33 | **LLC**, with vendor accounts, the policy, the terms and school agreements moved into its name | Pending | | P1 |
| 34 | **Insurance**: cyber liability and technology E&O, typically $1M–2M each | Pending. Ask schools what they require | | P1 |
| 35 | **A lawyer's review** of the policy, terms and SDPA | Pending. The question list is in `remaining-checklist.md` E3 | | P1 |
| 36 | **Marketing describes practices** | Searched the code and the live pages on 2026-11-16: no compliance claims. Words inside images and videos can't be searched this way | Landing pages, metadata, app store listings, emails, social posts | P0 |

### 4.8 Recurring duties

| When | Duty |
|---|---|
| Daily (automatic) | The retention job. Check its log line now and then |
| Monthly | Record the retention counts; run `npm audit` in each package; glance at vendor dashboards |
| Quarterly | Test-restore a backup; review console access and API keys |
| Each new school | SDPA signed before students are added |
| Each school that leaves | Delete within 60 days and send a certificate of deletion |
| Each school or parent request | Answer within 30 days and log it |
| Each new vendor | Update the policy's vendor list and the SDPA; give schools 30 days' notice |
| Any incident | Notify schools within 72 hours (security program §7) |
| Yearly | Risk assessment, program review, policy review, re-check DPAs, renew insurance |

---

## 5. Existing teachers and students

This is what was done for teachers who added students by name before the app asked for anything.

1. **Count them first.** Use a read-only query that counts teachers with students and no school confirmation, and how many students they have. Count only; never print names.
2. **Don't delete or rename anything yet.** Shortening names to a first name and last initial is good minimization, but it does not replace consent (section 2). We suggested it to teachers rather than changing data.
3. **Ask them, without locking them out.** A dialog opens on the teacher's home page (Classroom) on every visit until they confirm. It uses the same checkbox and wording as the new-teacher step, so one confirmation satisfies both, plus a tip that a first name and last initial are enough. "Not now" closes it until the next visit, so classes keep working mid-year. Teachers with no students don't see it; they are asked when they add their first student.
4. **Set a deadline.** Decided 2026-11-16: in June 2027, at the end of the school year, accounts that still haven't confirmed are suspended. To settle with the lawyer first:
   - an email warning before the suspension
   - what happens to those students' data: kept for the inactivity period, or deleted
   - a line in the terms that allows the suspension
5. **Turn risky features off for them by default.** AI grading was switched off for every existing teacher. They turn it back on themselves, through the confirmation in row 11. The teacher pages where exit-ticket results appear say AI grading is off and link to the switch, so scores that never arrive aren't a mystery.
6. **Fix how their data is stored, in place.**
   1. Deploy code that reads both the old and new formats.
   2. Back up.
   3. Run the one-time script as a dry run that only counts.
   4. Run it for real.

   The script prints counts, never names or values. Pass production credentials through hidden prompts, never on the command line. Check the counts match the real number of students; if they don't, it read the wrong database.
7. **Tell them.** Policy §5 says existing teachers are asked when they next open their class. The policy's "Last updated" date changes.
8. **Close the gap for new teachers.** They confirm before their first student, and the server enforces it on every path (row 7).

---

## 6. Documents produced

| Document | Contents | Notes |
|---|---|---|
| **Privacy policy** (`app/privacy-policy/page.tsx`) | 1 Who we are (operator and contact) · 2 Who uses the app · 3 Information we collect · 4 How we use it · 5 Students under 13 and school authorization · 6 AI grading · 7 Who receives information (each vendor: purpose and what data) · 8 What other students can see · 9 Cookies and browser storage · 10 How we protect it · 11 How long we keep it (table) · 12 Choices and rights · 13 Student records and California students · 14 Changes · 15 Google user data · 16 Contact | Describes practices and makes no compliance claims. Every sentence was checked against the code. A "what we do not collect from students" list. "Last updated" changes with each edit |
| **Terms of service** | §2 eligibility and school authorization · §5 ownership (student information belongs to the school, students keep their own work, teachers keep theirs) · §6 AI grading is opt-in · §7 a signed SDPA controls over the terms | For the lawyer: the indemnity currently runs to an individual; whether students, as minors, should indemnify anyone; liability; governing law |
| **School data privacy agreement** (`docs/legal/student-data-privacy-agreement.md`) | Parties, purpose, definitions, ownership and FERPA school-official status, COPPA school authorization, permitted uses, student-generated content, parent review, security, breach notice, retention and a deletion certificate, subprocessors (a table with location), term, liability and insurance, notices, signatures. Exhibit A data elements · Exhibit B security controls as built · Exhibit C certificate of deletion | Values a lawyer must set are in `[brackets]`. California public-school (§49073.1) clauses are marked. Sign it before students are added. A district may bring its own (for example California's CA-NDPA); attach these exhibits to it |
| **Information security program** (`docs/compliance/information-security-program.md`) | 1 Coordinator · 2 Scope (assets) · 3 Risk register · 4 Safeguards, in place and required · 5 Monitoring and testing · 6 Vendor assurances · 7 Incident response (72-hour notice) · 8 Training · 9 Retention duties · 10 Review log and sign-off | What COPPA §312.8 requires. The operator signs it |
| **Audit, proposed changes and checklist** (`docs/compliance/`) | Evidence for every finding, the ranked changes and their status, decisions still open, vendor paperwork, recurring duties | Working notes for the operator and the lawyer |

---

## 7. Lessons: things we only found by looking

- A library default loaded a file from a free CDN on student pages. No one wrote that request, and only the Network tab or reading the library's source shows it.
- The hosting provider's proxy (Cloudflare's orange cloud) passed all traffic and wasn't listed as a vendor. Only response headers showed it.
- Error logs were a data leak. ORM validation errors print their arguments.
- One IV per row instead of one per value made the encryption recoverable.
- The browser sent the question text and the score. The server has to own both.
- OAuth tokens were on the browser-visible session.
- Background jobs held students' answers forever in Redis.
- The policy promised a purge that didn't exist, and claimed encryption that wasn't there.
- A public endpoint (the lobby list) needed no sign-in, and a teacher's on/off switch was enforced only in the UI.
- Deploy order matters when a migration adds columns a separate worker reads: the app first.
- A one-time data script must run after the code that reads its output is live.
- Schema changes go through the ORM's migration tool against a local database, never hand-written SQL, and never by hand against production.

---

## 8. Still open in Math Fact Missions

So the other app knows what hasn't been proven here yet:

- vendor DPAs (in progress)
- insurance
- the LLC
- the lawyer's review
- OpenAI ZDR (requested)
- Cloudflare set to Full (strict)
- a Hetzner firewall and backup check
- Google OAuth verification
- per-student export (row 27)
- a per-IP sign-in limit and the password-hashing decision
- Stripe and Google cleanup on deletion
- the P2 hardening: HSTS, deleted users' sessions, uptime alerts
- a school-level authorization path
- the June 2027 suspension

---

## 9. Report template for the other app

```markdown
# Gap report: <app name>, <date>

## Summary
<three to five lines: biggest risks, what blocks marketing, rough effort>

## Existing users
- Teachers with students: <n>; with a recorded school confirmation: <n>
- Students: <n>; how names are stored: <plaintext / encrypted, how>
- Paths that create students: <list>; which enforce a confirmation on the server: <list>

## Live policy and terms: sentences the code contradicts
| Sentence | What the code does | Evidence |

## Controls (rows 1–36 of the playbook)
| # | Control | Status | Evidence | Gap | Proposed fix | Effort | Pri |

## Proposed order of work
1. P0 ...
```

---

## 10. Working rules that served us well

- Audit read-only. Propose changes; don't build any until the operator agrees.
- Never print, log or commit secrets, keys or real student data. Scripts print counts only.
- Don't touch production or call the AI API during the audit. Production data changes only through reviewed scripts, after a backup.
- Before any database command, check which host it points at (print the host and database name only).
- Describe practices; never claim compliance with a law.
- Verify against the live site, not only the code: headers, network requests, the published policy's date.
- Keep the policy, the code's numbers and the SDPA in step. When one changes, change the others in the same commit.

---

## Sources

- [16 CFR 312.2, COPPA definitions](https://www.law.cornell.edu/cfr/text/16/312.2)
- [FTC, Complying with COPPA: Frequently Asked Questions (section N, schools)](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions)
- [34 CFR 99.3, FERPA definitions](https://www.law.cornell.edu/cfr/text/34/99.3)
- [105 ILCS 85/15, Illinois SOPPA operator duties](https://codes.findlaw.com/il/chapter-105-schools/il-st-sect-105-85-15/)
- [105 ILCS 85/5, Illinois SOPPA definitions](https://codes.findlaw.com/il/chapter-105-schools/il-st-sect-105-85-5/)
- [Hunton, FTC publishes final COPPA rule amendments](https://www.hunton.com/privacy-and-cybersecurity-law-blog/ftc-publishes-final-coppa-rule-amendments)
- [Hetzner data protection FAQ (DPA in the console)](https://docs.hetzner.com/general/general-terms-and-conditions/data-privacy-faq)
