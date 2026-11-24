# useradmin: ending someone's access

`useradmin` is a small command-line tool shipped inside the backend's Docker image. Use it when a request reaches you, TeachForFree, and the app can't handle it on its own:

- a school asks you to cut someone off right away (for example, a security incident, or a staff member who was let go),
- someone asks you to delete their account,
- someone thinks another person is signed in to their account,
- you need to look into who opened a teacher's records.

**What a school can already do without you:** when a teacher leaves, the school's admin removes them in the app. That cuts off the school's data at once and holds the teacher's school classes for the school for 30 days. Families asking "who has seen my child's records?" can be answered by the teacher or the admin with the **Record of access** button on the student's page. Use `useradmin` for whatever goes beyond that.

---

## 1. Get into the server container

The tool runs **inside the backend container**, not on the server itself. It reads the database address (`DATABASE_URL`) from the container's environment, which Coolify already sets. The tool doesn't print it; a connection error can name the database host and user, but never the password. Don't copy that value anywhere.

> The tool exists only in images built from the `feature/add_school_account` changes onward. If you get `useradmin: not found`, the running container is older; deploy first.

### Option A: Coolify's web terminal (easiest)

1. In Coolify, open the project, then the **backend** application.
2. Open its **Terminal** tab. The label varies by Coolify version, so look around the application page if it isn't called exactly that.
3. You're now in a shell inside the running container. Type the commands below directly, for example `useradmin status ana@lincoln.org`.

### Option B: SSH, then `docker exec`

```sh
ssh you@your-server                              # however you normally SSH in

docker ps --format '{{.Names}}  {{.Image}}'      # find the backend container
# Coolify names containers with long generated IDs; pick the one running
# the backend image.

docker exec -it <container-name> useradmin status ana@lincoln.org
```

- **Keep `-it`.** `sign-out`, `disable` and `delete` ask you to retype the email, and that prompt needs an interactive terminal.
- For a shell inside the container, use `docker exec -it <container-name> sh`. The image is Alpine, so there's no `bash`.
- If you run `useradmin` on the server outside the container, you'll get `DATABASE_URL is not set` or `not found`. That means you aren't inside the container.

---

## 2. The commands

```
useradmin [-yes] [-days N] <command> <email>
```

> **Flags go before the command.** `useradmin -days 90 access-log ana@lincoln.org` works; `useradmin access-log ana@lincoln.org -days 90` prints the usage text and does nothing.

The email is the address the person signs in with. Upper or lower case doesn't matter.

| Command      | What it does | Asks to confirm? | Undo |
|--------------|--------------|------------------|------|
| `status`     | Shows the account: on or off, open sessions, push devices. Changes nothing. | No | Nothing to undo |
| `sign-out`   | Ends every session on every device, right now. They can sign in again. | Yes | They sign in again |
| `disable`    | Turns the account off. They can't sign in, every session ends, and their substitute links, family conference codes and co-teacher access stop working. Nothing is deleted. | Yes | `enable` |
| `enable`     | Turns a disabled account back on. Links and co-teacher access work again, unless they've expired. | No | `disable` |
| `delete`     | Deletes the account and its data (details below). | Yes | **None. Permanent.** |
| `access-log` | Prints who opened this teacher's records, and what this person opened. | No | Nothing to undo |

### `status`: always start here

```
$ useradmin status ana@lincoln.org
Ana Lopez <ana@lincoln.org>
  account:      on
  sessions:     2 open
  push devices: 1
```

If the account is off, it reads `account: OFF since 2026-11-16T18:04:11Z`. After a sign-out it also shows `last signed out everywhere: …`.

### `sign-out`: "someone else might be in my account"

Ends every session on every device within a second, and removes their devices from push notifications. Use it for a lost or stolen device, or a shared computer left signed in. The account stays on.

The teacher can do this themselves under **Account → Sign out everywhere**. Use the command when they can't get in to do it.

### `disable`: "cut this person off now"

Everything `sign-out` does, plus the account can't sign in again until you `enable` it. The login page tells them the account was turned off. Their substitute links, family conference codes and co-teacher access stop working while it's off. Nothing is deleted.

Disabling doesn't remove someone from their school. If the school also wants its classes back, its admin removes the teacher in the app, which holds their school classes for the school.

### `enable`

Turns the account back on. They sign in with Google again. Sessions and push devices ended by `disable` don't come back.

### `delete`: a deletion request

Permanent. What happens depends on whether they have **school classes**:

- **No school classes:** the account and everything in it are deleted at once.
- **School classes:** those classes stay with the school for **30 days**, exactly as if the teacher had left: students, marks and notes included, visible to the school's admins, who can delete them sooner. Everything else (personal classes, lesson plans, templates, devices, sessions) is deleted at once. Until then the account is only a name on those classes: no email, no Google link, no way to sign in. It's removed automatically once the classes are gone.

It refuses to delete a school's **only administrator**: make someone else an admin first.

```
$ useradmin delete ana@lincoln.org
Ana Lopez <ana@lincoln.org>
  account:      on
  sessions:     1 open
  push devices: 0
Type ana@lincoln.org to delete this account: ana@lincoln.org
2026-11-16T18:10:42Z  ana@lincoln.org (01937c5e-…) deleted; 1 school class(es) held for the school until 2026-12-16, then deleted
```

If they sign in with Google again later, they get a new, empty account.

**Check who's asking before you delete.** A request to delete a whole account should come from the account's own email. A school that wants its data gone doesn't need you: removing the teacher in the app holds their school classes, and the admin can delete them.

### `access-log`: who opened what

```
$ useradmin -days 7 access-log ana@lincoln.org

Who opened Ana Lopez's records (last 7 days, UTC):
  2026-11-15 14:02–15:40  ×12   Dr. Rivera <rivera@lincoln.org> (school_admin): view_student, student 0193a2f4
  2026-11-15 08:01–15:55  ×31   Ana Lopez <ana@lincoln.org> (owner): view_class, Period 1
  2026-11-14 08:10–11:30  ×6    substitute link for 2026-11-14: give_mark, Period 1, student 0193a2f4

What Ana Lopez opened (last 7 days, UTC):
  2026-11-15 08:01–15:55  ×31   Ana Lopez <ana@lincoln.org> (owner): view_class, Period 1
```

Reading a line:

- **`2026-11-15 14:02–15:40`**: the day, then the first and last time that day, in **UTC**. Pacific time is UTC−8 in winter and UTC−7 in summer.
- **`×12`**: how many times that day. One line per person, action, class and student per day, not one per click.
- **Who:** name, email and role (`owner`, `coteacher`, `school_admin`), or `substitute link for <day>`, `family code`, `TeachForFree (useradmin)`, or `deleted account`.
- **What:** the action, the class (or `a deleted class`), and the student as the **first 8 characters of their ID**, never their name.

`-days` goes back 1 to 366 days (default 30). The log itself is kept for one year. Each list shows at most 500 lines.

What gets logged:

- Only requests that succeeded.
- Lesson plans, the calendar, the staff list and account settings aren't logged, because they aren't student records.
- Changes made directly in the database, outside the app, aren't logged.

**Action names**

| Action | Meaning |
|--------|---------|
| `view_class` | opened the class (it shows the students) |
| `view_student` | opened the student's page |
| `print_reports` | printed reports |
| `view_access_record` | opened the student's Record of access |
| `add_students` / `remove_student` / `rename_student` | changed the roster |
| `change_groups` | changed groups |
| `import_class` | imported from Google Classroom |
| `delete_class` | deleted a class |
| `give_mark` / `give_marks` | gave a mark / gave marks to several students |
| `delete_mark` / `restore_mark` / `delete_marks` | deleted, restored or undid marks |
| `change_note` | changed a mark's note |
| `view_conference` / `set_conference_time` / `delete_conference` | conference sign-ups |
| `print_notices` / `make_family_code` / `change_conference_note` | conference notices, codes and meeting notes |
| `family_view` / `family_move` | a family opened their conference page / changed their time |
| `sub_open_day` | a substitute opened their link |
| `add_to_school` / `release_class` / `delete_held_class` | school classes: added, given back, deleted after the teacher left |
| `provider_*` | you, through `useradmin` (`provider_sign_out`, `provider_disable`, `provider_enable`, `provider_delete`, `provider_view_access_log`) |

---

## 3. Your own trail

- Every command **except `status`** is written to the same access log, as TeachForFree. Your own lookups appear there too, as `TeachForFree (useradmin)`.
- Every change prints one line with the UTC time, the email, the account ID and what happened. **Copy that line into your own record of the request**, with who asked, when, and how you checked it was really them. That's what you'd show a school or a regulator later.
- The tool shows teachers' names and emails, class names and short student IDs. It never shows a student's name or a note's text.

---

## 4. If something goes wrong

| Message | Meaning |
|---------|---------|
| `useradmin: not found` / `executable file not found` | The container is older than this feature; deploy, or you're outside the container. |
| `DATABASE_URL is not set` | You're outside the backend container. See section 1. |
| `can't connect to the database`, or an error with `failed to connect` | The database is down or unreachable from this container. |
| `no account signs in as "…"` | Typo, a different sign-in email, or the account was already deleted. |
| `not confirmed; nothing changed` | The retyped email didn't match. Nothing happened. |
| `they're the only administrator of their school…` | Have the school make someone else an admin, then delete. |
| The usage text appears | Wrong command name, a missing email, or a flag placed after the command. |

The tool exits with code 0 on success, 1 when it couldn't start (missing settings), and 2 when the command failed, database errors included.

`-yes` skips the retype-the-email prompt. Leave it off when you're typing by hand; it exists for scripted use.

---

## Quick reference

```sh
useradmin status      ana@lincoln.org      # look first
useradmin sign-out    ana@lincoln.org      # end every session
useradmin disable     ana@lincoln.org      # turn off (reversible)
useradmin enable      ana@lincoln.org      # turn back on
useradmin delete      ana@lincoln.org      # permanent; school classes held 30 days
useradmin -days 90 access-log ana@lincoln.org   # flags before the command
```

From the server over SSH, put `docker exec -it <container-name>` in front of any of these.
