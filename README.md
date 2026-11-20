# ShootingLine

ShootingLine is a Vue 3/npm-workspaces monorepo for archery club and tournament applications. It uses a shared Supabase sign-in and app-access portal.

## Repository layout

| Workspace          | Path                    | Status                                     |
| ------------------ | ----------------------- | ------------------------------------------ |
| Portal             | `apps/portal`           | Sign-in and app launcher                   |
| Tournament Manager | `apps/manager`          | Current club and tournament management app |
| Ianseo Dashboard   | `apps/ianseo-dashboard` | Placeholder                                |
| Shooting Scorecard | `apps/scorecard`        | Placeholder                                |
| Shared auth        | `packages/auth`         | Supabase client and app-access queries     |
| Shared language    | `packages/i18n`         | English and Latin American Spanish         |

Each app has its own README with its current features and commands.

## Workspace commands

Requirements: Node.js 22 (pinned in `.nvmrc` and `engines`; CI reads the same file) and npm.

```sh
npm install
npm run dev
npm run dev:portal
npm run dev:manager
npm run build
npm run preview
npm run test:unit
npm run test:coverage
npm run test:e2e
npm run cs-fix
npm run cs-check
npm run type-check
npm run ci
npm run test:all
```

`npm run dev` starts the portal and manager together, with the manager available at `/manager/` on the portal's origin. `npm run dev:portal` starts only the portal; `npm run dev:manager` starts the manager's local Vite server on port 5174. The production build publishes the portal at the site root and manager at `/manager/`. The two placeholder apps are not built or deployed.

Unit tests cover manager workflows and shared authentication access queries using mocked Supabase calls.
End-to-end tests in `tests/e2e/` fake the Supabase REST API and sign-in, so they need no real project. They start
their own dev server and never reuse one. If a dev server is already running on port 5173 or 5174, stop it first;
otherwise Playwright stops with an "already used" error.
The quality workflow runs on pull requests and pushes to `develop` and `main`. It has four jobs that run in parallel, so one failure does not hide the others: `lint-types` (ESLint, Prettier, `vue-tsc`), `unit`, `e2e`, and `build`. `build` starts only after `lint-types` and `unit` pass. Branch protection can require each job by its name. The database tests workflow starts a local Supabase stack and runs the pgTAP tests on the same events, and a failing test fails the check. The active Vue workspaces use JavaScript; `vue-tsc` checks Vue components and templates while `checkJs` remains disabled.

## Testing

- **Where tests go:** unit tests sit beside the file they cover and are named `<file>.test.js`, for example
  `App.test.js` beside `App.vue`. End-to-end specs go in `tests/e2e/` and are named `<flow>.spec.js`.
- **Shared setup:** `test-utils/vitest.setup.js` runs before every unit test file. It gives tests a working
  jsdom `localStorage` on every Node version and empties it after each test.
- **Shared helpers:** helpers used by more than one test live in a `test-utils/` folder, outside `src/`, so they
  are never part of a build. Root `test-utils/` holds helpers for the whole repo; an app keeps its own in
  `apps/<app>/test-utils/` (for example `apps/manager/test-utils/dialogTestKit.js`).
- **Unit tests:** `npm run test:unit` runs everything. Run one app or file with a path filter, for example
  `npx vitest run apps/manager` or `npx vitest run apps/manager/src/App.test.js`.
- **Coverage:** `npm run test:coverage` prints a summary and writes an HTML report to `coverage/`. There is no
  minimum threshold.
- **End-to-end tests:** `npm run test:e2e` runs all specs. Run one with `npx playwright test tests/e2e/<spec>`.
- **Database tests:** pgTAP tests in `supabase/tests/database/` check the migrations and the row-level security
  rules against a local Supabase database. They need [Docker](https://docs.docker.com/get-docker/) running and the
  [Supabase CLI](https://supabase.com/docs/guides/cli). They add no npm package.
  1. `supabase start` creates the local stack and applies every migration to a fresh database.
  2. `supabase test db` runs every file in `supabase/tests/database/`. Pass a file path to run only that file.
  3. `supabase db reset` rebuilds the local database from the migrations if an earlier run left it in a bad state.

  Name a test `<subject>.test.sql`. Each file opens with `begin;` and ends with `rollback;`, so it leaves no data
  behind and files do not affect each other. Write rows as the table owner, then call
  `pg_temp.sign_in_as(<user id>)` so the policies apply to the checks. Include it with
  `\ir ../helpers/sign_in_as.psql`. Shared helpers live in `supabase/tests/helpers/` with a `.psql` extension,
  because `supabase test db` runs every `.sql` file there as a test.

## Shared access and database

The portal and manager authenticate through Supabase Auth. PostgreSQL schema and RLS policies are in `supabase/migrations/`. The `app_access` table controls which app IDs a signed-in user can open. Manager roles are `admin`, `manager`, `club`, and `archer`; database RLS scopes club and archer data access. Club accounts need an active plan, assigned by a manager, to create tournaments. Archer accounts also hold plans and are locked out when they are not enabled. An enabled archer opens a separate view with the tournament calendar and their own scores. A club asks for a login for one of its archers (the archer needs an email), and a manager approves it, which creates the login with the free archer plan and emails a set-password link.

The repository does not contain project credentials. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in a local `.env` file based on `.env.example`. GitHub Pages builds use separate repository Actions variables for production and development. These Supabase URL and publishable-key values are public client configuration; the browser app does not use a service-role key.

Existing manager data in browser storage is left intact. If the manager database is empty, the app offers a one-time import into PostgreSQL and keeps the browser copy after import.

The portal and manager share an English/Latin American Spanish language selection, stored in the browser for the same
origin. The selection affects display only; user-entered records and stored values are not translated.

## GitHub Pages

The workflow at `.github/workflows/pages.yml` builds the current `main` site at the GitHub Pages root and the current `develop` preview under `/develop/` (or `/<repository>/develop/` on the default project-site domain), then deploys both together. Configure these repository Actions variables, using the production project's values for `PAGES_PRD_*` and the separate development project's values for `PAGES_DEV_*`:

- `PAGES_PRD_SUPABASE_URL` and `PAGES_PRD_SUPABASE_PUBLISHABLE_KEY`
- `PAGES_DEV_SUPABASE_URL` and `PAGES_DEV_SUPABASE_PUBLISHABLE_KEY`
- Optional `PAGES_PRD_BASE_PATH` and `PAGES_DEV_BASE_PATH` to override the default production and preview paths.

Both builds use the Node version in the `.nvmrc` on `develop`. The production build fetches that one file from `develop` because `main` may not have it yet, so a push to `develop` does not fail when `main` is behind.

The preview uses a separate development Supabase project and is labeled **DEVELOPMENT / QA** in the UI. Supabase Auth and `app_access` restrict app use and data, but GitHub Pages still serves the static HTML and JavaScript publicly. Do not put personal or service-role tokens in a browser build.

## Branching and database deployment

Use `develop` as the integration branch: branch feature work from `develop` and merge it back through pull requests. Promote changes from `develop` to `main` through a pull request; configure GitHub branch protection or a ruleset on `main` to require pull requests and block direct pushes. Repository instructions document this policy but cannot enforce it by themselves.

Supabase migration and Edge Function workflows target `develop` with the GitHub `development` environment and `main` with `production`. Configure each environment with its own Supabase project credentials before merging changes that trigger those workflows. The migration workflow needs the project's Session pooler connection URI in `SUPABASE_DB_URL` for GitHub Actions' IPv4 network. Functions deployments require `edge_functions_read` and `edge_functions_write` token scopes.

## Dev test users

`npm run seed:dev` creates test accounts in the **development** Supabase project: an admin, a manager, a club with an active plan, a club with a lapsed plan, and five archers (paid plan, free plan with an active club, free plan with a disabled club, free plan with no club, and no plan), plus the clubs and plans they need, and five tournaments for the archer view: two past ones with scores (one with a knockout match), one under way that the paid archer is entered in, one under way that they are not entered in, and a future one. The tournament dates count from today. Emails look like `seed-club-active@seed.example.com`, and all accounts share the password in `SEED_USER_PASSWORD`. Running it again refreshes the accounts and moves the plan dates to today. `npm run seed:dev:remove` deletes only the seed accounts, clubs, archers, plans, tournaments, tournament type, and category.

Set `PAGES_DEV_SUPABASE_URL`, `SUPABASE_PROJECT_ID` (the development project id), `SUPABASE_SERVICE_ROLE_KEY`, `SEED_USER_PASSWORD`, and optionally `PAGES_PRD_SUPABASE_URL` in your local `.env`. The script refuses to run unless the URL belongs to the development project id, refuses the production project, and rejects weak passwords (12+ characters with upper case, lower case, a digit, and a symbol). The service-role key is for this script only and never goes in a browser build.

The migration workflow runs the same script after each push to `develop`. Add `SUPABASE_SERVICE_ROLE_KEY` and `SEED_USER_PASSWORD` as secrets in the `development` GitHub environment (it already needs `SUPABASE_PROJECT_ID`), and set `PAGES_DEV_SUPABASE_URL` and `PAGES_PRD_SUPABASE_URL` as repository variables so the production check applies in CI too. The seed accounts then exist on the public development preview, so keep the password private.

The sign-in portal remains at the site root; ShootingLine does not have a public marketing landing page. Shared favicons, PWA manifest/icons, store icons, and the active social preview image are in `public/`. The Google Play feature graphic and four phone screenshots are in `public/store-graphics/`.

The feature-forward social card and store, legal, and press copy in `docs/` are drafts, not current product claims or public policy pages. The supplied copy describes features that are not implemented yet.
