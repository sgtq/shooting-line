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
  changes. The launcher belongs to `portal`, not `manager`. If it spans apps, use `app:platform` or ask.
  If it is unclear, ask. Do not guess.
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

These match the web forms in `.github/ISSUE_TEMPLATE/` (what is needed, how we know it is done, depends
on, notes), with Context and Out of scope added. Write for someone who has not seen this conversation. Describe behavior, not a full design. Include
tests, docs, and Spanish translations in the acceptance criteria when the change needs them. Add
`Depends on: #N` only when there is a real dependency.

## 5. Confirm, then create

An issue is visible to everyone with access to the repo, so create nothing before approval. Show the full
draft in chat (title, labels, body, priority, board position, and any parent or dependencies) and wait. Then:

1. `gh issue create --title "<title>" --label "<app label>,<type label>" --body-file <file>`
   (write the body to a temp file in the scratchpad).
2. Add it to the single project: `gh project item-add 8 --owner sgtq --url <issue url> --format json`.
3. Set Status to Todo and always set a Priority (High, Medium, or Low). A ticket never goes on the board
   without one, because `next-ticket` sorts by priority. Use the app default unless the user says
   otherwise: `app:platform` High, `app:manager` Medium, `app:scorecard` Low. `app:portal` and
   `app:ianseo-dashboard` have no default, so propose one in the draft and ask. Get ids with
   `gh project field-list 8 --owner sgtq --format json`, then `gh project item-edit`.
4. Link the relationships (see step 6). Do not leave them only as text in the body.
5. Move the item to the right place on the board (see step 7).
6. Report the issue number, URL, labels, priority, and board position.

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

## 7. Board order

A new item lands at the bottom of the board. `next-ticket` reads the board order within each priority, so
move the item to where it belongs. Propose the position in the draft and wait for approval.

- Read the order: `gh project item-list 8 --owner sgtq --format json -L 200` (items come in board order).
- Within its priority and app, place the new item after every issue it is blocked by, and before every
  issue it blocks. If it has neither, put it after the last Todo item of the same priority and app, unless
  the user says it is more urgent. Then say which ticket it sits after.
- Move it with the GraphQL mutation. `afterId` is the project item id of the item it goes after (omit it to
  move to the top). Get the project id from `gh project view 8 --owner sgtq --format json`.
  `gh api graphql -f query='mutation($p:ID!,$i:ID!,$a:ID){updateProjectV2ItemPosition(input:{projectId:$p,itemId:$i,afterId:$a}){items(first:1){nodes{id}}}}' -f p=<project id> -f i=<new item id> -f a=<after item id>`
- Check with `gh project item-list` that the item is now in the expected spot. If the move fails, report
  it and ask the user to drag the card on the board.
