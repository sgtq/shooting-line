# ShootingLine Tournament Manager

The manager is the current archery club and tournament application. It is a Vue 3/Vite workspace under `apps/manager`.

## Features

- Club directory with contact and location details.
- Tournament types and tournament categories.
- Participant directory and tournament rosters.
- Per-tournament rounds and participant scores.
- First-round Olympic-style match seeding and match score entry.
- Light and dark themes.

## Data and access

Manager records are stored in Supabase PostgreSQL tables created by `supabase/migrations/20261113170000_create_manager_data.sql`. The manager requires a Supabase session and a `manager` app grant; database tables also enforce that grant through RLS.

All manager users currently share the same records. The club user's email and enabled flag are directory data and do not create or control Supabase Auth accounts. Club-specific data permissions are not implemented.

When the database is empty, the manager checks for data under the previous local-storage keys and offers to import it. The import is transactional and preserves the browser copy. It is not performed automatically.

## Commands

From the repository root:

```sh
npm run dev:manager
npm run build:manager
```

The production manager bundle is written to `dist/manager/`.

## Limitations

The manager is not a complete competition system. Byes, set points, tie-breaks, advancement, and later bracket rounds are not implemented. Participant birth dates and affiliation IDs are personal data.
