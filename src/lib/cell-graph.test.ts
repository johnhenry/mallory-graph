import assert from "node:assert/strict";
import { test } from "node:test";
import { CellGraph, CircularDependencyError } from "./cell-graph.ts";

test("set/get a raw source cell", () => {
  const g = new CellGraph();
  g.set("a", 5);
  assert.equal(g.get("a"), 5);
});

test("derived cell recomputes from its dependencies", () => {
  const g = new CellGraph();
  g.set("a", 2);
  g.set("b", 3);
  g.define("sum", () => g.get<number>("a") + g.get<number>("b"));
  assert.equal(g.get("sum"), 5);
  g.set("a", 10);
  assert.equal(g.get("sum"), 13);
});

test("dirty propagates transitively through a chain", () => {
  const g = new CellGraph();
  g.set("a", 1);
  g.define("b", () => g.get<number>("a") * 2);
  g.define("c", () => g.get<number>("b") + 1);
  assert.equal(g.get("c"), 3);
  g.set("a", 5);
  assert.equal(g.get("c"), 11);
});

test("dependencies rebuild fresh on each recompute (conditional deps)", () => {
  const g = new CellGraph();
  g.set("useA", true);
  g.set("a", 1);
  g.set("b", 100);
  g.define("out", () => (g.get<boolean>("useA") ? g.get<number>("a") : g.get<number>("b")));
  assert.equal(g.get("out"), 1);

  // Switch to depending on b instead of a; a's future writes must no longer affect out.
  g.set("useA", false);
  assert.equal(g.get("out"), 100);
  g.set("a", 999);
  assert.equal(g.get("out"), 100);
  g.set("b", 200);
  assert.equal(g.get("out"), 200);
});

test("structural sharing preserves object identity across a no-op recompute", () => {
  const g = new CellGraph();
  g.set("a", 1);
  g.define("parity", () => ({ label: g.get<number>("a") % 2 === 0 ? "even" : "odd" }));

  const first = g.get("parity");
  assert.deepEqual(first, { label: "odd" });
  const versionAfterFirst = g.getVersion("parity");

  // a: 1 -> 3 is a real change, but parity's *output* is structurally the
  // same ("odd") -> the cached reference (and version) must be preserved,
  // which is what lets a downstream Object.is check bail out of a redraw.
  g.set("a", 3);
  const second = g.get("parity");
  assert.equal(second, first, "same reference preserved when recompute is structurally unchanged");
  assert.equal(g.getVersion("parity"), versionAfterFirst);

  // a: 3 -> 4 flips parity to "even" -> genuinely different, new reference.
  g.set("a", 4);
  const third = g.get("parity");
  assert.notEqual(third, first);
  assert.deepEqual(third, { label: "even" });
  assert.ok(g.getVersion("parity") > versionAfterFirst);
});

test("subscribe fires on change, not on a structurally-equal no-op write", () => {
  const g = new CellGraph();
  g.set("a", { x: 1 });
  let calls = 0;
  const unsub = g.subscribe("a", () => calls++);
  g.set("a", { x: 1 }); // structurally equal -> no emit
  assert.equal(calls, 0);
  g.set("a", { x: 2 });
  assert.equal(calls, 1);
  unsub();
  g.set("a", { x: 3 });
  assert.equal(calls, 1);
});

test("subscribeAll fires for changes on any cell", () => {
  const g = new CellGraph();
  g.set("a", 1);
  let calls = 0;
  g.subscribeAll(() => calls++);
  g.set("a", 2);
  g.set("b", 3);
  assert.equal(calls, 2);
});

test("throws on a circular dependency", () => {
  const g = new CellGraph();
  g.define("a", () => g.get<number>("b") + 1);
  g.define("b", () => g.get<number>("a") + 1);
  assert.throws(() => g.get("a"), CircularDependencyError);
});

test("delete detaches a cell from its dependents and dependencies", () => {
  const g = new CellGraph();
  g.set("a", 1);
  g.define("b", () => g.get<number>("a") + 1);
  assert.equal(g.get("b"), 2);
  g.delete("a");
  assert.equal(g.has("a"), false);
  g.set("a", 100);
  // "b" was defined against the old "a" cell instance; a fresh "a" cell means
  // "b" is no longer marked dirty by writes to the new one until re-defined.
  g.define("b", () => g.get<number>("a") + 1);
  assert.equal(g.get("b"), 101);
});
