# ShootingLine Workspace Portal

The portal is the shared entry point for ShootingLine. It signs users in through Supabase Auth and displays the apps assigned to the signed-in user.

## Current behavior

- Email and password sign-in for invited Supabase Auth users.
- Reads the user's app grants from `public.app_access`.
- Links to Tournament Manager only when the user has the `manager` grant.
- Shows the Ianseo Dashboard and Shooting Scorecard as unavailable placeholders.
- Provides sign-out and reports missing Supabase configuration or access-query errors.

There is no sign-up flow or in-app grant management. App grants are assigned in Supabase. RLS policies remain the enforcement layer for database access.

## Configuration and commands

The portal reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the workspace environment.

From the repository root:

```sh
npm run dev
npm run build:portal
```

The portal is built at the site root for local preview and GitHub Pages deployment.
