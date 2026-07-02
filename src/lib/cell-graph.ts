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
}

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

  /** Write a raw source-of-truth value (e.g. a slider drag or text input). */
  set<T>(id: string, value: T): void {
    const cell = this.ensure<T>(id);
    cell.compute = undefined;
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

  /** Define (or redefine) a derived cell computed from other cells. */
  define<T>(id: string, compute: ComputeFn<T>): void {
    const cell = this.ensure<T>(id);
    cell.compute = compute;
    cell.dirty = true;
    cell.version++;
    this.emit(id);
    this.propagateDirty(id);
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

      // Dependencies may differ between evaluations (e.g. a conditional
      // expression) — detach from the old set before recomputing fresh.
      for (const depId of cell.dependencies) this.cells.get(depId)?.dependents.delete(id);
      cell.dependencies = new Set();

      this.stack.push(id);
      let next: T;
      try {
        next = cell.compute() as T;
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

    return cell.value as T;
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

  delete(id: string): void {
    const cell = this.cells.get(id);
    if (!cell) return;
    for (const depId of cell.dependencies) this.cells.get(depId)?.dependents.delete(id);
    for (const depId of cell.dependents) this.cells.get(depId)?.dependencies.delete(id);
    this.cells.delete(id);
    this.listeners.delete(id);
  }

  private ensure<T>(id: string): CellRecord<T> {
    let cell = this.cells.get(id) as CellRecord<T> | undefined;
    if (!cell) {
      cell = { value: undefined, hasValue: false, version: 0, dirty: true, dependencies: new Set(), dependents: new Set() };
      this.cells.set(id, cell);
    }
    return cell;
  }

  private propagateDirty(id: string): void {
    const cell = this.cells.get(id);
    if (!cell) return;
    for (const depId of cell.dependents) {
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

  private emit(id: string): void {
    for (const fn of this.listeners.get(id) ?? []) fn();
    for (const fn of this.globalListeners) fn();
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
