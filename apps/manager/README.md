# ShootingLine Tournament Manager

The manager is the current archery club and tournament application. It is a Vue 3/Vite workspace under `apps/manager`.

## Features

- Club directory with contact and location details.
- Tournament types with reusable custom target types, and tournament categories.
- Archer directory and tournament rosters. A manager picks the category when adding an archer to a tournament
  (see [Category levels](#category-levels)).
- Per-tournament rounds and archer scores.
- First-round Olympic-style match seeding and match score entry.
- Light and dark themes.
- English and Latin American Spanish interface with a shared browser language preference.
- Dashboard cards, upcoming tournaments, and club previews that open their sections (see [Dashboard](#dashboard)).

## Category levels

Each category has a **level order** number, set when the category is created or edited. A lower number is a
lower level, and categories with different bow types are ranked separately (for example Recurve Youth 0,
Open 1, Pro 2). A category limited only by age, such as Masters, can be marked **Not part of the level order**.
It has no level order number, never blocks another category, and is never blocked.

- The Archers tab lists only the archers entered in that tournament, under **Archer**, **Category**, and
  **Actions** headers. The row shows the category as text. An archer with no category gets a category picker.
  In the Category column, managers get a pencil icon that opens a picker with the allowed categories until
  one is chosen or **Cancel** is pressed, and an X icon that removes only the category (the archer stays in
  the tournament and the picker returns). The Actions column has **Remove from tournament**, which asks for
  confirmation and keeps the archer in the archer database.
- **Add archer** on the Archers tab opens one form (see [Plans](#plans) for how archers are found). When the
  tournament has categories, the form also asks for the bow type and the category (limited to that bow type).
  Only the category is saved with the tournament entry. The bow type just narrows the list.
- An archer who has ever entered a category cannot enter a category of the same bow type with a lower level
  order, in any tournament, and cannot be moved down inside a tournament. Moving up is allowed. Blocked
  categories are disabled in the pickers for archers already in the tournament. For an archer picked from a search match, the
  database applies the rule and reports the refusal. Entries in other bow types do not count.
- Managers and admins change an archer's category in any tournament. A club user can do the same only in a tournament
  hosted by their own club, for archers of their own club, and only with an active plan (see [Plans](#plans)). The
  database also rejects a category that the tournament does not offer, so a direct call cannot assign one from another tournament.
- Removing an archer from a tournament, or removing only their category, clears that entry, so it no longer
  counts toward the rule.
- The database enforces the rule with a trigger on `tournament_participants`, so it holds for any client.
  The trigger locks per archer so two simultaneous entries cannot both pass, and it also runs when an
  entry is moved to another archer.
  Entries made before the rule existed are kept and count as history. Their starting level order comes from the
  category's minimum age and can be adjusted.
- Only managers and admins can import old browser data, and only into an empty database. The import keeps each
  category's level order and exemption. The database ranks any category that arrives without a level order by
  minimum age within its bow type, whichever client sent it, and the import keeps the archers' past entries as
  they were even when they break the rule.

## Dashboard

The dashboard is the first screen after sign-in. Each item opens the related screen:

- **Total tournaments** card: opens the Tournaments screen. The **Open tournaments** count button does the same.
- **Clubs** card: opens the Clubs screen. The club count button opens the same screen.
- **Archers** card: opens the Archers screen. The archer count button opens the same screen.
- **Up next** card: opens the next upcoming tournament. The **View tournament** link does the same. When no tournament is scheduled, the card does nothing.
- **Upcoming tournaments** rows: each row opens its tournament. Each row is a button named after the tournament, so keyboard and screen reader users can focus it and press Enter or Space.
- **Your clubs** rows: each row opens club details (see [Club details](#club-details)). Keyboard users use the **Details** button on the row.

Clicking a card or row does not open it when the user has selected text inside it, so text can be copied without navigating away. Cards that already contain a button (the stat cards and club rows) are not focusable themselves; their inner button is the keyboard control. The tournament cards on the Tournaments screen work like the upcoming tournaments rows.

### Club details

Club details depend on the signed-in role:

- **Admin and manager:** the row opens the club edit form. The **Details** button on the row does the same.
- **Club user:** the row opens the club edit form only for their own club. For other clubs, it opens the Clubs directory.
- **Archer:** the row opens the Clubs directory.

On the dashboard, the club row's status button shows whether the club user is enabled or disabled. Admins and managers can click it to enable or disable access. The status button is separate from **Details**, so clicking it does not open the club form. Club users see the status only, with no button.

## Data and access

Manager records are stored in Supabase PostgreSQL tables created and evolved by the migrations in `supabase/migrations/`. A signed-in account needs a Tournament Manager app grant. Database row-level security applies each user's access rules.

- **System admin:** can manage all records, assign or remove manager roles in **User access**, and send password reset emails.
- **Manager:** can create and manage clubs, tournament types, categories, tournaments, archers, and scores, enable or disable club users on the **Clubs** screen, and view **User access** to resend password reset emails to admin and manager accounts. Managers cannot add or remove roles. Managers also run the **Plans** screen (see [Plans](#plans)).
- **Club:** can read every club, tournament, entry, and score, including those of other clubs, and the full record of its own archers only. Other archers show to it by name, and only once they are entered in a tournament. A club cannot read another club's archers' birth dates or affiliation IDs, and cannot list archers it does not own. It can find one by exact affiliation ID or by name, which shows only the name and club. It can edit its own club's contact details and logo, but never the club's name or location, which only a manager or admin can change. It can create or edit archers for its own club. A club with an active plan can also create tournaments hosted by its own club and change them until they are started (see [Plans](#plans)). Clubs cannot create clubs, categories, or tournament types, delete tournaments, enter scores, or change tournaments of other clubs.
- **Archer:** read-only access to their own archer record and tournament entries, while the archer is enabled (see [Plans](#plans)). A disabled archer sees only a screen saying their user is not enabled.

Admins manage manager roles from **User access**; the account must already exist in Supabase Auth. Club user access is enabled or disabled directly from the **Clubs** screen using the club's email and name (which grants or revokes the `club` role automatically). Saving a club's details and its access happens in one step, so if the access change fails (for example, no account exists for the email), the details are not saved either. One account can hold the club role for only one club; enabling a second club with the same email is rejected, even when two requests arrive at the same time. Enabling uses the club's saved login email, and falls back to its contact email when none is saved. A club shows as Enabled when at least one account holds its club role, including roles an admin assigned directly. Admins and managers can resend a one-time password reset email from a row in **User access**. Any signed-in user who can open the profile dialog (everyone except archers) can choose **Email me a password reset link** there to reset their own password. Users can also request a reset from the portal sign-in screen. Club logos can be uploaded as JPG, PNG, or WebP files up to 2 MB.

The GitHub Pages development preview is served at `/develop/` (or `/<repository>/develop/` on the default project-site domain) and connects to the development Supabase project. Access to manager data is controlled by Supabase Auth, app access, and RLS roles. The static preview bundle itself is public, as required by GitHub Pages; never include private credentials in it.

### Plans

Admins and managers open **Plans** from the sidebar. Club and archer accounts hold plans. Each plan is made for one
role, and an account can only be given a plan made for its own role.

- A plan has a name, a role (club or archer), and a duration kind: monthly, yearly, custom range, or no end date. A
  plan can be deactivated, which hides it from new assignments but keeps existing subscriptions.
- **Archer basic** is the starting archer plan. It has no end date and costs 0 MXN, so a manager can later give it an
  end date or change its price. A subscription with no end date covers every day from its start. A manager sets its
  end date later with **Set end date** on the subscription row. One account still cannot hold two subscriptions that
  share a day, and a subscription with no end date shares a day with every later one.
- An archer is enabled while a subscription covers today and one of these holds: the subscription was paid for
  (price charged above 0), or it is free and the archer's club is active, or the archer has no club. A club is active
  while an account holds its club role and that account has a plan covering today. When a club is disabled or its plan
  ends, its archers on a free plan are disabled too, and archers with a paid plan stay enabled. The database enforces
  this. A disabled archer reads no tournaments, entries, scores, matches, clubs, categories, or tournament types, and
  the app shows only a screen saying their user is not enabled. They can still read their own account and
  subscriptions. Nothing grants an archer a plan automatically: a manager assigns it on this screen.
- Prices are in Mexican pesos (MXN) only. They are kept as history. Each price has an amount, a start date, and an
  optional end date. A price
  with an end date works as a deal. When several prices cover a day, the one with the latest start date applies, so
  the regular price returns after a deal ends.
- A manager gives an account a plan by choosing the account, the plan, a start date, and an end date. Both dates count as
  covered days, and one account cannot hold two plans that share a day. The app and the database both reject that. The end date is filled
  in for monthly and yearly plans and can be changed. For a custom range the manager picks it. For a plan with no end
  date the field can stay empty. The price is filled
  in from the catalogue and can be changed. The price charged is saved with the subscription, so later price changes
  do not alter it.
- A club can create tournaments only while a subscription covers today. The tournament is always hosted by the
  club's own club. Until the tournament is started, the club can edit it, choose the categories it offers, add rounds, and add or remove archers and set
  their category. Tournaments of other clubs are read-only for it.
- There is one add-archer form, with the affiliation IDs (World Archery and AETAY) at the top, then the last and
  first name. While the user types, the app looks for archers already in the database: by exact affiliation ID, or
  by the start of the last name (at least 3 letters) and optionally the first name. Each match shows only the
  archer's name and club, never an affiliation ID, birth date, or database ID, and at most 20 are shown. Archers
  already in the tournament are left out. Clicking a match selects it, and **Add to tournament** adds that archer.
  If no match is clicked, the form creates a new archer from what was typed. **Clear form** empties the form and any
  chosen match so a different archer can be found or created. When the form is opened from the
  Archers directory, matches are listed so the user can avoid a duplicate, but they cannot be picked.
- Archers are found only by affiliation ID or name, never by database ID. A match is a one-time token that belongs
  to the user who searched and expires after ten minutes, so the app never sends an archer's database ID to add them.
- Age-limited categories are checked in the database against the archer's age on the tournament date, so a club can
  enter an archer without ever seeing their birth date. The error names the category and never the age. An archer
  with no birth date is not limited. Managers are warned in the app but not blocked by the database.
- **Start tournament** locks a tournament for its club. A started tournament cannot be changed by a club, and only an
  admin or manager can reopen it with **Reopen tournament**. Managers can always edit. A club without an active plan, or whose plan has ended, cannot use the app. It sees a screen saying the plan for its
  club is no longer current, with the date its last plan ended, and nothing else loads. The database enforces this: it
  shows that club no tournaments, clubs, archers, categories, or tournament types, refuses its changes, and refuses
  its archer searches. It can still read its own account and subscription so the screen can explain. A manager has
  to assign a plan before the club can come back in. Password reset emails still work from the portal sign-in screen. Entering scores and deleting tournaments stay with managers. The category-level rule still looks at every tournament the archer entered, not
  only the club's own.
- There is no payment step. Managers record the plan by hand.

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

User-entered names and existing saved round labels are displayed as stored. Details returned by Supabase or other
services may remain in their original language.
