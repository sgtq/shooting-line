---
name: create-ticket
description: Create a GitHub issue for a new ticket. Writes a clear body, picks the app and type label, prefixes the title with the app, and adds the issue to the ShootingLine project. Use when the user asks to create, file, open, or write a ticket or issue.
argument-hint: '<short description of the work>'
---

# Create a ticket

Tickets are GitHub issues in `sgtq/shooting-line`. Follow `CLAUDE.md` and `CLAUDE.local.md`. Use plain
language, no em dashes, and ask the user when something is unclear instead of guessing.

## 1. Understand the request

- Read the user's description. Look at the code it touches so the ticket names real files and areas.
- If the scope, the app, or the expected result is unclear, ask before drafting.
- Check for a duplicate: `gh issue list --search "<keywords>" --state all -L 10`. If one exists, tell the
  user and ask what to do.

## 2. Pick the app and labels

- App label (exactly one): `app:manager`, `app:portal`, `app:scorecard`, `app:ianseo-dashboard`, or
  `app:platform` (CI, deploy, database, shared packages, cross-app work). Choose from the code the work
  changes. If it spans apps, use `app:platform` or ask.
- Type label (exactly one): `bug` (something broken), `enhancement` (new feature or improvement),
  `documentation`, or `accessibility`. Use the labels that exist: `gh label list`.

## 3. Write the title

Format: `[<app>] <short summary>`, where `<app>` is the app label without `app:`. Example:
`[manager] Move the dialog state out of App.vue`. Start the summary with a verb or the thing affected,
keep it under about 70 characters, and do not add a ticket number.

## 4. Write the body

Use these sections. Skip a section only when it has nothing useful to say.

```
## Summary
One or two sentences: what is needed and why.

## Context
What exists today, where it lives (files or areas), and any constraint or decision that matters.

## Acceptance criteria
- [ ] Observable results that show the work is done, one per line.

## Out of scope
Related work this ticket does not cover.

Depends on: #N
```

Write for someone who has not seen this conversation. Describe behavior, not a full design. Include
tests, docs, and Spanish translations in the acceptance criteria when the change needs them. Add
`Depends on: #N` only when there is a real dependency.

## 5. Confirm, then create

Show the full draft in chat (title, labels, body, priority) and wait for approval. Then:

1. `gh issue create --title "<title>" --label "<app label>,<type label>" --body-file <file>`
   (write the body to a temp file in the scratchpad).
2. Add it to the single project: `gh project item-add 8 --owner sgtq --url <issue url> --format json`.
3. Set Status to Todo. Set Priority by app unless the user says otherwise: `app:platform` High,
   `app:manager` Medium, `app:scorecard` Low, `app:ianseo-dashboard` and `app:portal` none. Get ids with
   `gh project field-list 8 --owner sgtq --format json`, then `gh project item-edit`.
4. Report the issue number, URL, labels, and priority.

5. Link the relationships (see step 6). Do not leave them only as text in the body.

## 6. Relationships to other issues

Look for related issues in step 1 (`gh issue list --search`, parent epics, tickets touching the same
files). Propose the links in the draft and wait for approval. Use GitHub's real relationships, not only
`#N` text:

- **Parent and sub-issues:** when the ticket is a piece of a larger one, make it a sub-issue of the parent.
  `gh api -X POST repos/sgtq/shooting-line/issues/<parent>/sub_issues -F sub_issue_id=<child issue id>`
  (`sub_issue_id` is the numeric `id` from `gh api repos/sgtq/shooting-line/issues/<child>`, not the number).
- **Blocked by and blocking:** when work must happen first, add the dependency.
  `gh api -X POST repos/sgtq/shooting-line/issues/<this>/dependencies/blocked_by -F issue_id=<blocker id>`.
  Also keep the `Depends on: #N` line in the body, because `work-ticket` reads it.
- **Related only:** mention `Related: #N` in the Context section. There is no formal link for it.

Verify each link with `gh api repos/sgtq/shooting-line/issues/<number>/sub_issues` or `.../dependencies/blocked_by`.
If a call fails, report which link failed and ask the user to add it in the issue sidebar.
