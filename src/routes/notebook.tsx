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
          The biggest single item from the feature-adoption research. Every graph cell and named "value" cell below
          shares one <code>CellGraph</code>, so a graph cell's free variable can reference an earlier value cell by
          name -- add a value block named e.g. <code>k</code>, then a graph cell plotting <code>k*sin(x)</code>{" "}
          sources <code>k</code> live from that value cell instead of getting its own independent slider. v1 only
          supports referencing a named scalar this way, not another graph cell's entire curve/function. The notebook
          document itself isn't saved/persisted yet (an individual graph cell has no URL sync, fork, or gallery-save
          the way <code>/multi</code> does) -- a real next step once this document shell holds up.
        </p>
      </details>
      <p>
        <Link to="/">← back</Link>
      </p>
      <NotebookPanel />
    </div>
  );
}
