import assert from "node:assert/strict";
import { test } from "node:test";
import { migrateSavedGraphRecord } from "./saved-graphs.ts";

const MULTI_STATE = {
  v: 1 as const,
  rows: [{ source: "sin(x)", color: 0x2563eb, visible: true, params: {} }],
  viewport: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
};

test("migrateSavedGraphRecord defaults a missing kind to 'multi' (pre-kind on-disk records)", () => {
  const legacy = { id: "abc", title: "Untitled", createdAt: 1700000000000, state: MULTI_STATE };
  const migrated = migrateSavedGraphRecord(legacy);
  assert.equal(migrated.kind, "multi");
  assert.equal(migrated.id, "abc");
  assert.equal(migrated.title, "Untitled");
  assert.equal(migrated.createdAt, 1700000000000);
  assert.deepEqual(migrated.state, MULTI_STATE);
});

test("migrateSavedGraphRecord leaves an explicit kind untouched", () => {
  const record = { id: "def", title: "My Notebook", createdAt: 1700000001000, kind: "notebook" as const, state: { v: 1 as const, blocks: [] } };
  const migrated = migrateSavedGraphRecord(record);
  assert.equal(migrated.kind, "notebook");
});

test("migrateSavedGraphRecord doesn't default an explicit 'multi' kind to something else", () => {
  const record = { id: "ghi", title: "Explicit Multi", createdAt: 1700000002000, kind: "multi" as const, state: MULTI_STATE };
  const migrated = migrateSavedGraphRecord(record);
  assert.equal(migrated.kind, "multi");
});
