import { createFileRoute, Link } from "@tanstack/react-router";
import { NotebookPanel } from "../components/NotebookPanel.tsx";

export const Route = createFileRoute("/notebook")({
  component: NotebookPage,
});

function NotebookPage() {
  return (
    <div>
      <h1>mallory-graph — notebook</h1>
      <details>
        <summary>A reactive document mixing free-form text with live graph cells, built on CellGraph.</summary>
        <p>
          The biggest single item from the feature-adoption research, deliberately scoped down for v1: each graph
          cell is fully independent (no cross-cell reference, e.g. a later cell reading an earlier cell's computed
          value, which is Observable's defining feature), and the notebook document itself isn't saved/persisted yet
          (an individual graph cell has no URL sync, fork, or gallery-save the way <code>/multi</code> does). A real
          next step once this document shell holds up.
        </p>
      </details>
      <p>
        <Link to="/">← back</Link>
      </p>
      <NotebookPanel />
    </div>
  );
}
