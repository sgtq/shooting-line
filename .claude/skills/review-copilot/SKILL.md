---
name: review-copilot
description: Check a pull request for open Copilot review suggestions. Verify each one against the code, fix the real ones, reply briefly to the ones that are wrong or not worth it, then resolve every handled thread. Use when the user asks to address, handle, or check Copilot suggestions or review comments on a PR.
argument-hint: '[PR number]'
---

# Review Copilot suggestions on a PR

Handle every open Copilot review thread on a pull request. Follow the working principles in
`CLAUDE.md` and `CLAUDE.local.md` the whole way through. Use plain language, no em dashes, and ask the
user when something is unclear instead of guessing.

## 1. Find the PR and its open Copilot threads

Use the PR number from the argument. If there is none, use the PR of the current branch:

```sh
gh pr view --json number,headRefName,baseRefName,headRefOid
```

Get the review threads with GraphQL. The REST comments endpoint does not show thread ids or whether a
thread is resolved.

```sh
gh api graphql -f query='
query($owner:String!,$repo:String!,$number:Int!){
  repository(owner:$owner,name:$repo){
    pullRequest(number:$number){
      reviewThreads(first:100){
        nodes{
          id isResolved isOutdated path line
          comments(first:20){ nodes{ author{login} body } }
        }
      }
    }
  }
}' -f owner=OWNER -f repo=REPO -F number=NUMBER
```

Keep a thread only when it is not resolved and its first comment was written by Copilot (the login
contains `copilot`, case-insensitive). Ignore everything else. If there are none, say so and stop.

## 2. Get on the right branch

- Fetch first. If a plain fetch fails with an SSL certificate error on Windows, retry with
  `git -c http.sslBackend=schannel fetch origin` (same for push).
- Read the code at the PR head, not a stale local copy. Compare with `git show origin/<head>:<path>`.
- Never commit on `develop` or `main`. If the PR head branch is one of them, create a branch
  (`fix/...`) from `origin/<head>` for the changes and tell the user a PR will be needed.
  Otherwise check out the PR head branch and make sure it is up to date.

## 3. Judge each thread before touching code

For every thread, read the whole conversation and the code it points at (the thread may be outdated, so
find the current location). Verify the claim against the code, do not trust the comment. Decide one of:

- **Fix**: the issue is real, worth the change, and should be fixed.
- **Reject**: the issue is not real, is already handled, or is not worth the change. Know the reason.
- **Already fixed**: a later commit already addresses it.

If you cannot tell which one, ask the user before acting.

## 4. Fix the real ones (no reply on the thread)

- Make the smallest change that solves the problem. Do not reply on a thread you fixed.
- Follow project rules: SOLID, explicit return types, concise comments that explain why, and no em dashes.
- Update tests in the same commit. Cover the changed behavior, including edge cases.
- Update both English and Spanish (`packages/i18n/src/spanish.js`) for any user-facing text.
- Update the README of every app or package the change touches when behavior, setup, or access rules change.
- Supabase migrations that are already merged must not be edited. Add a new timestamped migration
  (`YYYYMMDDHHMMSS_description.sql`).
- Run `npm run ci`. On Windows with `core.autocrlf=true`, Prettier may flag untouched files because of
  CRLF. Confirm that with `npx prettier --check --end-of-line auto <changed files>` and report it.

## 5. Commit and push

`CLAUDE.md` requires approval before committing. Show the draft commit message in chat and wait for the
user to approve. End the message with the attribution line from the session's system reminder. After
approval, commit and push. Do not resolve anything before the push succeeds.

If no thread needed a fix, there is nothing to commit. Skip to step 6.

## 6. Reply to rejected threads, then resolve

Only after the push (or immediately when nothing was changed):

- **Rejected thread**: post one short, plain reply that gives the reason, then resolve it. Keep it to one
  or two sentences. Name the specific code or fact that makes the suggestion wrong. No em dashes, no
  apologies, no filler.
- **Fixed thread**: resolve it without a reply.
- **Already fixed thread**: resolve it without a reply.

Reply:

```sh
gh api graphql -f query='
mutation($id:ID!,$body:String!){
  addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$id,body:$body}){
    comment{ id }
  }
}' -f id=THREAD_ID -f body='REPLY TEXT'
```

Resolve:

```sh
gh api graphql -f query='
mutation($id:ID!){
  resolveReviewThread(input:{threadId:$id}){ thread{ isResolved } }
}' -f id=THREAD_ID
```

Resolve only threads you handled. Leave any thread you asked the user about unresolved.

## 7. Report back

Give the user a short list, one line per thread: the file, the verdict (fixed, rejected, already
fixed, or left open), and the reason in a few words. Include the commit hash and branch if you pushed.
Say plainly about anything you could not do or verify.
