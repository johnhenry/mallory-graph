/**
 * Per-pane cell-id namespacing for GraphCanvas, factored out so both the
 * component (src/components/GraphCanvas.tsx) and the chat-command layer
 * (chat-commands.ts) can address the same cells without collisions when
 * multiple panes share one CellGraph (see LinkedGraphPanes.tsx).
 */

// Deliberately NOT namespaced by cellId: linked panes share one CellGraph,
// and scrubbing/playing one pane's timeline should drive every pane's curve
// off the same clock.
export const TIME_CELL = "time";

export function cellIds(cellId: string) {
  return {
    expr: `expr:${cellId}`,
    freeVars: `freeVars:${cellId}`,
    params: `params:${cellId}`,
    path: `path:${cellId}`,
    pointX: `pointX:${cellId}`,
    point: `point:${cellId}`,
    exact: `exact:${cellId}`,
    structure: `structure:${cellId}`,
    scatter: `scatter:${cellId}`,
    derivative: `derivative:${cellId}`,
    timelineDuration: `timelineDuration:${cellId}`,
    regionMask: `regionMask:${cellId}`,
    areaLower: `areaLower:${cellId}`,
    areaUpper: `areaUpper:${cellId}`,
    area: `area:${cellId}`,
    param: (name: string) => `param:${cellId}:${name}`,
    track: (name: string) => `track:${cellId}:${name}`,
  };
}

export type CellIds = ReturnType<typeof cellIds>;

/**
 * Cell-id namespacing for a 3D surface pane (Graph3DCanvas.tsx) -- a
 * deliberately smaller set than `cellIds`: no `point`/`exact`/`scatter`/
 * `derivative`/`structure`, since dragging a curve point, exact-mode
 * readouts, finite-structure scatter, and the derivative accordion are all
 * single-axis-variable 2D concepts that don't have a 3D analog here yet.
 */
export function cellIds3D(cellId: string) {
  return {
    expr: `expr3d:${cellId}`,
    freeVars: `freeVars3d:${cellId}`,
    params: `params3d:${cellId}`,
    mesh: `mesh3d:${cellId}`,
    timelineDuration: `timelineDuration3d:${cellId}`,
    param: (name: string) => `param3d:${cellId}:${name}`,
    track: (name: string) => `track3d:${cellId}:${name}`,
  };
}

export type CellIds3D = ReturnType<typeof cellIds3D>;

/**
 * Cell-id namespacing for a system-of-equations solver panel
 * (SystemSolverPanel.tsx) -- a different input shape entirely from
 * `cellIds`'s single expression + axis variable (N equation strings + N
 * variable names), so it gets its own small, purpose-specific set rather
 * than reusing/extending `cellIds`.
 */
export function cellIdsSystem(cellId: string) {
  return {
    equations: `sysEquations:${cellId}`,
    variables: `sysVariables:${cellId}`,
    solution: `sysSolution:${cellId}`,
  };
}

export type CellIdsSystem = ReturnType<typeof cellIdsSystem>;
