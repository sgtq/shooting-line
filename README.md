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

Requirements: Node.js compatible with Vite 8 and npm.

```sh
npm install
npm run dev
npm run dev:portal
npm run dev:manager
npm run build
npm run preview
npm run test:unit
npm run test:e2e
npm run cs-fix
npm run cs-check
npm run type-check
npm run ci
npm run test:all
```

`npm run dev` starts the portal and manager together, with the manager available at `/manager/` on the portal's origin. `npm run dev:portal` starts only the portal; `npm run dev:manager` starts the manager's local Vite server on port 5174. The production build publishes the portal at the site root and manager at `/manager/`. The two placeholder apps are not built or deployed.

Unit tests cover manager workflows and shared authentication access queries using mocked Supabase calls.
The quality workflow runs ESLint, Prettier, `vue-tsc`, unit and end-to-end tests, and builds on pull requests and pushes to `develop` and `main`. The active Vue workspaces use JavaScript; `vue-tsc` checks Vue components and templates while `checkJs` remains disabled.

## Shared access and database

The portal and manager authenticate through Supabase Auth. PostgreSQL schema and RLS policies are in `supabase/migrations/`. The `app_access` table controls which app IDs a signed-in user can open. Manager roles are `admin`, `manager`, `club`, and `archer`; database RLS scopes club and archer data access.

The repository does not contain project credentials. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in a local `.env` file based on `.env.example`. GitHub Pages builds use separate repository Actions variables for production and development. These Supabase URL and publishable-key values are public client configuration; the browser app does not use a service-role key.

Existing manager data in browser storage is left intact. If the manager database is empty, the app offers a one-time import into PostgreSQL and keeps the browser copy after import.

The portal and manager share an English/Latin American Spanish language selection, stored in the browser for the same
origin. The selection affects display only; user-entered records and stored values are not translated.

## GitHub Pages

The workflow at `.github/workflows/pages.yml` builds the current `main` site at the GitHub Pages root and the current `develop` preview under `/develop/` (or `/<repository>/develop/` on the default project-site domain), then deploys both together. Configure these repository Actions variables, using the production project's values for `PAGES_PRD_*` and the separate development project's values for `PAGES_DEV_*`:

- `PAGES_PRD_SUPABASE_URL` and `PAGES_PRD_SUPABASE_PUBLISHABLE_KEY`
- `PAGES_DEV_SUPABASE_URL` and `PAGES_DEV_SUPABASE_PUBLISHABLE_KEY`
- Optional `PAGES_PRD_BASE_PATH` and `PAGES_DEV_BASE_PATH` to override the default production and preview paths.

The preview uses a separate development Supabase project and is labeled **DEVELOPMENT / QA** in the UI. Supabase Auth and `app_access` restrict app use and data, but GitHub Pages still serves the static HTML and JavaScript publicly. Do not put personal or service-role tokens in a browser build.

## Branching and database deployment

Use `develop` as the integration branch: branch feature work from `develop` and merge it back through pull requests. Promote changes from `develop` to `main` through a pull request; configure GitHub branch protection or a ruleset on `main` to require pull requests and block direct pushes. Repository instructions document this policy but cannot enforce it by themselves.

Supabase migration and Edge Function workflows target `develop` with the GitHub `development` environment and `main` with `production`. Configure each environment with its own Supabase project credentials before merging changes that trigger those workflows. The migration workflow needs the project's Session pooler connection URI in `SUPABASE_DB_URL` for GitHub Actions' IPv4 network. Functions deployments require `edge_functions_read` and `edge_functions_write` token scopes.

The sign-in portal remains at the site root; ShootingLine does not have a public marketing landing page. Shared favicons, PWA manifest/icons, store icons, and the active social preview image are in `public/`. The Google Play feature graphic and four phone screenshots are in `public/store-graphics/`.

The feature-forward social card and store, legal, and press copy in `docs/` are drafts, not current product claims or public policy pages. The supplied copy describes features that are not implemented yet.
