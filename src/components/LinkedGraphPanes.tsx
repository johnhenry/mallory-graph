import { useRef } from "react";
import { CellGraph } from "../lib/cell-graph.ts";
import { GraphCanvas } from "./GraphCanvas.tsx";

/**
 * Two panes sharing one CellGraph. Each pane keeps its own
 * expression/params/timeline-duration cells (namespaced by cellId, via
 * GraphCanvas's `cellIds` factory), so they can plot independent
 * expressions -- but they share the graph's single TIME_CELL, so playing or
 * scrubbing the primary pane's transport animates both curves in lockstep.
 * Only the primary pane renders a transport and syncs the URL; the URL
 * schema is single-cell and multi-pane persistence is out of scope here.
 */
export function LinkedGraphPanes() {
  const graphRef = useRef<CellGraph | null>(null);
  if (!graphRef.current) graphRef.current = new CellGraph();
  const graph = graphRef.current;

  return (
    <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
      <GraphCanvas cellId="pane-a" defaultSource="sin(x)" graph={graph} syncUrl={false} />
      <GraphCanvas cellId="pane-b" defaultSource="cos(x)" graph={graph} showTransport={false} syncUrl={false} />
    </div>
  );
}
