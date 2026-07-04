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
        <code>GraphCanvas</code>). URL-state persistence (reload-and-restore, share-by-link) isn't wired up for this
        view yet either — that's the next extension once this core capability is stable.
      </p>
      <p>
        <Link to="/">← back</Link>
      </p>
      <GraphCanvasMulti />
    </div>
  );
}
