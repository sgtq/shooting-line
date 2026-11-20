---
name: next-ticket
description: Pick the next ticket from the ShootingLine GitHub project, by priority and then board order, and ask the user to confirm before starting it. Takes platform tickets first unless an app is named. Use when the user asks for the next ticket, what to work on next, or to take the next issue.
argument-hint: '[manager | portal | scorecard | ianseo-dashboard | platform]'
---

# Next ticket

Pick the next issue to work on from the project board, show it, and wait for the user to confirm. Only
then hand it to the `work-ticket` skill. Follow `CLAUDE.md` and `CLAUDE.local.md`: plain language, no em
dashes, ask when something is unclear.

## 1. Choose the project

All apps share the single `ShootingLine` project (number 8, owner `sgtq`). The app is the `app:*` label.

- If the argument names an app, use only items with that label.
- Otherwise check the apps in this order and stop at the first one with an eligible issue:
  platform, manager, portal, scorecard, ianseo-dashboard.
- Say which apps you skipped because nothing was eligible.

## 2. Read the board order

`gh project item-list 8 --owner sgtq --format json -L 200` returns the items in board order, the
same order as the cards on the board. Each item lists its labels. Do not sort by issue number.

- Items with Status "In Progress" are already started. Report them first and ask whether to continue
  one of them instead of starting a new ticket.
- Candidates are the items with Status "Todo". Ignore every other Status: In Review items already have
  an open PR, and Backlog and Done items are not ready to start.
- Order the candidates by the Priority field first: High, then Medium, then Low. Items with the same
  priority, and items with no priority, keep their board order. Items with a priority come before items
  without one. When no candidate has a priority, the order is the board order.

## 3. Find the eligible issues

Walk the candidates in that order and keep the first three that pass these checks. Stop reading once
there are three.

- Open: `gh issue view <n> --json state`.
- Not blocked: `gh api repos/sgtq/shooting-line/issues/<n>/dependencies/blocked_by` has no open issue.
  Skip a blocked issue and say what blocks it.
- A leaf, not a parent: `gh api repos/sgtq/shooting-line/issues/<n>/sub_issues` has no open sub-issue.
  Skip a parent with open sub-issues. Its sub-issues are on the board themselves.

## 4. Suggest and confirm

Show the first eligible issue as the suggestion, with its number, title, project, and a one-line reason
("High priority" or "top of Todo for platform"). Show the next two as alternatives. Ask the user which one to take,
and wait for the answer. Never start work before the user confirms.

If nothing is eligible in any project, say so and list what is blocking the first few candidates.

## 5. Hand off

Once the user confirms, run the `work-ticket` skill with that issue number. It sets the status, picks the
branch, and carries on from there.
