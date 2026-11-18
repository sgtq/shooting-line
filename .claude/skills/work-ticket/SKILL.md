---
name: work-ticket
description: Work a ticket from start to a ready commit. Looks the ticket up by number in docs/planning/<app>/tickets.md, or reads it from a URL if one is given. Plans the change, builds it with tests, docs, and translations, and runs CI. Use when the user asks to work, start, build, or implement a ticket.
argument-hint: '<ticket number or URL>'
---

# Work a ticket

Take one ticket and carry it through. Follow `CLAUDE.md` and `CLAUDE.local.md` the whole way. Use plain
language, no em dashes, and ask the user when something is unclear instead of guessing.

## 1. Find the ticket

- If the argument is a URL, read the ticket from that URL (use `gh issue view <url>` for GitHub issues).
  Do not look in `tickets.md` first.
- Otherwise treat the argument as a ticket number and look it up in the per-app files
  `docs/planning/<app>/tickets.md` (`manager`, `ianseo-dashboard`, `scorecard`). Ids can be sub-tickets
  such as `5a` or `5b`.
- The same number can appear in more than one app (for example Manager and Scorecard both have `11`).
  If the number matches more than one row, list the matches with their app and ask which one. The app
  folder also holds a `plan.md` when there is one. Read it before planning.
- If there is no argument, or no row matches, say so and ask. Do not pick a ticket yourself.

Read the full ticket text. If the ticket is vague, has open choices, or touches scope you cannot judge
from the code, ask the user before planning.

## 2. Check the state of the work

- If the status is `[x]`, tell the user it is already done and ask if they still want to continue.
- If the status is `[~]`, look at the current branch, recent commits, and any related code to see what
  is already built. Report that and continue only the remaining part.
- Read the code the ticket touches. Check related tickets (for example `5` and `5a`) so the work does
  not clash with or duplicate them.

## 3. Get on the right branch

- Never work on `develop` or `main`. Check `git branch --show-current` and `git status`.
- If the current branch already fits this ticket and the tree is clean, use it.
- Otherwise create a branch from the up to date `develop` (fetch first) named `feat/...`, `fix/...`,
  `test/...`, or `docs/...` to match the ticket. If `develop` does not exist locally or remotely, ask
  which base to use.
- If a plain fetch fails with an SSL certificate error on Windows, retry with
  `git -c http.sslBackend=schannel fetch origin`.

Once on the branch, flip the ticket to `[~]` now (see step 7).

## 4. Plan, then confirm

Give the user a short plan before writing code:

- What the ticket asks for, in one or two sentences.
- The files and areas you expect to change (apps, packages, migrations, edge functions).
- Anything the ticket leaves open, as questions. Wait for answers.

Wait for the user to agree when the plan has real choices or touches the database. For a small, clear
change, say the plan and continue.

## 5. Build it

Follow the project rules:

- SOLID, explicit return types (TS signatures, or JSDoc `@returns` in `.js` and `.vue`), concise comments
  that explain why, lines of 100 to 120 characters, no em dashes.
- Stay inside the current stack. Ask before adding a library or framework.
- Put shared code in `packages/` only when more than one app uses it.
- Supabase migrations use `YYYYMMDDHHMMSS_description.sql`. Never edit a migration that is already
  merged. Add a new one.
- Update both English and Spanish (`packages/i18n/src/spanish.js`) for any user-facing text, using `t()`.
- Tests ship in the same commit as the code. Cover the new behavior, edge cases, and failure paths.
  Unit tests go beside the source file (Vitest). End-to-end tests go in `tests/e2e/` (Playwright).
- Update the README of every app or package the change touches when behavior, access rules, setup
  steps, environment variables, or workflows change. Remove statements the change makes false.

Keep the change inside the ticket. If you find a related problem that is out of scope, mention it to the
user at the end instead of fixing it.

## 6. Verify

- Run `npm run ci` (Prettier, ESLint, type-check) and the relevant tests (`npm run test:unit`, and
  `npm run test:e2e` when the change affects flows covered there).
- On Windows with `core.autocrlf=true`, Prettier may flag untouched files because of CRLF. Confirm with
  `npx prettier --check --end-of-line auto <changed files>` and report it.
- If the change is visible in the app, run it and check it works. Say plainly if you could not.

## 7. Update the ticket status

Keep the status in the app's `docs/planning/<app>/tickets.md` current as the work moves, not only at the end:

- Set `[~]` as soon as the branch is ready (end of step 3), before planning or coding.
- Set `[x]` only when the work is finished and verified (step 6 passed).
- If the work stops half way or is handed back, leave it at `[~]` and say what remains.

Keep the table aligned. Run Prettier on the file after editing. The file is gitignored, so the change is
not part of the commit. If the ticket came from a URL and is not in the file, skip this step and do not
add a row.

## 8. Commit

`CLAUDE.md` requires approval before committing. Show the draft commit message in chat and wait for the
user to approve. Start the message with a short summary line that names the ticket. End it with the
attribution line from the session's system reminder. Do not push or open a PR unless the user asks.
If they ask for a PR, open it against `develop` (`gh pr create --base develop`). Show the full draft
(title and body) and wait for approval first.

## 9. Report back

Give a short summary: the ticket (number and title), what changed, tests added, how you verified it,
the branch name, and anything you could not do or verify. List out-of-scope findings and open
questions last.
