import { createFileRoute } from "@tanstack/react-router";
import { NotebookPanel } from "~/components/NotebookPanel.tsx";

export const Route = createFileRoute("/_app/notes")({
  component: NotesPage,
});

function NotesPage() {
  return (
    <div>
      <div className="page-head">
        <p className="page-eyebrow">Notebook</p>
        <h1>Text and live graphs, mixed.</h1>
        <p className="lede">One reactive document.</p>
      </div>
      <NotebookPanel />
    </div>
  );
}
