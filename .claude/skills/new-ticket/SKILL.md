---
name: new-ticket
description: Create a ticket as a GitHub issue with the right app label, and make sure it lands in that app's project. Handles parent (sub-issue) and "blocked by" links. Use when the user asks to add, create, or file a ticket or issue.
argument-hint: '<short description of the ticket>'
---

# New ticket

Tickets are GitHub issues in `sgtq/shooting-line`, one project per app. The `tickets.md` files in
`docs/planning/` are archived. Follow `CLAUDE.md` and `CLAUDE.local.md`: plain language, no em dashes,
ask when something is unclear.

## 1. Pick the app

- Use the label `app:manager`, `app:portal`, `app:scorecard`, or `app:ianseo-dashboard`. The launcher
  belongs to `portal`, not `manager`.
- If it is unclear which app it belongs to, ask. Do not guess.
- Project numbers (owner `sgtq`): manager 3, scorecard 4, ianseo-dashboard 5, portal 6.

## 2. Draft

- Write a short, clear title that names the work (no trailing "..." and no ticket numbers).
- Write the body with the same sections as `.github/ISSUE_TEMPLATE/`: what is needed, how we know it is
  done, depends on, and notes. Skip empty sections.
- Look for an existing issue first (`gh issue list --search "<words>" --state all`) so the work is not
  filed twice. Mention a match to the user.
- Show the title, body, labels, and any parent or dependencies in chat and wait for approval before
  creating anything. An issue is visible to everyone with access to the repo.

## 3. Create

- `gh issue create --repo sgtq/shooting-line --title "<title>" --body "<body>" --label app:<app>`.
- Check it landed in the project: `gh project item-list <number> --owner sgtq --format json -L 200`.
  The project's auto-add workflow normally does this. If the issue is missing, add it with
  `gh project item-add <number> --owner sgtq --url <issue url>`.
- Parent: if it is a sub-ticket, link it with
  `gh api -X POST repos/sgtq/shooting-line/issues/<parent>/sub_issues -F sub_issue_id=<child id>`.
  The id is the numeric `id` from `gh api repos/sgtq/shooting-line/issues/<number>`, not the issue number.
- Blocked by: for each dependency, run
  `gh api -X POST repos/sgtq/shooting-line/issues/<number>/dependencies/blocked_by -F issue_id=<blocker id>`.
- Priority is optional. Leave it unset unless the user gives one (High, Medium, Low).

## 4. Report

Give the issue number and URL, the project it is in, and any links made.
