import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { encodeMultiGraphState, type MultiGraphState } from "../lib/multi-graph-state.ts";
import { encodeNotebookState, type NotebookState } from "../lib/notebook-state.ts";
import { deleteSavedGraph, getSavedGraph, listSavedGraphs, type SavedGraphSummary } from "../lib/saved-graphs.ts";

export const Route = createFileRoute("/gallery")({
  component: GalleryPage,
});

/**
 * Lists every graph/notebook saved from either "Save to gallery" button --
 * GraphCanvasMulti's (`/multi`) or NotebookPanel's (`/notebook`). One
 * shared, mixed-content gallery (see saved-graphs.ts's own doc comment for
 * why, rather than a second parallel gallery): each entry's `kind` says
 * which route/encoder to reopen it with. Opening one just navigates to
 * that route with the saved state encoded into the hash -- reusing the
 * exact hydrate-from-hash mechanism each route's own URL-sync feature
 * already provides, so no separate "load by id" hydration path was needed.
 * Editing a reopened graph/notebook and hitting "Fork this view"/re-saving
 * is the "remix" half of the research roadmap's publish/remix item.
 */
function GalleryPage() {
  const listSavedGraphsFn = useServerFn(listSavedGraphs);
  const getSavedGraphFn = useServerFn(getSavedGraph);
  const deleteSavedGraphFn = useServerFn(deleteSavedGraph);
  const [entries, setEntries] = useState<SavedGraphSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSavedGraphsFn()
      .then(setEntries)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [listSavedGraphsFn]);

  async function open(entry: SavedGraphSummary) {
    try {
      const state = await getSavedGraphFn({ data: { id: entry.id } });
      // A full navigation (not client-side routing) so the destination
      // route's mount-time hash read always runs fresh, rather than
      // depending on a hash-only change re-triggering it.
      const href =
        entry.kind === "notebook"
          ? `/notebook#${encodeNotebookState(state as NotebookState)}`
          : `/multi#${encodeMultiGraphState(state as MultiGraphState)}`;
      window.location.href = href;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function remove(id: string) {
    await deleteSavedGraphFn({ data: { id } });
    setEntries((prev) => prev?.filter((e) => e.id !== id) ?? null);
  }

  return (
    <div>
      <h1>mallory-graph — gallery</h1>
      <details>
        <summary>
          Graphs and notebooks saved from the "Save to gallery" button on the multiple-expressions and notebook
          views.
        </summary>
        <p>
          Saved from either <Link to="/multi">multiple-expressions view</Link> or the{" "}
          <Link to="/notebook">notebook</Link>. Opening one reopens it fully editable; fork or re-save to remix it.
          v1 is a single shared, unauthenticated gallery — no per-user accounts or private graphs.
        </p>
      </details>
      <p>
        <Link to="/">← back</Link>
      </p>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {entries === null && !error && <p>Loading…</p>}
      {entries?.length === 0 && <p>Nothing saved yet.</p>}
      {entries && entries.length > 0 && (
        <ul>
          {entries.map((entry) => (
            <li key={entry.id} style={{ margin: "0.25rem 0" }}>
              <button type="button" onClick={() => open(entry)} style={{ font: "inherit" }}>
                {entry.title}
              </button>{" "}
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "#5b6b8c",
                  border: "1px solid #d7dfef",
                  borderRadius: "3px",
                  padding: "0 0.35rem",
                }}
              >
                {entry.kind}
              </span>{" "}
              <span style={{ color: "#5b6b8c", fontSize: "0.85rem" }}>{new Date(entry.createdAt).toLocaleString()}</span>{" "}
              <button type="button" onClick={() => remove(entry.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
