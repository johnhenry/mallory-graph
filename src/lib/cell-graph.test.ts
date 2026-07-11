import assert from "node:assert/strict";
import { test } from "node:test";
import { CellGraph, CircularDependencyError } from "./cell-graph.ts";

test("set/get a raw source cell", () => {
  const g = new CellGraph();
  g.set("a", 5);
  assert.equal(g.get("a"), 5);
});

test("has() returns true the instant a cell is merely read, even before it's ever been set/defined -- hasValue() does not", () => {
  // This is the exact real-world footgun a production bug traced back to
  // (ExpressionRow.tsx's init guard): a caller elsewhere in the app (e.g. a
  // subscribeAll listener firing reentrant mid-render) reads a not-yet-
  // initialized id via a bare get(), which silently ensure()s an empty
  // record. A later "was this already initialized?" check that uses has()
  // instead of hasValue() is fooled into skipping real initialization.
  const g = new CellGraph();
  assert.equal(g.has("never-touched"), false);
  assert.equal(g.hasValue("never-touched"), false);
  g.get("never-touched"); // a bare read, no set()/define() -- ensure()s an empty record as a side effect
  assert.equal(g.has("never-touched"), true, "has() is fooled by the bare read");
  assert.equal(g.hasValue("never-touched"), false, "hasValue() is not -- no real value was ever produced");
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

test("role reports free for a set cell, dependent for a define cell, unknown before any value exists", () => {
  const g = new CellGraph();
  assert.equal(g.role("never-touched"), "unknown");
  g.set("a", 1);
  assert.equal(g.role("a"), "free");
  g.define("b", () => g.get<number>("a") + 1);
  assert.equal(g.role("b"), "unknown"); // defined but not yet read/recomputed
  g.get("b");
  assert.equal(g.role("b"), "dependent");
});

test("role updates when a cell transitions between set and define", () => {
  const g = new CellGraph();
  g.set("a", 1);
  assert.equal(g.role("a"), "free");
  g.define("a", () => 2);
  g.get("a");
  assert.equal(g.role("a"), "dependent");
  g.set("a", 3);
  assert.equal(g.role("a"), "free");
});

test("isAuxiliary defaults to false, and is set/preserved per the set/define auxiliary option", () => {
  const g = new CellGraph();
  g.set("a", 1);
  assert.equal(g.isAuxiliary("a"), false);
  g.set("hidden", 1, { auxiliary: true });
  assert.equal(g.isAuxiliary("hidden"), true);
  // A later set() on the same still-free cell without an explicit option
  // leaves the previously-set auxiliary flag alone rather than resetting it.
  g.set("hidden", 2);
  assert.equal(g.isAuxiliary("hidden"), true);
});

test("list enumerates every cell with its role and auxiliary flag", () => {
  const g = new CellGraph();
  g.set("a", 1);
  g.set("hidden", 2, { auxiliary: true });
  g.define("b", () => g.get<number>("a") + 1);
  g.get("b");
  const entries = new Map(g.list().map((e) => [e.id, e]));
  assert.deepEqual(entries.get("a"), { id: "a", role: "free", auxiliary: false, hasValue: true });
  assert.deepEqual(entries.get("hidden"), { id: "hidden", role: "free", auxiliary: true, hasValue: true });
  assert.deepEqual(entries.get("b"), { id: "b", role: "dependent", auxiliary: false, hasValue: true });
});

test("delete() marks former dependents dirty so their next get() recomputes without the deleted cell", () => {
  // Mirrors ExpressionRow's params compute exactly: read an external cell
  // unconditionally (registering the edge even before it exists), use it
  // only if it has a real value, else fall back to a local cell.
  const g = new CellGraph();
  g.set("external", 5);
  g.set("local", 1);
  g.define("out", () => {
    const ext = g.get<number | undefined>("external");
    return g.hasValue("external") ? (ext as number) : g.get<number>("local");
  });
  assert.equal(g.get("out"), 5);
  g.delete("external");
  assert.equal(g.get("out"), 1, "recomputes and falls back to the local cell");
  // The recompute above rebuilt out's dependency edges -- a later write to
  // the fallback dependency must now reach it (before the delete() fix,
  // the edge never rebuilt, so this write was silently lost too).
  g.set("local", 42);
  assert.equal(g.get("out"), 42);
});

test("delete() notifies subscribers of former dependents (not just marks dirty)", () => {
  const g = new CellGraph();
  g.set("source", 1);
  g.define("derived", () => g.get<number>("source") * 2);
  g.get("derived");
  let notified = 0;
  g.subscribe("derived", () => notified++);
  g.delete("source");
  assert.ok(notified >= 1, "the dependent's subscriber fired on delete of its dependency");
});

test("delete() of a nonexistent or never-touched id is a harmless no-op", () => {
  const g = new CellGraph();
  g.delete("never-existed"); // must not throw
  g.set("a", 1);
  g.delete("a");
  g.delete("a"); // double delete is fine too
  assert.equal(g.hasValue("a"), false);
});

test("get() on a deleted id re-creates an empty record with 'never existed' semantics", () => {
  const g = new CellGraph();
  g.set("a", 7);
  g.delete("a");
  assert.equal(g.get("a"), undefined);
  assert.equal(g.hasValue("a"), false);
});

test("a compute that reads a sibling id before it's ever been set/defined sees undefined, then recomputes once that sibling is later defined (the mallory-graph#10 pattern)", () => {
  const g = new CellGraph();
  // Mirrors LinkedGraphPanes/Linked3DView's combinedDuration: defined before
  // either "pane" has mounted and defined its own timelineDuration cell.
  g.define("combined", () => {
    const a = g.get<number>("pane-a-duration");
    const b = g.get<number>("pane-b-duration");
    return Math.max(Number.isFinite(a) ? a : 0, Number.isFinite(b) ? b : 0);
  });
  // First read, before either pane exists: get() on a never-set id returns
  // undefined, not NaN -- the Number.isFinite guard is what keeps the
  // compute's own result a real number despite that.
  assert.equal(g.get("combined"), 0);

  // "pane-a" mounts and defines its own duration cell with a real value --
  // the dependency edge recorded during the first read above (get() on a
  // not-yet-existing id still registers the edge) means this define() call
  // marks "combined" dirty and notifies it, without "combined" having to be
  // re-read to pick up the change.
  let notified = 0;
  g.subscribe("combined", () => notified++);
  g.define("pane-a-duration", () => 5);
  assert.equal(notified, 1);
  assert.equal(g.get("combined"), 5);
});
