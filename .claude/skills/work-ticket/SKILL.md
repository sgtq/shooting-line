---
name: work-ticket
description: Work a ticket from start to a ready commit. Reads the ticket from its GitHub issue, by issue number or URL. Plans the change, builds it with tests, docs, and translations, and runs CI. Use when the user asks to work, start, build, or implement a ticket.
argument-hint: '<ticket number or URL>'
---

# Work a ticket

Take one ticket and carry it through. Follow `CLAUDE.md` and `CLAUDE.local.md` the whole way. Use plain
language, no em dashes, and ask the user when something is unclear instead of guessing.

## 1. Find the ticket

Tickets are GitHub issues in `sgtq/shooting-line`. The `docs/planning/<app>/tickets.md` files are
archived and no longer updated. Do not read them for tickets.

- If the argument is a URL or an issue number, read it with `gh issue view <number or url>`
  (add `--comments` when the discussion matters).
- Fetch one issue only. Do not list or dump every issue body.
- The `app:<name>` label (`manager`, `portal`, `scorecard`, `ianseo-dashboard`, `platform`) tells which
  app it belongs to. Read `docs/planning/<app>/plan.md` before planning when it exists.
- The issue body can have a "Depends on: #N" line, and some issues have a parent or sub-issues. Read
  those with `gh issue view` when they matter.
- If there is no argument, or the issue does not exist, say so and ask. Do not pick a ticket yourself.

Read the full ticket text. If the ticket is vague, has open choices, or touches scope you cannot judge
from the code, ask the user before planning.

## 2. Check the state of the work

- If the issue is closed, tell the user it is already done and ask if they still want to continue.
- If its project Status is In Progress, look at the current branch, recent commits, and any related code
  to see what is already built. Report that and continue only the remaining part.
- Read the code the ticket touches. Check related issues (parent, sub-issues, dependencies) so the work
  does not clash with or duplicate them.

## 3. Get on the right branch

- Never work on `develop` or `main`. Check `git branch --show-current` and `git status`.
- If the current branch already fits this ticket and the tree is clean, use it.
- Otherwise create a branch from the up to date `develop` (fetch first), named
  `<app>/<type>/<short-name>`. `<app>` is the ticket's `app:*` label without the prefix, `<type>` is
  `feat`, `fix`, `test`, `docs`, or `refactor`, and `<short-name>` is a few lowercase words joined by
  hyphens that sum up the ticket (for example `manager/feat/move-saves-out-of-app`). If `develop` does
  not exist locally or remotely, ask which base to use. Create it with
  `gh issue develop <number> --name <branch> --base develop` so the branch is linked to the issue. Its
  PR then shows in the issue's Development section. The default branch is `main`, so `Closes #N` alone
  does not make that link.
- If the tree has uncommitted changes that do not belong to this ticket, never stash, reset, or switch
  over them. Use a git worktree for the new branch as the default:
  `git worktree add ../shooting-line-<slug> -b <branch> origin/develop`. Run `npm install` there and do
  all the work in that folder. Ask the user first only when it is unclear whether the changes belong to
  this ticket.
- If a plain fetch fails with an SSL certificate error on Windows, retry with
  `git -c http.sslBackend=schannel fetch origin`.

Once on the new branch, move the ticket to In Progress right away (see step 7).

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

The status is the Status field of the issue in the single `ShootingLine` project (number 8, owned by
`sgtq`). All apps share it. The app comes from the `app:*` label and the `[app]` title prefix.

- Set In Progress as soon as the branch is ready (end of step 3), before planning or coding. Find the
  item with `gh project item-list 8 --owner sgtq --format json -L 200`, then run
  `gh project item-edit` with the project, field, and option ids from `gh project field-list 8`.
- Do not close the issue by hand. Put `Closes #<number>` in the PR body so GitHub closes it on merge
  and the project moves it to Done.
- If the work stops half way or is handed back, leave it In Progress and say what remains.
- If the issue is not in a project, skip this step and say so.

## 8. Commit

`CLAUDE.md` requires approval before committing. Show the draft commit message in chat and wait for the
user to approve. Start the message with a short summary line that names the ticket and its issue number (`#N`). End it with the
attribution line from the session's system reminder. Do not push or open a PR unless the user asks.
If they ask for a PR, open it against `develop` (`gh pr create --base develop`). Show the full draft
(title and body) and wait for approval first.

PR title format: `<type>(<app>): <summary> (#<issue>)`, for example
`feat(manager): move saves out of App.vue (#8)`. `<type>` is `feat`, `fix`, `test`, `docs`, or
`refactor`. `<app>` is the ticket's `app:*` label without the prefix. Start the body from
`.github/pull_request_template.md` and keep `Closes #<issue>`. After the PR is open, check that it
shows under the issue's Development section (`gh issue develop <issue> --list`). If the branch was not
created with `gh issue develop`, it cannot be linked by API, so ask the user to link it in the issue
sidebar.

## 9. Report back

Give a short summary: the ticket (number and title), what changed, tests added, how you verified it,
the branch name, and anything you could not do or verify. List out-of-scope findings and open
questions last.
