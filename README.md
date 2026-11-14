# ShootingLine

ShootingLine is a Vue 3/npm-workspaces monorepo for archery club and tournament applications. It uses a shared Supabase sign-in and app-access portal.

## Repository layout

| Workspace | Path | Status |
| --- | --- | --- |
| Portal | `apps/portal` | Sign-in and app launcher |
| Tournament Manager | `apps/manager` | Current club and tournament management app |
| Ianseo Dashboard | `apps/ianseo-dashboard` | Placeholder |
| Shooting Scorecard | `apps/scorecard` | Placeholder |
| Shared auth | `packages/auth` | Supabase client and app-access queries |

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
```

`npm run dev` starts the portal and manager together, with the manager available at `/manager/` on the portal's origin. `npm run dev:portal` starts only the portal; `npm run dev:manager` starts the manager's local Vite server on port 5174. The production build publishes the portal at the site root and manager at `/manager/`. The two placeholder apps are not built or deployed.

## Shared access and database

The portal and manager authenticate through Supabase Auth. PostgreSQL schema and RLS policies are in `supabase/migrations/`. The `app_access` table controls which app IDs a signed-in user can open. Manager roles are `admin`, `manager`, `club`, and `archer`; database RLS scopes club and archer data access.

The repository does not contain project credentials. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in a local `.env` file based on `.env.example`. The GitHub Pages workflow reads variables with those names from repository Actions variables. The browser app does not use a service-role key.

Existing manager data in browser storage is left intact. If the manager database is empty, the app offers a one-time import into PostgreSQL and keeps the browser copy after import.

## GitHub Pages

The workflow at `.github/workflows/pages.yml` builds and deploys the portal and manager. Vite uses the repository path for GitHub Pages project sites; `VITE_BASE_PATH` can override it for a custom domain.

## Branching and database deployment

Use `develop` as the integration branch: branch feature work from `develop` and merge it back through pull requests. Promote changes from `develop` to `main` through a pull request; configure GitHub branch protection or a ruleset on `main` to require pull requests and block direct pushes. Repository instructions document this policy but cannot enforce it by themselves.

Supabase migration and Edge Function workflows target `develop` with the GitHub `development` environment and `main` with `production`. Configure each environment with its own Supabase project credentials before merging changes that trigger those workflows.

The sign-in portal remains at the site root; ShootingLine does not have a public marketing landing page. Shared favicons, PWA manifest/icons, store icons, and the active social preview image are in `public/`. The Google Play feature graphic and four phone screenshots are in `public/store-graphics/`.

The feature-forward social card and store, legal, and press copy in `docs/` are drafts, not current product claims or public policy pages. The supplied copy describes features that are not implemented yet.
