# ShootingLine

A simple Vue 3 workspace for managing archery clubs, tournaments, participants, round scores, and first-round Olympic-style match seeds.

> **Prototype status:** This version saves data in the current browser using `localStorage`. It has no sign-in, shared database, or real club accounts. Use the sample data to try the workflows, but do not enter real participant personal information or rely on this prototype for live event scoring.

## What works in this prototype

- Add clubs with a representative, phone, optional email and website, location address, map URL, and a club-user email.
- Enable or disable a club's listed user access.
- Create tournaments hosted at a club address or at a custom address.
- Create reusable tournament types with distance/unit, target type, number of ends (series), and arrows per end, then select a type when creating an event.
- Maintain a category catalogue with optional age limits and/or bow type, enable categories per tournament, and assign each shooter to an event category.
- Maintain a reusable participant directory with names, birth dates, and optional World Archery and AETAY affiliation numbers.
- Assign saved participants to tournaments or add a new participant directly to an event.
- Create one or more rounds inside each tournament and enter or update a shooter's numeric score for each round.
- Use the Scores module as a shooter scorebook, with a details view listing that shooter's tournament round and match results.
- Seed first-round matches inside the tournament from the selected round's scores: highest seed versus lowest, second-highest versus second-lowest, and so on.
- Record two scores for each seeded match.
- Save changes in this browser between visits. Use the circular reset button in the bottom-right corner to restore the example data.

Age eligibility is checked against the participant's age on the tournament date. Category names and limits are examples that can be changed to match your local rules; they are not official age divisions.

The match screen is a basic workflow prototype, not a complete competition system. It currently seeds the first round only within the selected category and requires an even number of scored participants; byes, archery set points, tie-breaks, advancement, and later bracket rounds are not implemented.

## Recommended database: Supabase

For the requested multi-user app, **Supabase (PostgreSQL + Supabase Auth)** is a good fit:

- The data is relational: clubs host tournaments, tournaments have participants, and scores belong to a participant, event, and round.
- PostgreSQL can enforce those relationships and keep tournament results consistent.
- Supabase provides hosted Postgres and authentication, with a free tier suitable for a small project (check the current plan limits before relying on it).
- A Vue app can still be hosted as static files on GitHub Pages and connect to Supabase over its client API.

GitHub Pages is only a static web host; it does not provide a database, user authentication, or a private server. A production version should replace the local storage layer with Supabase and enforce access using **Row Level Security (RLS)**. Club representatives should only access the records allowed to their club; administrators should have separate, controlled permissions. Creating/inviting auth users requires a trusted server-side function (for example, a Supabase Edge Function). Never place a Supabase service-role key in the Vue app or in GitHub Pages build variables. The Supabase publishable/anon key is intended for browser use only when database RLS is correctly configured.

Because this prototype does not yet connect to Supabase, its “club user” is only an email and enabled/disabled status in local data—not a login or security control.

## Run locally

Requirements: Node.js compatible with the installed Vite version and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. To verify a production build:

```sh
npm run build
npm run preview
```

## Deploy to GitHub Pages

1. Push this project to a GitHub repository.
2. In GitHub, open **Settings → Pages** and set the source to **GitHub Actions**.
3. Push to the `main` branch. The workflow at `.github/workflows/pages.yml` builds the Vue app and publishes `dist/`.

The Vite config derives the repository path for GitHub Pages project sites. For a custom domain, set the Actions variable `VITE_BASE_PATH` to `/` before building.

## Project structure

```text
.
├── .github/
│   └── workflows/
│       └── pages.yml       # Build and deploy to GitHub Pages
├── public/                 # Static public assets
├── src/
│   ├── assets/             # App assets
│   ├── components/
│   │   └── AppSidebar.vue  # Main workspace navigation
│   ├── App.vue             # App navigation, pages, forms, and workflows
│   ├── main.js             # Vue application entry point
│   └── style.css           # Global styles and responsive layout
├── index.html
├── package.json
└── vite.config.js
```

## Data model for the Supabase-backed version

The current browser object structure is a starting point for a relational schema:

- `clubs`: representative/contact fields, address, map URL, and club status.
- `profiles`: auth user ID, role (`admin` or `club`), and optional club ID; account enabled status should be enforced by database policies as well as the UI.
- `tournament_types`: reusable distance/unit, target type, ends, and arrows-per-end shooting formats.
- `categories`: reusable category name, optional minimum/maximum age, and optional bow type.
- `tournaments`: name, date, discipline, selected type, host club, and either the club venue or a custom venue.
- `participants`: first/last name, birth date, World Archery ID, and AETAY ID.
- `tournament_categories`: categories enabled for each tournament.
- `tournament_participants`: many-to-many link between events and the reusable participant directory, including each shooter's category for that event.
- `tournament_rounds` and `round_scores`: round definitions scoped to a tournament and each shooter's score in that round.
- `matches`: seeded participants, bracket round, and match-specific scores.

Participant birth dates and affiliation IDs are personal data. Before using real records, configure authentication, least-privilege RLS policies, backups, and appropriate data-retention practices in the backend.
