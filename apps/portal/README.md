# ShootingLine Main Menu

The portal is the shared entry point for ShootingLine. It signs users in through Supabase Auth and displays the apps assigned to the signed-in user.

## Current behavior

- Email and password sign-in for invited Supabase Auth users.
- Password recovery pages are shown only for one-time links requested by an admin or manager from Tournament Manager.
- Reads the user's app grants from `public.app_access`.
- Links to Tournament Manager only when the user has the `manager` grant.
- Shows the Ianseo Dashboard and Shooting Scorecard as unavailable placeholders.
- Provides sign-out and reports missing Supabase configuration or access-query errors.
- The GitHub Pages development preview uses its separate Supabase project and displays a Development / QA label.

There is no sign-up flow or self-service password reset link. An admin or manager initiates password recovery from Tournament Manager; Supabase Auth sends the recovery email and the recipient chooses a new password from its one-time link. App grants are assigned in Supabase. RLS policies remain the enforcement layer for database access.

## Configuration and commands

The main menu reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the app environment.

From the repository root:

```sh
npm run dev
npm run dev:portal
npm run build:portal
```

`npm run dev` starts the portal and manager together so the manager link works locally at `/manager/`; `npm run dev:portal` starts only the portal. Production is built at the GitHub Pages root; the development preview is deployed under `/develop/`.
