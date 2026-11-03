---
title: Privacy Policy
description: 'How TeachForFree handles teacher and student information: what we collect, how we protect it, Google Classroom data, and how to delete it.'
updated: 2026-11-03
---

## Who we are

TeachForFree (teachforfree.com) is a free web app for K–12 teachers. You can tap a student to give a positive or negative behavior mark, keep short lesson notes, share a day with a substitute through a link, schedule parent conferences, and, if you want, import class rosters from Google Classroom.

TeachForFree is a personal project made and run by Anthony Barragan, an independent developer in Ventura, California. It isn't a company. When this policy says "we" or "us," it means Anthony.

This policy covers the TeachForFree website, the installed app (the version you add to your phone's home screen), and the servers behind them. If you have a question, email [a.barragan.89@gmail.com](mailto:a.barragan.89@gmail.com).

## The short version

- TeachForFree is for teachers. Students never sign in, and we don't collect anything directly from students.
- Student information you add belongs to you and your school. We use it only to run TeachForFree for you.
- We never sell data, show ads, build profiles of students, or use your data to train AI models.
- There are no analytics tools, ad trackers, or third-party tracking scripts.
- Student names, lesson plan text, and notes on marks are encrypted in our database.
- A mark records which student, which class, which kind of mark, and when. You can add a short note to a negative mark to say what happened.
- Families can choose or change their parent conference time with a code on a printed notice. Other families never see which student has which time, and we don't collect anything about parents.
- Google Classroom is optional. We only read your classes and rosters, and only when you ask. We never store student email addresses.
- You can delete marks, students, and classes yourself, and you can ask us to delete your whole account at any time.

## What we collect

### Your teacher account

You sign in with your Google account. We ask Google only for basic sign-in information (the "openid," "email," and "profile" permissions), and we store:

- your name and email address, which we update from Google each time you sign in
- Google's ID for your account, so we recognize you next time
- your account type (teacher or administrator) and when you joined

We never see your Google password, and we don't store your Google profile photo.

### Your classes and students

- Class names. For a class imported from Google Classroom, also its Google Classroom ID and section (for example, "Period 3").
- Students' first and last names, which you type, paste, or import. Names are encrypted before they're saved.
- Which students are in which of your classes.

We don't ask for student email addresses, birthdays, grades, photos, or ID numbers. Class names and your mark labels are not encrypted the way student names are, so please keep student information out of them.

### Behavior marks

- **Your mark types:** the labels you choose, like "Helping others" or "Off task," and whether each one is positive or negative.
- **Each mark:** which student, which class, which mark type, the time on your device when you tapped, and the time our server received it. When you mark several students with one tap, those marks share a group ID so Undo can take them all back together. Marks a substitute gives are labeled as theirs.
- **Notes on marks:** an optional short note (up to 280 characters) you or your substitute add to a negative mark to say what happened. Notes are encrypted before they're saved. A note shows on that student's page and prints on their behavior report, which may go home to their family, so leave out other students' names.

### Lesson plans

The sections and lines you write for each day, any start and end times you add, their order, and when a line was checked off. Teachers often write students' names in their plans, so section titles and lines are encrypted before they're saved.

### Substitute links

When you share a day with a substitute, we store the date, your time zone (so we know when that day starts and ends), the classes you picked, when you made the link, when it was last opened, and whether you turned it off. See [Substitute links](#substitute-links) below.

### Parent conferences

When you set up parent conferences, we store the conference's name, the name you sign notices with, the location you type, your time zone, the classes you picked, the conference times, which student has which time, when you printed each student's notice, which meetings you marked as complete, and each change a family makes (which student, from which time, to which time, and when). We don't collect anything about parents: no names, email addresses, or phone numbers. See [Conference sign-ups](#conference-sign-ups) below.

### Google Classroom (optional)

See [Google user data](#google-user-data) below.

### Technical information

- **Sign-in cookies.** See [Cookies](#cookies).
- **Your time zone,** which the app sends so marks are counted on the right days.
- **IP addresses.** To stop abuse, our server keeps short-lived counters of how many requests come in. Sign-in pages, substitute links, and conference codes are counted by IP address. Everything else is counted by account. The counters delete themselves once they're no longer needed: within about a minute for IP addresses, and within an hour at most for accounts. If a request is refused for going over a limit, our server log records the IP address or account it came from.
- **Server logs.** Our server logs events like sign-ins, sign-outs, and errors, along with your account's internal ID. We don't write student names or lesson plan text to our logs.
- **Our providers.** Like any website, Cloudflare and our hosting provider handle IP addresses and basic request details (such as browser type) to deliver and protect the site.

We don't use analytics tools, advertising networks, tracking pixels, or session recording.

## How we use information

We use information only to provide and protect TeachForFree:

- to sign you in and keep you signed in
- to show your classes, students, marks, charts, and lesson plans on your devices
- to import the Google Classroom classes you choose
- to let a substitute you shared a day with use that day
- to keep the service secure, prevent abuse, and fix problems
- to answer you when you contact us, and to tell you about important changes to the service or this policy

We don't use your information or your students' information for advertising or marketing. We don't sell or rent it, and we don't build profiles of students or teachers. We don't use any of it to train AI or machine-learning models.

## Google user data

### What we get from Google

**Signing in.** Google gives us your name, email address, and Google account ID, as described above.

**Connecting Google Classroom.** This is a separate, optional step with its own Google consent screen. We ask for two read-only permissions:

- `classroom.courses.readonly`: to see the list of classes you teach
- `classroom.rosters.readonly`: to see the students in those classes

This step also uses basic sign-in permission so we can confirm it's the same Google account you sign in with. If a different Google account grants access, we cancel that access right away and keep nothing from it.

We don't ask for student email addresses, coursework, grades, or anything else in Google Classroom, and TeachForFree can't change anything in your Google Classroom.

### How we use it

- When you open the import screen, we fetch the active classes you teach (name, section, and number of students) so you can pick one. This list isn't saved.
- When you import a class, we save its name and section, its Google Classroom ID, and each student's name and Google ID. Student names are encrypted. Google student IDs are saved only as a keyed hash, a scrambled fingerprint that lets us recognize the same student if you import again, without keeping the real ID.
- We contact Google Classroom only when you open the import screen or import a class. Importing again adds new students. It doesn't change or remove the students you already have.

### How we store it

So that imports work when you ask for them, Google gives us a long-lived access key (a "refresh token"). We store it encrypted (AES-256-GCM), along with the list of permissions you granted. The short-lived keys made from it stay in memory and are never saved.

### Who we share it with

We don't share Google user data with anyone, except the service providers that host TeachForFree (listed under [Who we share information with](#who-we-share-information-with)), or when it's needed for security or required by law.

### Limited Use

TeachForFree's use and transfer to any other app of information received from Google APIs will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

In plain words, information we receive from Google:

- is used only to provide the TeachForFree features you see
- is never used for advertising, including targeted ads, and is never sold
- is never used to develop, improve, or train AI or machine-learning models
- is not read by people, unless you ask us to look at something specific (for example, to help with a problem), it's needed for security (such as investigating abuse), it's required by law, or it has been combined and made anonymous for internal operations, as that policy allows

### Disconnecting

You can disconnect Google Classroom on your TeachForFree Account page at any time. This cancels TeachForFree's access at Google and deletes the stored key. You can also remove TeachForFree's access from your Google account at [myaccount.google.com/permissions](https://myaccount.google.com/permissions). Either way, Google cancels all of TeachForFree's access to that account, so the next time you sign in, Google may ask you to allow your name and email again.

Disconnecting doesn't delete the classes and students you already imported. You can delete those in the app, or ask us to.

## Student data, FERPA, and COPPA

TeachForFree is a tool for teachers. Students don't sign in or have accounts, and we don't knowingly collect any information directly from children. If we learn that a student has created an account, we'll delete it.

Student information in TeachForFree comes from teachers, either typed in or imported from the school's Google Classroom. It belongs to the teacher and the school, and the school decides how it can be used.

- **FERPA.** When student information comes from a student's education records, we handle it as a "school official" acting for the school. We use it only to provide TeachForFree for the school's educational purposes, and we don't share it except as this policy describes, as the school directs, or as the law requires.
- **COPPA.** TeachForFree isn't directed to children. Where COPPA applies to students under 13, we rely on the school, or the teacher acting for the school, to authorize this educational use on parents' behalf. We use that information only for the school's purposes, never for any commercial purpose.
- **Teachers:** please check your school's or district's rules before adding student information, and add only what you need.

Our commitments for student information:

- We use it only to provide TeachForFree to you and your school.
- We never sell or rent it.
- We never use it for advertising, including targeted ads.
- We never build profiles of students beyond the marks and charts you see in your own account.
- We never use it to train AI models.
- We delete it when the teacher or the school asks.

**Parents and guardians:** please contact your child's teacher or school first. They control the information and can view, correct, or delete it in TeachForFree. If the school asks us for help, we'll help. You can also email us at [a.barragan.89@gmail.com](mailto:a.barragan.89@gmail.com). Because we can't verify who a student is on our own, we may need to check with the school before acting.

If your school or district needs a student data privacy agreement, please contact us.

## Substitute links

A teacher can share one day with a substitute using a link. The substitute doesn't need an account. Anyone who has the link can, on that day only (midnight to midnight in the teacher's time zone):

- see the teacher's name and that day's lesson plan, and check lines off
- see the names of the students in the classes the teacher picked, and that day's mark counts for them
- give marks, undo marks they gave, and add a short note to a negative mark they gave

The link doesn't show other days, past marks, or student charts. Marks given through a link are labeled as the substitute's. The teacher can see when the link was last opened, and can turn it off at any time. It stops working right away.

The link's secret key comes after the "#" in the web address. Browsers don't send that part of an address to servers, and the app moves the key out of the address bar as soon as the page opens. We look links up by a scrambled (hashed) copy of the key. We also keep an encrypted copy so the teacher can copy the same link again, and we erase it within an hour after the day ends.

## Conference sign-ups

A teacher can schedule parent conferences and print a notice for each student's family, in English and Spanish, with the student's conference time (or, if the student doesn't have one yet, an invitation to choose one) and a QR code. The family doesn't need an account. Anyone who has a student's code can:

- see the student's first name, the name the teacher signs notices with, the location, and the student's conference time
- see the conference's other times as open or unavailable, but never who has them
- choose an open time for the student, or move them to one, if the teacher allows changes online, until 24 hours before the time

A code works for one student only, and a student has one time, so a code can hold only one time. The page updates live while it's open, so families see right away when a time is taken. The teacher sees every change a family makes, can turn online changes off, and can replace a student's code at any time. The old code stops working right away.

The code's secret key comes after the "#" in the web address, like a substitute link's, and the app moves it out of the address bar as soon as the page opens. We look codes up by a scrambled (hashed) copy of the key. We also keep an encrypted copy so the teacher can print the same notice again, and we erase it within an hour after the conference's last time. Conferences are deleted 30 days after their last time.

## What's stored on your device

This depends on how you use TeachForFree.

### On the website (any browser, including shared school computers)

TeachForFree doesn't save student information on the device. While a tab is open, your data is held in that tab's memory. Our server tells the browser not to keep copies of its answers. Browser storage holds only a few small settings:

- whether you chose light or dark mode
- whether you closed the "get the app" banner
- a yes/no note that someone is signed in on this browser (nothing about who), so the homepage can send you straight to your classes

Marks you give while the connection is down wait in the tab's memory and are sent when it's back. They're lost if you close the tab first.

On a shared computer, please sign out when you're done. Otherwise the sign-in cookies keep you signed in on that browser for up to 30 days.

### In the installed app (added to your home screen)

So it opens instantly and works on spotty Wi-Fi, the installed app saves a copy of what the class page needs in the phone's app storage:

- your name and email, your class names, and the roster of the class you have open
- your mark types and recent mark counts
- student pages you've opened
- lesson plans for today and the next school day, any others you've opened from yesterday through 7 days ahead, and the dots on this month's calendar

This copy is deleted when you sign out, when your session ends, and when a different teacher signs in on the same device. If you don't open the app for 7 days, the saved copy expires and is deleted the next time the app starts.

Marks and checkmarks you give while offline wait in a queue until they can be sent. The queue holds only IDs, times, and done/not-done, never names. It's kept for up to 30 days, the longest our server accepts a late mark. Signing out deletes the queue too, and the app warns you first if anything hasn't been sent.

### For substitutes

The link's key moves into that browser tab's session storage, which the browser clears when the tab is closed. Nothing else is saved on the substitute's device, even in the installed app.

### For families

A conference code's key, and whether the family chose English or Spanish, move into that browser tab's session storage, which the browser clears when the tab is closed. Nothing else is saved on the family's device, and the app's offline files aren't installed for them.

### The app's own files

Like most installable web apps, TeachForFree uses a service worker to keep a copy of the app's code, styles, fonts, and logo, so it loads quickly and works offline. It never stores student information or answers from our server. Our fonts come from TeachForFree itself, not from Google Fonts or any other font service.

## Cookies

We use only the cookies needed to sign you in. We don't use advertising or analytics cookies.

| Cookie                                         | What it's for                                          | How long it lasts                                                                     |
| ---------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `access_token`                                 | Shows our server you're signed in                      | 15 minutes, renewed automatically                                                     |
| `refresh_token`                                | Renews your sign-in                                    | 30 days from when you last used TeachForFree. Any sign-in ends after 90 days at most. |
| `oauth_state`, `oauth_nonce`, `oauth_verifier` | Protect the sign-in and Connect Google Classroom steps | 10 minutes                                                                            |

Our server sets these cookies. Scripts on the page can't read them, and browsers send them only over secure (HTTPS) connections. We store only a scrambled (hashed) copy of your refresh token. Each one works only once, and signing out ends the session on our side too.

Cloudflare, which protects our site, may set its own security cookies, such as `__cf_bm` or `cf_clearance`, to tell people apart from bots. Google sets its own cookies on its sign-in pages, under Google's privacy policy.

## Who we share information with

We share information only with service providers that help us run TeachForFree. They may use it only to provide their service to us.

- **Cloudflare** delivers the site and protects it from attacks. All traffic between your device and TeachForFree passes through Cloudflare.
- **Google** provides sign-in, and Google Classroom if you connect it.
- **Hetzner** runs the server for the app, our database, and the rate-limit counters. Encrypted information stays encrypted there.

We may also share information:

- **With the substitute you choose.** Whoever has a substitute link sees what that link opens (see [Substitute links](#substitute-links)).
- **With the families you give notices to.** Whoever has a conference notice's code sees what that code opens (see [Conference sign-ups](#conference-sign-ups)).
- **When the law requires it,** such as a valid subpoena or court order. Where we're allowed to, we'll tell the teacher, and the school for student information, first.
- **To protect people,** if we believe it's needed to prevent serious harm, or to protect TeachForFree from fraud or abuse.
- **If TeachForFree changes hands.** Anyone who takes over TeachForFree must keep the promises in this policy for information we already have. If they won't, we'll tell you ahead of time so you can delete your data first.

We never sell or rent personal information, and we never share it with advertisers or data brokers.

## Security

- Connections to TeachForFree use HTTPS.
- Student names, lesson plan text, notes on marks, Google Classroom access keys, and the copies of substitute links and conference codes are encrypted in our database with AES-256-GCM. The encryption keys are kept separate from the database, so a copy of the database on its own doesn't reveal them. Our server holds the keys so it can show your information to you.
- Google student IDs are stored only as a keyed hash. Sign-in tokens are stored only as hashes, and substitute links and conference codes are looked up by a hash of their key.
- Each teacher's information is kept separate. The database itself refuses to mix one teacher's students, classes, or marks with another's.
- Our server tells browsers and proxies not to cache its answers, so student names don't end up in a shared computer's browser cache.
- Sessions are short and limited, and request limits slow down anyone trying to guess or flood.

No system is perfectly secure. If we learn of a breach that affects your information, we'll tell you promptly, as the law requires. If student information is involved, we'll tell the school too.

You can help: turn on 2-step verification for your Google account, sign out on shared computers, share a substitute link only with the substitute, and send conference notices home with each family.

## Keeping and deleting data

We keep your account and everything you've added until you delete it or ask us to. Parent conferences are the exception: they're deleted automatically (see [Automatic cleanup](#automatic-cleanup)).

### Deleting things yourself

- **A mark** disappears right away. We keep a copy for 10 minutes so Undo can bring it back, then erase it for good (within about 20 minutes at most).
- **A student:** removing a student from their last class deletes the student and all of their marks.
- **A class:** archive it first, then delete it. Deleting a class removes all of its marks, plus any of its students who aren't in another of your classes.
- **Lesson plan sections and lines** are deleted when you delete them.
- **A substitute link** can be turned off at any time, and it stops working right away. We keep the record of the link (its date and classes) so marks given through it stay labeled as the substitute's.
- **A parent conference** can be deleted with all its times, codes, and families' changes, and its codes stop working right away. A single time, or a whole day of times, can be removed, and a student's code replaced, at any time.
- **Google Classroom** can be disconnected at any time (see [Disconnecting](#disconnecting)).

### Automatic cleanup

- Expired sign-in sessions are deleted every hour.
- The encrypted copy of a substitute link is erased within an hour after its day ends.
- The encrypted copies of a conference's codes are erased within an hour after its last time.
- Parent conferences are deleted 30 days after their last time, with every time, code, and family change in them. A conference that never gets a time is deleted after 90 days.
- Rate-limit counters delete themselves within an hour at most.

### Deleting your account

There isn't a delete button yet. Email [a.barragan.89@gmail.com](mailto:a.barragan.89@gmail.com) from the address you sign in with, and we'll delete your account and everything in it: classes, students, marks, mark types, lesson plans, substitute links, parent conferences, and your Google Classroom connection. We'll let you know when it's done.

### No backups

We don't keep backups of the database. When you delete something, it's gone for good. It also means that if our database is ever lost, what's in it can't be recovered, so keep your own copy of anything you need, like printed student reports.

Our server also keeps logs of events like sign-ins and errors. They never contain student names or lesson plan text, and we use them only to run and fix TeachForFree.

## Your choices and rights

- **See and fix your information:** everything you've added is in the app. You can rename students and classes, edit lesson plans, and delete marks.
- **Get a copy:** email us and we'll send you a copy of your data.
- **Delete:** see [Keeping and deleting data](#keeping-and-deleting-data).

Depending on your state, you may have other privacy rights. We honor requests to access, correct, or delete information from everyone, wherever they live. We don't sell personal information or share it for targeted advertising, so there's nothing to opt out of.

## Changes to this policy

When we change this policy, we'll update the date at the top. If a change is significant, especially one about student information, we'll tell you in the app or by email before it takes effect. We won't start using student information in a new way without telling you first and, where the law requires it, getting consent.

## Contact

Questions, requests, or concerns? Email [a.barragan.89@gmail.com](mailto:a.barragan.89@gmail.com). Parents, please contact your child's school first (see [Student data, FERPA, and COPPA](#student-data-ferpa-and-coppa)).
