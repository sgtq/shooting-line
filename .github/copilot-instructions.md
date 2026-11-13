# Repository instructions

- Keep the root `README.md` focused on repository-wide structure, shared setup, commands, and deployment.
- Maintain a `README.md` at the root of every app workspace under `apps/`, describing that app's current purpose, behavior, commands, and limitations.
- When a change affects one app, update that app's README. Update the root README when the change affects workspace structure, shared auth/database behavior, repository commands, or deployment.
- Describe only implemented behavior as available. Mark placeholders and incomplete integrations clearly; do not present plans or recommendations as current features.
- Keep documentation consistent with package scripts, environment variable names, migration names, and deployment paths.
- Keep Git history organized as work progresses: after verifying each coherent milestone, create a focused commit and push it to the current branch unless the user says otherwise. Do not amend or rewrite existing history unless explicitly requested.
- Before committing or pushing, review the worktree and diff, stage only files in scope, and exclude secrets, local configuration, generated output, and editor state. If pushing would deploy an incomplete or unconfigured change, do not push it to the deployment branch; use a feature branch or ask the user.
