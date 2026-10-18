import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export function runVercelBuild(environment, run = (args) => spawnSync("pnpm", args, { stdio: "inherit" })) {
  if (environment === "production") {
    const migration = run(["exec", "prisma", "migrate", "deploy"]);
    if (migration.error || migration.status !== 0) return migration.status || 1;
  }

  const build = run(["build"]);
  return build.error ? 1 : build.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = runVercelBuild(process.env.VERCEL_ENV);
}
