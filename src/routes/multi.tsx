import { createFileRoute, Link } from "@tanstack/react-router";
import { GraphCanvasMulti } from "../components/GraphCanvasMulti.tsx";

export const Route = createFileRoute("/multi")({
  component: MultiPage,
});

function MultiPage() {
  return (
    <div>
      <h1>mallory-graph — multiple expressions, one graph</h1>
      <p>
        Several curves sharing one coordinate system and one canvas, each with its own color and visibility toggle —
        unlike the linked-panes view, which shares a <code>CellGraph</code> but still renders each pane on its own
        separate canvas. v1 supports plotting and free-variable sliders per row; point-dragging, exact mode,
        derivative steps, area/region shading, and finite-structure scatter stay single-expression-only for now (see{" "}
        <code>GraphCanvas</code>). Root crossings (where a curve meets y=0) are marked automatically, via a
        declarative "condition" cell decoupled from the drawing decision — the Open MCT-inspired pattern the roadmap
        flagged for flagging points of interest generally. The full state (every row, its color/visibility/sliders,
        and the viewport) lives in the URL, so reload restores the session, and "Fork this view" is just opening
        that same URL in a new tab to explore an alternate path independently.
      </p>
      <p>
        <Link to="/">← back</Link>
      </p>
      <GraphCanvasMulti />
    </div>
  );
}
