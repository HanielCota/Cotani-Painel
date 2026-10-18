# Contributing

## Workflow

1. Create a branch from the latest `main`: `type/short-description`, such as
   `fix/password-recovery`, `feat/weekly-agenda`, or `chore/dependencies`.
2. Keep pull requests small and focused. Separate unrelated changes.
3. Submit changes through a pull request instead of pushing directly to `main`.
4. Run CI and request review from the owner listed in `.github/CODEOWNERS`.
   If a hosting or account issue prevents CI from running, document the blocker
   and the local validation results before the repository owner decides to merge.

## Language and commits

Write repository content and GitHub activity in English, including comments,
user-facing strings, documentation, commit messages, and pull requests. Preserve
proper names, external identifiers, and immutable cryptographic records exactly.
Use Conventional Commits: `fix(auth): ...`, `feat(agenda): ...`, `chore(deps): ...`,
`ci: ...`, `docs: ...`, `refactor: ...`, and `test: ...`.

## Validation

```bash
pnpm check
pnpm build
```

- For database changes, add a migration with `pnpm exec prisma migrate dev`.
  Never edit an applied migration. CI rebuilds the database and checks schema drift.
- For new environment variables, update `.env.example`, `scripts/check-env.mjs`,
  and the placeholder values in CI.
- Tests run in UTC. Always include explicit offsets in date fixtures.
- Use a local database for browser tests and experiments that write data.
  See `scripts/ci/supabase-bootstrap.sql` and the `database` job in
  `.github/workflows/ci.yml`. Local environment files may reference live services.
