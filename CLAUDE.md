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
- Keep Spanish copies in step too. When a README, user manual, or runbook has a Spanish (es-419) copy,
  update that copy in the same commit as the English change. Do not leave the two out of sync.

## Current stack

Use these tools and versions as the default. Ask before adding a new library or framework.

- Package manager and layout: npm workspaces (`apps/*`, `packages/*`).
- Frontend: Vue 3 (`vue` ^3.5), Pinia 3 (shared state in the manager app), Vite 8, Tailwind CSS 3, PostCSS,
  Autoprefixer.
- Language: JavaScript for app code. TypeScript 6 and `vue-tsc` run only for `type-check`.
- Lint and format: ESLint 10 (flat config, `eslint.config.js`, with `eslint-plugin-vue`) and
  Prettier 3. Prettier style: no semicolons, single quotes, trailing commas, `printWidth` 120.
- Unit tests: Vitest 4, `@vue/test-utils`, jsdom.
- End-to-end tests: Playwright (`@playwright/test`).
- Backend: Supabase (Postgres migrations in `supabase/migrations/`, edge functions in
  `supabase/functions/`).
- CI: GitHub Actions workflows in `.github/workflows/` (`quality.yml`, `pages.yml`,
  `supabase-functions.yml`, `supabase-migrations.yml`).

## Standard directory layout

- `apps/portal/`, `apps/manager/`: Vue + Vite applications. Each has `src/`, `index.html`,
  `vite.config.js`, and `README.md`.
- `apps/ianseo-dashboard/`, `apps/scorecard/`: app packages.
- `packages/auth/`, `packages/i18n/`: shared workspace packages. Source lives in `src/`.
- `tests/e2e/`: Playwright specs.
- `supabase/`: `config.toml`, `migrations/`, `functions/`, and SQL bootstrap scripts.
- `scripts/`: build and tooling helpers.
- `docs/`: planning notes, drafts, and assets. Not for code.

Place unit tests next to the source file they cover (for example, `App.test.js` beside `App.vue`).
Place new shared code in `packages/` only when more than one app uses it.
Inside `apps/manager/src/`, pages, tabs, and dialog forms are components in `components/`, shared state is the Pinia
store in `stores/`, logic that changes data is a composable in `composables/`, and plain functions are in `services/`.
See `apps/manager/README.md` for details.

## Supabase migrations

- Migration files in `supabase/migrations/` use timestamped names (`YYYYMMDDHHMMSS_description.sql`). Keep that
  format.
