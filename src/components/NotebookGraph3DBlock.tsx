import { useEffect, useRef } from "react";
import type { CellGraph } from "../lib/cell-graph.ts";
import { cellIds3D } from "../lib/cell-ids.ts";
import { Graph3DCanvas } from "./Graph3DCanvas.tsx";

/**
 * A 3D-surface notebook block -- a thin wrapper, not a NotebookGraphBlock-
 * style rewrite: Graph3DCanvas already accepts an external shared `graph` +
 * `cellId` (proven in production by Linked3DView), so this block is just
 * that component plus one seeding effect. The effect runs *after* mount
 * (not a pre-seed before Graph3DCanvas renders) because Graph3DCanvas's own
 * lazy graph construction only sets up its `graph.define`d mesh/freeVars/
 * params cells the first time `ids.expr` is unset -- pre-seeding it would
 * skip that setup entirely (the same reasoning Linked3DView's own hydrate
 * effect documents). Cell-id namespacing (`cellId={blockId}`) and WebMCP
 * tool namespacing (`surface3d_${blockId}_*`, via Graph3DCanvas's own
 * `useCellGraphTools` call) both fall out of reusing the real component
 * directly -- full agent parity for free, no extra plumbing needed here.
 */
export function NotebookGraph3DBlock({
  graph,
  blockId,
  initialExpr,
  initialParams,
}: {
  graph: CellGraph;
  blockId: string;
  initialExpr: string;
  initialParams: Record<string, number>;
}) {
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    const ids = cellIds3D(blockId);
    graph.set(ids.expr, initialExpr);
    for (const [name, value] of Object.entries(initialParams)) graph.set(ids.param(name), value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Graph3DCanvas cellId={blockId} graph={graph} showTransport={false} />;
}
