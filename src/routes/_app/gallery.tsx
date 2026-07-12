import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { encodeMultiGraphState, type MultiGraphState } from "~/lib/multi-graph-state.ts";
import { encodeNotebookState, type NotebookState } from "~/lib/notebook-state.ts";
import { deleteSavedGraph, getSavedGraph, listSavedGraphs, type SavedGraphSummary } from "~/lib/saved-graphs.ts";

export const Route = createFileRoute("/_app/gallery")({
  component: GalleryPage,
});

/**
 * Lists every graph/notebook saved from either "Save to gallery" button --
 * GraphCanvasMulti's (now surfaced at `/graphing`) or NotebookPanel's (now
 * `/notes`). One shared, mixed-content gallery (see saved-graphs.ts's own
 * doc comment for why): each entry's `kind` says which route/encoder to
 * reopen it with.
 *
 * Moved under the `_app` shell during the SPA-shell pass (same URL,
 * `/gallery` -- a pathless layout route adds no path segment); reopen hrefs
 * retargeted from the legacy `/multi`/`/notebook` to the new `/graphing`/
 * `/notes` so a saved item lands on the new section instead of a legacy
 * page it would immediately banner away from (`GraphCanvasMulti`/
 * `NotebookPanel` only ever read/write `window.location.hash`, never their
 * own pathname, so this is safe).
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
          ? `/notes#${encodeNotebookState(state as NotebookState)}`
          : `/graphing#${encodeMultiGraphState(state as MultiGraphState)}`;
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
      <div className="page-head">
        <p className="page-eyebrow">Gallery</p>
        <h1>Everything you've saved</h1>
        <p className="lede">
          Graphs and notebooks saved from the "Save to gallery" button on Graphing or Notebook. Opening one reopens
          it fully editable.
        </p>
      </div>
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
