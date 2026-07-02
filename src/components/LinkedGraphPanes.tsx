import { useEffect, useRef } from "react";
import { CellGraph } from "../lib/cell-graph.ts";
import { cellIds } from "../lib/cell-ids.ts";
import { DEFAULT_GRAPH_STATE, decodeGraphState, encodeGraphState, type GraphState } from "../lib/graph-state.ts";
import { GraphCanvas } from "./GraphCanvas.tsx";

const PANE_IDS = ["pane-a", "pane-b"] as const;
const PANE_DEFAULT_SOURCE: Record<(typeof PANE_IDS)[number], string> = {
  "pane-a": "sin(x)",
  "pane-b": "cos(x)",
};

/**
 * Two panes sharing one CellGraph. Each pane keeps its own
 * expression/params/timeline-duration cells (namespaced by cellId, via
 * GraphCanvas's `cellIds` factory), so they can plot independent
 * expressions -- but they share the graph's single TIME_CELL, so playing or
 * scrubbing the primary pane's transport animates both curves in lockstep.
 * Only the primary pane renders a transport; both panes turn off their own
 * `syncUrl` and this component does one combined hydrate/write instead, so
 * the URL fragment round-trips every pane's source/params/structureModulus
 * rather than just the first cell's (see graph-state.ts's v3 schema).
 */
export function LinkedGraphPanes() {
  const graphRef = useRef<CellGraph | null>(null);
  if (!graphRef.current) graphRef.current = new CellGraph();
  const graph = graphRef.current;

  useEffect(() => {
    const decoded = decodeGraphState(window.location.hash.slice(1));
    if (!decoded) return;
    // Params/structure are written before the source, same reasoning as
    // GraphCanvas's own single-pane hydration: it lets each pane's lazy
    // default-slider-seeding find these cells already populated.
    for (const cellState of decoded.cells) {
      const ids = cellIds(cellState.id);
      for (const [name, value] of Object.entries(cellState.params)) graph.set(ids.param(name), value);
      graph.set(ids.structure, cellState.structureModulus);
    }
    for (const cellState of decoded.cells) {
      const ids = cellIds(cellState.id);
      graph.set(ids.expr, cellState.source);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function writeUrl() {
      const cells = PANE_IDS.map((cellId) => {
        const ids = cellIds(cellId);
        const names = graph.get<string[]>(ids.freeVars);
        const params: Record<string, number> = {};
        for (const name of names) params[name] = graph.get<number>(ids.param(name));
        return {
          id: cellId,
          source: graph.get<string>(ids.expr),
          params,
          structureModulus: graph.get<number | null>(ids.structure),
        };
      });
      const state: GraphState = { v: 3, cells, viewport: DEFAULT_GRAPH_STATE.viewport, mode: "float" };
      window.history.replaceState(null, "", `#${encodeGraphState(state)}`);
    }
    writeUrl();
    return graph.subscribeAll(writeUrl);
  }, [graph]);

  return (
    <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
      <GraphCanvas cellId="pane-a" defaultSource={PANE_DEFAULT_SOURCE["pane-a"]} graph={graph} syncUrl={false} />
      <GraphCanvas cellId="pane-b" defaultSource={PANE_DEFAULT_SOURCE["pane-b"]} graph={graph} showTransport={false} syncUrl={false} />
    </div>
  );
}
