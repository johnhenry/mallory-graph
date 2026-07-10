/**
 * CellGraph — a reactive, pull-based dependency graph. Cells hold typed
 * values (numbers, points, curves, whatever) rather than flattened
 * primitives; a derived cell's `compute` reads other cells via `graph.get`,
 * and the graph records the resulting edges automatically (no manual tag
 * declarations, unlike mcp-query's cache).
 *
 * Writes (`set`) mark transitive dependents dirty and bump their version
 * counters immediately — cheap, no recompute. Recomputation happens lazily,
 * the next time a dirty cell is `get`, and a structural-equality check skips
 * the version bump (and further propagation) when a recompute produces a
 * value that's deep-equal to what was already cached, so unaffected
 * downstream consumers don't re-render.
 */

type Listener = () => void;
type ComputeFn<T> = () => T;

interface CellRecord<T = unknown> {
  value: T | undefined;
  hasValue: boolean;
  version: number;
  dirty: boolean;
  compute?: ComputeFn<T>;
  dependencies: Set<string>;
  dependents: Set<string>;
  auxiliary: boolean;
}

export type CellRole = "free" | "dependent" | "unknown";

export class CircularDependencyError extends Error {
  constructor(path: string[]) {
    super(`Circular dependency detected in cell graph: ${path.join(" -> ")}`);
    this.name = "CircularDependencyError";
  }
}

export class CellGraph {
  private cells = new Map<string, CellRecord>();
  private listeners = new Map<string, Set<Listener>>();
  private globalListeners = new Set<Listener>();
  private stack: string[] = [];
  private emitting = new Set<string>();
  private notifyingGlobal = false;

  /**
   * Write a raw source-of-truth value (e.g. a slider drag or text input).
   * Structurally, a cell written via `set` (no `compute` fn) is what makes
   * it "free" -- see {@link role}.
   *
   * @param options.auxiliary Marks this cell hidden-by-default in an
   * Algebra-view-style listing (see {@link list}) -- e.g. an internal
   * sampling parameter that isn't itself meaningful to show the user,
   * distinct from a top-level named object. Only applied when the cell
   * doesn't already exist, or is transitioning from a compute-backed
   * (dependent) cell to a free one; an existing free cell's auxiliary flag
   * is left as originally set.
   */
  set<T>(id: string, value: T, options?: { auxiliary?: boolean }): void {
    const cell = this.ensure<T>(id);
    const wasCompute = cell.compute !== undefined;
    cell.compute = undefined;
    if (options?.auxiliary !== undefined && (wasCompute || !cell.hasValue)) cell.auxiliary = options.auxiliary;
    const unchanged = cell.hasValue && structuralEqual(cell.value, value);
    cell.dirty = false;
    if (unchanged) return;
    // Only replace the cached reference on a real change, so a write that's
    // structurally equal to the old value never disturbs downstream identity.
    cell.value = value;
    cell.hasValue = true;
    cell.version++;
    this.emit(id);
    this.propagateDirty(id);
  }

  /**
   * Define (or redefine) a derived cell computed from other cells.
   * Structurally, a cell written via `define` (has a `compute` fn) is what
   * makes it "dependent" -- see {@link role}.
   *
   * @param options.auxiliary See {@link set}'s equivalent option; applied
   * the same way (only on first definition, or a transition from free to
   * dependent).
   */
  define<T>(id: string, compute: ComputeFn<T>, options?: { auxiliary?: boolean }): void {
    const cell = this.ensure<T>(id);
    const wasFree = cell.compute === undefined && cell.hasValue;
    if (options?.auxiliary !== undefined && (wasFree || cell.compute === undefined)) cell.auxiliary = options.auxiliary;
    cell.compute = compute;
    cell.dirty = true;
    cell.version++;
    this.emit(id);
    this.propagateDirty(id);
  }

  /**
   * Whether `id` is "free" (writable directly via `set`, no `compute` fn --
   * e.g. a slider or text input), "dependent" (computed via `define` from
   * other cells), or "unknown" (`id` has never been `set`/`define`d, only
   * read, or doesn't exist at all).
   */
  role(id: string): CellRole {
    const cell = this.cells.get(id);
    if (!cell || !cell.hasValue) return "unknown";
    return cell.compute ? "dependent" : "free";
  }

  /** Whether `id` was marked `auxiliary` (hidden-by-default in an Algebra-view-style listing) -- see {@link set}/{@link define}. */
  isAuxiliary(id: string): boolean {
    return this.cells.get(id)?.auxiliary ?? false;
  }

  /**
   * Every cell currently in the graph, with its role and auxiliary flag --
   * the basis for an Algebra-view-style listing (GeoGebra's free/dependent/
   * auxiliary object model). Includes cells with no value yet (role
   * "unknown") since a caller may still want to know such an id exists
   * (e.g. was read but never written).
   */
  list(): Array<{ id: string; role: CellRole; auxiliary: boolean; hasValue: boolean }> {
    return [...this.cells.entries()].map(([id, cell]) => ({
      id,
      role: this.role(id),
      auxiliary: cell.auxiliary,
      hasValue: cell.hasValue,
    }));
  }

  /** Read a cell's current value, recomputing if stale. Auto-tracks dependency edges. */
  get<T>(id: string): T {
    const cell = this.ensure<T>(id);

    // The cell currently being computed (if any) reads `id` — record the edge.
    const caller = this.stack.at(-1);
    if (caller !== undefined) {
      this.cells.get(caller)?.dependencies.add(id);
      cell.dependents.add(caller);
    }

    if (cell.dirty && cell.compute) {
      if (this.stack.includes(id)) throw new CircularDependencyError([...this.stack, id]);

      this.recomputeAndEmit(id, cell);
    }

    return cell.value as T;
  }

  private recomputeAndEmit<T>(id: string, cell: CellRecord<T>): void {
    // Dependencies may differ between evaluations (e.g. a conditional
    // expression) — detach from the old set before recomputing fresh.
    for (const depId of cell.dependencies) this.cells.get(depId)?.dependents.delete(id);
    cell.dependencies = new Set();

    this.stack.push(id);
    let next: T;
    try {
      next = cell.compute!() as T;
    } finally {
      this.stack.pop();
    }

    cell.dirty = false;

    const unchanged = cell.hasValue && structuralEqual(cell.value, next);

    if (!unchanged) {
      // Reassign only on a real change, preserving the old reference on a
      // no-op recompute — this is what lets a downstream Object.is check
      // (e.g. React's useSyncExternalStore, or React.memo) bail out.
      cell.value = next;
      cell.hasValue = true;
      cell.version++;
      this.emit(id);
    }
  }

  /** The value useSyncExternalStore observes for this cell. */
  getVersion(id: string): number {
    return this.cells.get(id)?.version ?? 0;
  }

  /** Subscribe to changes on one cell. Returns an unsubscribe function. */
  subscribe(id: string, fn: Listener): () => void {
    let set = this.listeners.get(id);
    if (!set) this.listeners.set(id, (set = new Set()));
    set.add(fn);
    this.ensure(id);
    return () => set.delete(fn);
  }

  /** Subscribe to changes on any cell (e.g. to drive a canvas render loop). */
  subscribeAll(fn: Listener): () => void {
    this.globalListeners.add(fn);
    return () => this.globalListeners.delete(fn);
  }

  has(id: string): boolean {
    return this.cells.has(id);
  }

  /**
   * Whether `id` has a real value yet, as opposed to merely existing as an
   * empty record (`has()` returns true for a cell the instant anything reads
   * it via `get`, even before it's ever been `set` or `define`d -- not a
   * reliable "should I seed this?" check from a post-render effect that runs
   * after a sibling compute has already read-and-thus-created it).
   */
  hasValue(id: string): boolean {
    return this.cells.get(id)?.hasValue ?? false;
  }

  /**
   * Remove a cell entirely. Former *dependents* are marked dirty and
   * notified (same as a `set()` would), so a compute that read the deleted
   * cell re-runs and can fall back to whatever "this cell doesn't exist"
   * means for it -- without this, a dependent kept its stale cached value
   * forever, AND (because its dependency edges only rebuild during a
   * recompute that never came) writes to its other dependencies stopped
   * reaching it too. The notification happens *after* the cell is gone, so
   * the reentrant recompute a listener may trigger sees the post-delete
   * world: a `get()` on the deleted id re-creates an empty record
   * (`hasValue: false`), exactly the "never existed" semantics callers
   * like ExpressionRow's params compute already handle.
   */
  delete(id: string): void {
    const cell = this.cells.get(id);
    if (!cell) return;
    const formerDependents = [...cell.dependents];
    for (const depId of cell.dependencies) this.cells.get(depId)?.dependents.delete(id);
    for (const depId of cell.dependents) this.cells.get(depId)?.dependencies.delete(id);
    this.cells.delete(id);
    this.listeners.delete(id);
    for (const depId of formerDependents) {
      const dep = this.cells.get(depId);
      if (!dep || dep.dirty) continue;
      dep.dirty = true;
      this.emit(depId);
      this.propagateDirty(depId);
    }
  }

  private ensure<T>(id: string): CellRecord<T> {
    let cell = this.cells.get(id) as CellRecord<T> | undefined;
    if (!cell) {
      cell = {
        value: undefined,
        hasValue: false,
        version: 0,
        dirty: true,
        dependencies: new Set(),
        dependents: new Set(),
        auxiliary: false,
      };
      this.cells.set(id, cell);
    }
    return cell;
  }

  private propagateDirty(id: string): void {
    const cell = this.cells.get(id);
    if (!cell) return;
    // Snapshot before iterating: `emit` below can synchronously trigger a
    // nested recompute (via useSyncExternalStore's listener) that detaches
    // and re-adds an entry to this very `dependents` set. Iterating the live
    // Set would then revisit that re-added entry within the same pass,
    // looping forever between cells that share this dependency.
    for (const depId of [...cell.dependents]) {
      const dep = this.cells.get(depId);
      if (!dep || dep.dirty) continue; // already dirty -> already propagated past this point
      dep.dirty = true;
      // Notify listeners so a subscriber (e.g. useSyncExternalStore) re-reads
      // via get(), which lazily recomputes. No version bump here — that only
      // happens in get()/set() once a recompute confirms a real value change,
      // which is what lets an unaffected downstream branch skip its redraw.
      this.emit(depId);
      this.propagateDirty(depId);
    }
  }

  /**
   * Notify `id`'s listeners that it may have changed. Guarded against
   * reentrancy per-id: a `useSyncExternalStore` listener synchronously
   * calls `getSnapshot` (React's own tearing check) as soon as it's
   * notified, which re-enters `get()` and, on a real recompute, calls back
   * into `emit(id)` for the very same id before this call has returned.
   * Without the guard that nested call re-invokes every listener again
   * (including the one currently on the stack), which re-triggers the same
   * reentrant read, forever -- an unbounded synchronous storm that pins the
   * CPU and eventually OOMs the JS heap. It's always safe to drop the
   * nested notification: any consumer notified mid-flight still reads the
   * freshest value the next time it calls `get()`, so no update is lost by
   * collapsing repeat notifications for the same id into one.
   */
  private emit(id: string): void {
    if (this.emitting.has(id)) return;
    this.emitting.add(id);
    try {
      for (const fn of this.listeners.get(id) ?? []) fn();
      if (!this.notifyingGlobal) {
        this.notifyingGlobal = true;
        try {
          for (const fn of this.globalListeners) fn();
        } finally {
          this.notifyingGlobal = false;
        }
      }
    } finally {
      this.emitting.delete(id);
    }
  }
}

/** Deep structural equality, used to skip redraws when a recompute is a no-op. */
export function structuralEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => structuralEqual(v, b[i]));
  }
  const aKeys = Object.keys(a as object);
  const bKeys = Object.keys(b as object);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(
    (k) =>
      Object.prototype.hasOwnProperty.call(b, k) &&
      structuralEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}
