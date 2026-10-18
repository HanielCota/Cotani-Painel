import assert from "node:assert/strict";
import { test } from "node:test";
import { runVercelBuild } from "./vercel-build.mjs";

test("production applies migrations before building application code", () => {
  const calls = [];
  const status = runVercelBuild("production", (args) => {
    calls.push(args);
    return { status: 0 };
  });
  assert.equal(status, 0);
  assert.deepEqual(calls, [["exec", "prisma", "migrate", "deploy"], ["build"]]);
});

test("a failed migration prevents a production build", () => {
  const calls = [];
  const status = runVercelBuild("production", (args) => {
    calls.push(args);
    return { status: 7 };
  });
  assert.equal(status, 7);
  assert.deepEqual(calls, [["exec", "prisma", "migrate", "deploy"]]);
});

test("preview builds do not apply production database migrations", () => {
  const calls = [];
  const status = runVercelBuild("preview", (args) => {
    calls.push(args);
    return { status: 0 };
  });
  assert.equal(status, 0);
  assert.deepEqual(calls, [["build"]]);
});
