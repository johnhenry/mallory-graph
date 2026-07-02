import { createFileRoute, Link } from "@tanstack/react-router";
import { GraphCanvas } from "../components/GraphCanvas.tsx";
import { DEFAULT_GRAPH_STATE } from "../lib/graph-state.ts";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div>
      <h1>mallory-graph</h1>
      <p>
        <code>y = {DEFAULT_GRAPH_STATE.cells[0].source}</code>, sampled and plotted through mallory-ts's reactive
        core (<code>Symbolic.compile</code> → <code>CellGraph</code> → <code>GraphUtils.vectorToCurve</code>).
      </p>
      <p>
        <Link to="/linked">Linked multi-pane view →</Link>
      </p>
      <p>
        <Link to="/surface-3d">3D surface view →</Link>
      </p>
      <GraphCanvas />
    </div>
  );
}
