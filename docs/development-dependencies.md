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

Next's ESLint plugin uses only `globSync(pattern, { onlyDirectories: true })`
from fast-glob. A dependency-scoped pnpm override supplies `tinyglobby@0.2.17`,
which supports that API. A scoped pnpm patch preserves absolute output paths
for absolute patterns, matching fast-glob behavior. `pnpm test:tooling` exercises the plugin's actual root
directory resolver, including brace patterns, arrays, directory filtering, and
Windows separators, and relative paths. Recheck the override whenever upgrading the Next ESLint
plugin; it is intentionally not a global replacement for fast-glob.

Together these changes remove braces and micromatch from the installed graph,
including the unpatched development-only advisory
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
No vulnerability is suppressed and no upstream version number is fabricated.
CI audits both production and development dependencies with
`pnpm audit --audit-level high`.
