# ShootingLine Main Menu

The portal is the shared entry point for ShootingLine. It signs users in through Supabase Auth and displays the apps assigned to the signed-in user.

## Current behavior

- Email and password sign-in for invited Supabase Auth users.
- A **Forgot your password?** link on the sign-in screen emails a one-time recovery link to the address entered. The confirmation is the same for every address, so it does not reveal which accounts exist.
- The password recovery page opens from a one-time link requested by the user, or resent by an admin or manager from Tournament Manager.
- Reads the user's app grants from `public.app_access`.
- Links to Tournament Manager only when the user has the `manager` grant.
- Shows the Ianseo Dashboard and Shooting Scorecard as unavailable placeholders.
- Each app tile has a decorative inline SVG icon (clipboard with pencil, checklist, scoreboard) that follows the tile's text color.
- Provides sign-out and reports missing Supabase configuration or access-query errors.
- Uses a dark theme when the system or browser asks for dark mode; there is no manual switch.
- Offers English and Latin American Spanish, sharing the browser's language preference with Tournament Manager.
- The GitHub Pages development preview uses its separate Supabase project and displays a Development / QA label.

There is no sign-up flow. Users can request password recovery from the sign-in screen, and admins and managers can resend it from Tournament Manager; Supabase Auth sends the recovery email and the recipient chooses a new password from its one-time link. App grants are assigned in Supabase. RLS policies remain the enforcement layer for database access.

Supabase and other service error details may remain in their original language.

## Configuration and commands

The main menu reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the app environment.

From the repository root:

```sh
npm run dev
npm run dev:portal
npm run build:portal
```

`npm run dev` starts the portal and manager together so the manager link works locally at `/manager/`; `npm run dev:portal` starts only the portal. Production is built at the GitHub Pages root; the development preview is deployed under `/develop/`.
