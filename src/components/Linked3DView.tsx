import { useRef, useState } from "react";
import { CellGraph } from "../lib/cell-graph.ts";
import { cellIds, cellIds3D } from "../lib/cell-ids.ts";
import { Graph3DCanvas } from "./Graph3DCanvas.tsx";
import { GraphCanvas } from "./GraphCanvas.tsx";

const CROSS_SECTION_RANGE = { min: -5, max: 5, step: 0.1 };

// Deliberately not namespaced by cellId, same reasoning as LinkedGraphPanes's
// own combinedDuration cell: one shared graph per linked view, and the 2D
// pane's transport (the only transport in this view) should scrub across the
// longer of the two panes' animations, not cut off at the 2D pane's own.
const COMBINED_DURATION_CELL = "combined3DDuration";

/**
 * A 2D pane and a 3D surface pane sharing one CellGraph -- the same
 * reactive core (CellGraph + cell-id namespacing) that drives every 2D pane
 * in this app also drives the 3D one; only the sampling (sample-function.ts
 * vs sample-surface.ts) and rendering (Canvas2D vs Three.js) differ per
 * dimensionality. Sharing a graph here (rather than each pane owning a
 * private one) is what let the cross-pane link below (the 3D surface's
 * y=crossSectionY cross-section, highlighted in red) reuse the exact
 * default expressions -- sin(x) and sin(x)*cos(y) -- where the highlighted
 * slice at y=0 exactly traces the 2D pane's own curve, cos(0) being 1.
 * `crossSectionY` is plain component state (not a graph cell) since nothing
 * else needs to derive from it; it's passed straight to `Graph3DCanvas`,
 * which resamples the highlight itself whenever it or the 3D expression
 * changes.
 */
export function Linked3DView() {
  const graphRef = useRef<CellGraph | null>(null);
  if (!graphRef.current) {
    const graph = new CellGraph();
    const ids2D = cellIds("pane-2d");
    const ids3D = cellIds3D("pane-3d");
    graph.define(COMBINED_DURATION_CELL, () =>
      Math.max(graph.get<number>(ids2D.timelineDuration), graph.get<number>(ids3D.timelineDuration)),
    );
    graphRef.current = graph;
  }
  const graph = graphRef.current;
  const [crossSectionY, setCrossSectionY] = useState(0);

  return (
    <div>
      <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
        {/* `minWidth: 0` overrides flexbox's default min-width:auto, which
            would otherwise floor each pane at its (fixed-pixel canvas)
            content size and defeat the canvas's own responsive shrinking. */}
        <div style={{ minWidth: 0 }}>
          <GraphCanvas cellId="pane-2d" defaultSource="sin(x)" durationCellId={COMBINED_DURATION_CELL} graph={graph} />
        </div>
        <div style={{ minWidth: 0 }}>
          <Graph3DCanvas cellId="pane-3d" defaultSource="sin(x)*cos(y)" graph={graph} crossSectionY={crossSectionY} />
        </div>
      </div>
      <label style={{ display: "block", margin: "0.5rem 0", fontSize: "0.9rem" }}>
        Cross-section y = {crossSectionY.toFixed(2)} (highlighted in red on the 3D surface)
        <input
          type="range"
          min={CROSS_SECTION_RANGE.min}
          max={CROSS_SECTION_RANGE.max}
          step={CROSS_SECTION_RANGE.step}
          value={crossSectionY}
          onChange={(e) => setCrossSectionY(Number(e.target.value))}
          style={{ display: "block", width: "100%", maxWidth: "20rem" }}
        />
      </label>
    </div>
  );
}
