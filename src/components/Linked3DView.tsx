import { useRef } from "react";
import { CellGraph } from "../lib/cell-graph.ts";
import { Graph3DCanvas } from "./Graph3DCanvas.tsx";
import { GraphCanvas } from "./GraphCanvas.tsx";

/**
 * A 2D pane and a 3D surface pane sharing one CellGraph -- the same
 * reactive core (CellGraph + cell-id namespacing) that drives every 2D pane
 * in this app also drives the 3D one; only the sampling (sample-function.ts
 * vs sample-surface.ts) and rendering (Canvas2D vs Three.js) differ per
 * dimensionality. Sharing a graph here (rather than each pane owning a
 * private one) keeps the door open for a future cross-pane link (e.g. the
 * 3D surface's cross-section at a fixed y matching the 2D curve) without
 * requiring a different wiring pattern than LinkedGraphPanes.tsx already
 * established for two 2D panes.
 */
export function Linked3DView() {
  const graphRef = useRef<CellGraph | null>(null);
  if (!graphRef.current) graphRef.current = new CellGraph();
  const graph = graphRef.current;

  return (
    <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
      {/* `minWidth: 0` overrides flexbox's default min-width:auto, which
          would otherwise floor each pane at its (fixed-pixel canvas)
          content size and defeat the canvas's own responsive shrinking. */}
      <div style={{ minWidth: 0 }}>
        <GraphCanvas cellId="pane-2d" defaultSource="sin(x)" graph={graph} />
      </div>
      <div style={{ minWidth: 0 }}>
        <Graph3DCanvas cellId="pane-3d" defaultSource="sin(x)*cos(y)" graph={graph} />
      </div>
    </div>
  );
}
