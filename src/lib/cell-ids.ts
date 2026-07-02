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
    param: (name: string) => `param:${cellId}:${name}`,
    track: (name: string) => `track:${cellId}:${name}`,
  };
}

export type CellIds = ReturnType<typeof cellIds>;
