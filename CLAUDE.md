# Project instructions for shooting-line

## Git workflow

- Before creating a PR, show the full draft (title and body) in chat and wait for approval.
- Before committing, show the draft commit message in chat and wait for approval.

## Documentation

- Keep READMEs in step with the code. When a change alters behavior, access rules, setup steps,
  environment variables, or workflows, update the affected README in the same commit.
- Check `README.md` and the README of each app or package the change touches (for example
  `apps/manager/README.md` and `apps/portal/README.md`).
- Remove or reword statements the change makes false, such as "there is no X" or "only admins can Y".

## Tests

- Every feature or fix ships with all the tests it needs, in the same commit as the code. Do not leave
  tests for a follow-up.
- Pick the kinds by what changed, and add every kind that applies:
  - Unit tests (Vitest, `npm run test:unit`) for logic, services, and helpers.
  - Component tests (`@vue/test-utils` with jsdom) for what a component shows and does.
  - End-to-end tests (Playwright in `tests/e2e/`, `npm run test:e2e`) for user flows across screens, and for
    layout, styling, and browser behavior that jsdom cannot check.
  - Database changes (migrations, triggers, functions) need tests too. If there is no way to run them, say
    so in the PR instead of skipping them silently.
- Cover edge cases and failure paths, not only the happy path.
- A styling or bug fix test must fail without the fix. Check that before committing.
- Run the tests before committing, and report any failure plainly, including ones that fail for other reasons.
