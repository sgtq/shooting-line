---
name: resolve-pr-conflicts
description: Fix merge conflicts between a pull request branch and its base branch. Merges the base into the branch, resolves each conflict by keeping the intent of both sides, runs CI, and pushes. Use when the user says a PR has conflicts, cannot be merged, or asks to resolve or fix its conflicts.
argument-hint: '[PR number]'
---

# Resolve PR conflicts

Bring a PR branch up to date with its base and fix the conflicts. Follow `CLAUDE.md` and `CLAUDE.local.md`
the whole way. Use plain language, no em dashes, and ask the user when something is unclear instead of
guessing.

## 1. Find the PR and its base

- With a PR number, run `gh pr view <number> --json number,headRefName,baseRefName,mergeable,mergeStateStatus`.
  Without one, use the PR of the current branch (`gh pr view`).
- If `mergeable` is `MERGEABLE`, tell the user there is nothing to fix and stop. If it is `UNKNOWN`, wait a
  few seconds and check again.
- Check out the PR branch. Never resolve conflicts on `develop` or `main`.

## 2. Check the working tree

- Run `git status`. If there are uncommitted changes, do not merge over them. Ask the user whether they
  belong to this PR. Do not stash or reset them.
- If a plain fetch fails with an SSL certificate error on Windows, retry with
  `git -c http.sslBackend=schannel fetch origin`. Use the same flag for push.

## 3. Merge the base into the branch

- Fetch, then look at what the base gained: `git log --oneline HEAD..origin/<base>` and
  `git diff --name-only HEAD...origin/<base>`.
- Run `git merge --no-commit --no-ff origin/<base>`. Use a merge, not a rebase or a force push. The branch
  is already pushed and may be reviewed, so its history must not change.
- `git status --short` lists the conflicted files (`UU`, `AA`, `DU`, `UD`).

## 4. Resolve each conflict

For every conflicted file:

- Read both sides of each conflict block and the base's commit that changed it (`git log origin/<base> -- <file>`).
  Understand why each side changed before choosing.
- Keep the intent of both sides. Take one side whole only when the other side's change is already covered or
  is now wrong. Do not use `--ours` or `--theirs` on a whole file without reading it.
- Apply the project rules to the result: no em dashes, explicit return types, English and Spanish
  translations together, READMEs in step with the code.
- Migrations: never rename or edit a migration already on the base. If two branches added migrations, keep
  both and make sure the timestamps stay in order.
- Lock files: do not merge by hand. Take the base version, then run `npm install` to regenerate it.
- Remove every conflict marker. Check with `git grep -n '^<<<<<<<\|^>>>>>>>'`.
- If a conflict is a real design choice (two different behaviors, not two edits to the same text), stop and
  ask the user. Describe both options briefly.

Also look past the markers. Files that merged cleanly can still clash in meaning, for example the base added
a skill, template, or function that duplicates or contradicts the PR. Read what the base added. Tell the user
about overlaps and stale references (such as numbers or names the PR changed). Do not fix them silently when
they go beyond the conflict.

## 5. Verify

- Run `npm run ci` and the unit tests for the areas that changed (`npm run test:unit`).
- On Windows with `core.autocrlf=true`, Prettier may flag untouched files because of CRLF. Confirm with
  `npx prettier --check --end-of-line auto <changed files>` and report it.
- If something fails because of the merge, fix it. If it fails the same way on the base, say so.

## 6. Commit and push

- `CLAUDE.md` requires approval before committing. Show the draft merge commit message in chat and wait.
  Keep git's default first line (`Merge remote-tracking branch 'origin/<base>' into <branch>`). Add a short
  line per conflicted file saying which side was kept and why. End it with the attribution line from the
  session's system reminder.
- After approval: `git add` the resolved files, then `git commit`. Push with a normal `git push`. Never force
  push.
- If the merge goes wrong, `git merge --abort` returns the branch to where it was. Use it and start over
  instead of patching a bad merge.

## 7. Report back

Check `gh pr view <number> --json mergeable,mergeStateStatus` after the push. GitHub can take a few seconds
to update. Report: the files that conflicted and how each was resolved, what you ran and the result, whether
the PR is now mergeable, and any overlaps or open questions from step 4.
