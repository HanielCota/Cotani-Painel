import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const configRequire = createRequire(require.resolve("eslint-config-next"));
const pluginRequire = createRequire(configRequire.resolve("@next/eslint-plugin-next"));
const { getRootDirs } = pluginRequire("./utils/get-root-dirs.js");

// Exercise Next's actual consumer of the fast-glob -> tinyglobby override.
test("Next resolves directory globs with braces, arrays and Windows separators", () => {
  const root = mkdtempSync(join(tmpdir(), "cotani-glob-"));
  try {
    for (const app of ["panel", "landing", "other"]) {
      mkdirSync(join(root, app));
    }
    writeFileSync(join(root, "file"), "not a directory");
    const normalize = (paths) => paths.map((path) => path.replaceAll("\\", "/").replace(/\/$/, "")).sort();
    const resolve = (rootDir) => normalize(getRootDirs({ cwd: root, settings: { next: { rootDir } } }));
    const expected = normalize([join(root, "panel"), join(root, "landing")]);
    assert.deepEqual(resolve(`${root}/{panel,landing}`), expected);
    assert.deepEqual(resolve([`${root}/panel`, `${root}/landing`, 42]), expected);
    assert.deepEqual(resolve(`${root}/*`), normalize([join(root, "panel"), join(root, "landing"), join(root, "other")]));
    assert.deepEqual(resolve(`${root}/{panel,landing}`.replaceAll("/", "\\")), expected);
    const relativeRoot = relative(process.cwd(), root).replaceAll("\\", "/");
    assert.deepEqual(resolve(`${relativeRoot}/{panel,landing}`), normalize([`${relativeRoot}/panel`, `${relativeRoot}/landing`]));
    assert.deepEqual(getRootDirs({ cwd: root, settings: {} }), [root]);
  } finally {
    rmSync(root, { recursive: true });
  }
});
