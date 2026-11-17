# Repository instructions

- Keep the root `README.md` focused on repository-wide structure, shared setup, commands, and deployment.
- Maintain a `README.md` at the root of every app workspace under `apps/`, describing that app's current purpose, behavior, commands, and limitations.
- When a change affects one app, update that app's README. Update the root README when the change affects workspace structure, shared auth/database behavior, repository commands, or deployment.
- Describe only implemented behavior as available. Mark placeholders and incomplete integrations clearly; do not present plans or recommendations as current features.
- Keep documentation consistent with package scripts, environment variable names, migration names, and deployment paths.
- Write comments to explain why non-obvious choices, constraints, workarounds, or invariants exist; do not narrate what the code already expresses.
- Prefer lines of 120 characters or fewer. Treat this as a soft limit and exceed it when wrapping would reduce clarity or conflict with established formatting.
- Keep classes and components small and cohesive; apply SOLID principles where they improve maintainability without adding unnecessary abstraction.
- Prefer reusing existing helpers and patterns over rewriting or duplicating equivalent logic.
- If requirements or intent are unclear, ask the user before proceeding; do not assume desired behavior, scope, environment, or permissions.
- Keep tests aligned with behavior changes, focused, and efficient. Remove tests for retired behavior, and avoid redundant, flaky, or unnecessarily slow tests.
- As soon as a development requirement is implemented, and before committing, pushing, or opening a pull request, analyse
  whether it needs tests. Design and add Vitest unit tests for new or changed logic and Playwright functional tests for
  new or changed user-facing flows, then run them. If a change needs no tests (for example documentation-only or purely
  cosmetic changes), say so explicitly instead of skipping the analysis.
- Use Vitest for unit and component tests and Playwright for browser end-to-end tests. Isolate tests from Supabase and other external services with fixtures or mocks, and run both suites in CI.
- Keep Git history organized as work progresses: after verifying each coherent milestone, create a focused commit and push it to the current branch unless the user says otherwise. Do not amend or rewrite existing history unless explicitly requested.
- Before committing or pushing, review the worktree and diff, stage only files in scope, and exclude secrets, local configuration, generated output, and editor state. If pushing would deploy an incomplete or unconfigured change, do not push it to the deployment branch; use a feature branch or ask the user.
- Use `develop` as the integration branch. Create feature and fix branches from `develop`, then merge them into `develop` through pull requests. Promote `develop` to `main` through a pull request; never push commits directly to `main`. Configure GitHub branch protection/rulesets to require pull requests on `main`; repository instructions alone do not enforce this server-side.
- Supabase `development` workflows run from `develop`, and `production` workflows run from `main`. Do not add feature branches as migration or deployment targets.
- Treat GitHub Pages builds, including `/develop/`, as public static assets. Restrict application data with Supabase Auth and RLS; never embed personal access tokens, service-role keys, or other private credentials in client code.
- Keep the sign-in portal at the site root; do not add a public marketing landing page unless the user changes this requirement.
- Keep store, legal, press, and marketing materials marked as drafts until their feature, data-practice, and publisher claims are verified. Do not publish placeholders or claim unfinished functionality as available.
