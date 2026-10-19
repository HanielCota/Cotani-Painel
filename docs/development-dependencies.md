# Development dependencies

The application uses checked-in shadcn components. The shadcn CLI is not needed
for builds, tests, or runtime. To add a component intentionally, run the pinned
CLI on demand: `pnpm dlx shadcn@4.21.4 add <component>`, then review its changes.
The CLI's temporary dependency graph is outside the application lockfile and may
still contain upstream advisories; do not use it with untrusted registries or
patterns.

`src/styles/vendor/shadcn.css` is an unchanged copy of `shadcn@4.21.4`'s
`dist/tailwind.css`, with its MIT license retained alongside it. Keeping the
stylesheet locally preserves existing variants and animations without installing
the CLI's dependency tree. When updating it, review and copy both the stylesheet
and license from the selected upstream release.

Linting runs on Oxlint (`.oxlintrc.json`) with type-aware rules from
`oxlint-tsgolint`. ESLint, `eslint-config-next` and Next's ESLint plugin are not
installed, so the fast-glob override, the plugin patch and `pnpm test:tooling`
that existed for that plugin were removed with them. braces and micromatch stay
out of the installed graph, including the development-only advisory
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).

CI audits both production and development dependencies with
`pnpm audit --audit-level high`.
