# ShootingLine Tournament Manager

The manager is the current archery club and tournament application. It is a Vue 3/Vite workspace under `apps/manager`.

## Features

- Club directory with contact and location details.
- Tournament types with reusable custom target types, and tournament categories.
- Archer directory and tournament rosters.
- Per-tournament rounds and archer scores.
- First-round Olympic-style match seeding and match score entry.
- Light and dark themes.
- Dashboard count shortcuts and upcoming/past tournament filters.

## Data and access

Manager records are stored in Supabase PostgreSQL tables created and evolved by the migrations in `supabase/migrations/`. A signed-in account needs a Tournament Manager app grant. Database row-level security applies each user's access rules.

- **System admin:** can manage all records, assign or remove manager roles in **User access**, and request password recovery emails.
- **Manager:** can create and manage clubs, tournament types, categories, tournaments, archers, and scores, and enable or disable club users on the **Clubs** screen.
- **Club:** can view its own club information and related tournaments and archers, edit its own club details, and create or edit archers for its own club only. Club accounts cannot create tournaments, clubs, categories, or tournament types.
- **Archer:** read-only access to their own archer record and tournament entries.

Admins manage manager roles from **User access**; the account must already exist in Supabase Auth. Club user access is enabled or disabled directly from the **Clubs** screen using the club's email and name (which grants or revokes the `club` role automatically). Admins can request a one-time password recovery email for an account; there is no self-service reset link in the main menu. Club logos can be uploaded as JPG, PNG, or WebP files up to 2 MB.

The GitHub Pages development preview is served at `/develop/` (or `/<repository>/develop/` on the default project-site domain) and connects to the development Supabase project. Access to manager data is controlled by Supabase Auth, app access, and RLS roles. The static preview bundle itself is public, as required by GitHub Pages; never include private credentials in it.

Target types are shared custom values. Add one with the + button in a tournament type form; no predefined target list is seeded.

When the database is empty, the manager checks for data under the previous local-storage keys and offers to import it. The import is transactional and preserves the browser copy. It is not performed automatically.

## Supabase migrations

The GitHub Actions workflow in `.github/workflows/supabase-migrations.yml` runs when a push to `develop` or `main` changes files under `supabase/migrations/`, or when manually dispatched. The `develop` branch uses the `development` GitHub environment; `main` uses `production`.

Configure these values in the GitHub `development` and `production` environments under **Repository Settings → Environments**:

- `SUPABASE_ACCESS_TOKEN` secret: create this from your Supabase account's **Access Tokens** page. Allow the target project and grant `edge_functions_read` and `edge_functions_write`.
- `SUPABASE_DB_URL` secret: copy the PostgreSQL URI from that project's **Connect** dialog. Use the **Session pooler** URI (port 5432) for GitHub Actions' IPv4 network. Its host should be the pooler host, not `db.<project-ref>.supabase.co`. The URI contains the database password.
- `SUPABASE_PROJECT_ID` secret: the project's **Reference ID**, under **Project Settings → General**.
- `SYSTEM_ADMIN_EMAIL` variable: email for an account that already exists in that project's Supabase Auth users.
- `SYSTEM_ADMIN_DISPLAY_NAME` variable: the name shown in the app.

Use the development project's values in the `development` environment and the production project's values in `production`. The email and display-name settings are variables, not secrets. `.env.example` lists the keys used by Actions as blank placeholders; never put real credentials in that file.

The migration workflow applies schema changes and then runs the idempotent administrator bootstrap through `SUPABASE_DB_URL`. The Auth user named by `SYSTEM_ADMIN_EMAIL` must already exist in the target Supabase project. Configure production environment approval rules in GitHub if production migrations require review.

The separate `.github/workflows/supabase-functions.yml` deploys the password-reset Edge Function when its source changes. Its Supabase access token needs project access and both `edge_functions_read` and `edge_functions_write` scopes; the CLI lists existing functions before deploying. It uses `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_ID` from the same GitHub environment. The database migration workflow uses the password inside `SUPABASE_DB_URL`, so it does not need a database write token scope. Supabase supplies the function's URL and API keys. Set each project's Auth **Site URL** to the correct app origin, configure allowed redirect URLs, and configure email delivery (preferably custom SMTP); the recovery email uses that Site URL.

Configure these repository Actions variables for the Pages workflow: `PAGES_PRD_SUPABASE_URL` and `PAGES_PRD_SUPABASE_PUBLISHABLE_KEY` for production; `PAGES_DEV_SUPABASE_URL` and `PAGES_DEV_SUPABASE_PUBLISHABLE_KEY` for the development preview. Optional `PAGES_PRD_BASE_PATH` and `PAGES_DEV_BASE_PATH` override the default site paths. Grant Manager app access in the development Supabase project only to accounts that should use the preview.

## Commands

From the repository root:

```sh
npm run dev
npm run dev:manager
npm run build:manager
npm run test:unit
```

`npm run dev` starts the portal and manager together, serving the manager at `/manager/` on the portal's origin. `npm run dev:manager` starts the manager Vite server on port 5174. The production manager bundle is written to `dist/manager/`.

## Limitations

The manager is not a complete competition system. Byes, set points, tie-breaks, advancement, and later bracket rounds are not implemented. Archer birth dates and affiliation IDs are personal data.
