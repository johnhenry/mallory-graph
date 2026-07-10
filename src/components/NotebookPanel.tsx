import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { CellGraph } from "../lib/cell-graph.ts";
import { cellIdsMultiRow, cellIdsNotebookBlock, notebookValueCellId } from "../lib/cell-ids.ts";
import {
  DEFAULT_NOTEBOOK_STATE,
  decodeNotebookState,
  encodeNotebookState,
  type NotebookGraphBlockStateV1,
  type NotebookState,
} from "../lib/notebook-state.ts";
import { saveGraph } from "../lib/saved-graphs.ts";
import { NotebookGraphBlock } from "./NotebookGraphBlock.tsx";

type Block =
  | { id: string; type: "text"; content: string }
  | { id: string; type: "graph"; initialSource: string }
  | { id: string; type: "value"; name: string; value: number };

/**
 * Seeds a "graph" block's rows/viewport into `graph` (mirrors
 * GraphCanvasMulti's own `seedRow` loop), so by the time NotebookGraphBlock
 * mounts and checks `graph.hasValue(blockIds.expressionList)`, it's already
 * true and NotebookGraphBlock skips its own single-default-row seeding.
 */
function seedGraphBlock(graph: CellGraph, blockId: string, block: NotebookGraphBlockStateV1): void {
  const blockIds = cellIdsNotebookBlock(blockId);
  graph.set(blockIds.viewport, block.viewport, { auxiliary: true });
  const rowIds = block.rows.map(() => crypto.randomUUID());
  rowIds.forEach((rowId, i) => {
    const row = block.rows[i] as NotebookGraphBlockStateV1["rows"][number];
    const ids = cellIdsMultiRow(rowId);
    graph.set(ids.expr, row.source);
    graph.set(ids.color, row.color);
    graph.set(ids.visible, row.visible);
    for (const [name, value] of Object.entries(row.params)) graph.set(ids.param(name), value);
  });
  graph.set(blockIds.expressionList, rowIds, { auxiliary: true });
}

/** Converts a decoded/default NotebookState into this component's own Block[] shape, seeding `graph` for graph/value blocks as a side effect. Fresh crypto.randomUUID() ids are assigned here -- block ids aren't part of the serialized shape, only content/order is. */
function hydrateBlocks(graph: CellGraph, state: NotebookState): Block[] {
  return state.blocks.map((b) => {
    const id = crypto.randomUUID();
    if (b.type === "text") return { id, type: "text", content: b.content };
    if (b.type === "value") {
      graph.set(notebookValueCellId(b.name), b.value);
      return { id, type: "value", name: b.name, value: b.value };
    }
    seedGraphBlock(graph, id, b);
    return { id, type: "graph", initialSource: b.rows[0]?.source ?? "x" };
  });
}

/** Builds the full serializable state of the notebook document -- shared by the URL-sync effect and the save-to-gallery handler. */
function getCurrentNotebookState(graph: CellGraph, blocks: Block[]): NotebookState {
  return {
    v: 1,
    blocks: blocks.map((block): NotebookState["blocks"][number] => {
      if (block.type === "text") return { type: "text", content: block.content };
      if (block.type === "value") return { type: "value", name: block.name, value: block.value };
      const blockIds = cellIdsNotebookBlock(block.id);
      const rowIds = graph.hasValue(blockIds.expressionList) ? graph.get<string[]>(blockIds.expressionList) : [];
      const rows = rowIds.map((rowId) => {
        const ids = cellIdsMultiRow(rowId);
        const freeVars = graph.hasValue(ids.freeVars) ? graph.get<string[]>(ids.freeVars) : [];
        const params: Record<string, number> = {};
        for (const name of freeVars) params[name] = graph.get<number>(ids.param(name));
        return {
          source: graph.get<string>(ids.expr),
          color: graph.get<number>(ids.color),
          visible: graph.get<boolean>(ids.visible),
          params,
        };
      });
      const viewport = graph.hasValue(blockIds.viewport)
        ? graph.get<NotebookGraphBlockStateV1["viewport"]>(blockIds.viewport)
        : { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
      return { type: "graph", rows, viewport };
    }),
  };
}

/**
 * v1 reactive notebook surface: an ordered, editable list of blocks (text,
 * graph, or a named value), built directly on CellGraph -- the biggest
 * single item from the research roadmap, scoped down deliberately.
 *
 * All graph and value blocks share ONE `CellGraph` (constructed once here,
 * passed down to each `NotebookGraphBlock`), which is what makes
 * cross-cell references possible: a value block's cell is keyed by its
 * user-given `name` (see `notebookValueCellId`), so any graph block's free
 * variable matching that name resolves to it live (see ExpressionRow's
 * `ids.params` compute) instead of getting an independent local slider.
 * Referencing another block's entire curve/function (not just a named
 * scalar) stays out of v1 scope.
 *
 * Hydrates from the URL hash (notebook-state.ts) when present, mirroring
 * GraphCanvasMulti's own useMultiGraph mechanism exactly -- including its
 * same latent SSR/hydration tradeoff: the `typeof window !== "undefined"`
 * guard means a fresh server render always sees no hash (so server and a
 * *hash-less* client load agree), but a page loaded directly with a
 * pre-existing hash will decode differently between server and client,
 * same as GraphCanvasMulti already does today. Not a new risk introduced
 * here, just the same accepted tradeoff applied consistently.
 *
 * "Fork this view" and "Save to gallery" mirror GraphCanvasMulti's
 * `forkView`/`handleSave` exactly. Block add/remove/reorder/text-edit is
 * plain React state (not something `graph.subscribeAll` observes the way
 * row add/remove already does via EXPRESSION_LIST_CELL in GraphCanvasMulti),
 * so the URL-sync effect re-runs on every `blocks` change too, not just
 * every graph mutation.
 */
export function NotebookPanel() {
  const graphRef = useRef<CellGraph | null>(null);
  if (!graphRef.current) graphRef.current = new CellGraph();
  const graph = graphRef.current;

  const [blocks, setBlocks] = useState<Block[]>(() => {
    const decoded = typeof window !== "undefined" ? decodeNotebookState(window.location.hash.slice(1)) : null;
    return hydrateBlocks(graph, decoded ?? DEFAULT_NOTEBOOK_STATE);
  });

  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const saveGraphFn = useServerFn(saveGraph);

  function forkView() {
    window.open(window.location.href, "_blank");
  }

  async function handleSave() {
    const title = window.prompt("Title for this saved notebook:", "Untitled");
    if (title === null) return;
    setSaveStatus("Saving…");
    try {
      await saveGraphFn({ data: { title, kind: "notebook", state: getCurrentNotebookState(graph, blocks) } });
      setSaveStatus(`Saved as "${title || "Untitled"}" — see the gallery to reopen it.`);
    } catch (e) {
      setSaveStatus(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Mirrors GraphCanvasMulti's own writeUrl/subscribeAll pattern, plus a
  // second trigger on `blocks` itself (see this component's doc comment for
  // why: block add/remove/reorder/text-edit is plain React state, not a
  // graph mutation `subscribeAll` would ever see).
  useEffect(() => {
    function writeUrl() {
      window.history.replaceState(null, "", `#${encodeNotebookState(getCurrentNotebookState(graph, blocks))}`);
    }
    writeUrl();
    return graph.subscribeAll(writeUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, blocks]);

  function addTextBlock() {
    setBlocks((prev) => [...prev, { id: crypto.randomUUID(), type: "text", content: "" }]);
  }

  function addGraphBlock() {
    setBlocks((prev) => [...prev, { id: crypto.randomUUID(), type: "graph", initialSource: "x" }]);
  }

  // Single-letter names only: implicit-mult.ts's tokenizer splits any
  // unrecognized multi-letter run into single-char variables multiplied
  // together (see its own doc comment), so a default name like "k1" would
  // parse as "k*1" -- two separate tokens, not one referenceable
  // identifier -- silently defeating the whole point of naming a value.
  // "x"/"y" are reserved (axis variable / dependent variable).
  const VALUE_NAME_POOL = "kmnabcdfghpqrstuvwz".split("");

  function addValueBlock() {
    const index = blocks.filter((b) => b.type === "value").length;
    const name = VALUE_NAME_POOL[index % VALUE_NAME_POOL.length] as string;
    graph.set(notebookValueCellId(name), 1);
    setBlocks((prev) => [...prev, { id: crypto.randomUUID(), type: "value", name, value: 1 }]);
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  function updateText(id: string, content: string) {
    setBlocks((prev) => prev.map((b) => (b.id === id && b.type === "text" ? { ...b, content } : b)));
  }

  // Renaming writes the value under the NEW name's cell, then removes the
  // OLD name's cell -- unless another still-active value block shares that
  // old name (a pre-existing ambiguity this component doesn't otherwise
  // prevent: two value blocks with the same name both write into the same
  // cell), in which case deleting it would silently break that other
  // block's live value out from under it, so it's left alone in that case.
  function updateValueName(id: string, name: string) {
    setBlocks((prev) => {
      const renamed = prev.find((b) => b.id === id && b.type === "value");
      if (!renamed || renamed.type !== "value") return prev;
      const oldName = renamed.name;
      const oldNameStillUsedElsewhere = prev.some((b) => b.id !== id && b.type === "value" && b.name === oldName);
      graph.set(notebookValueCellId(name), renamed.value);
      if (oldName !== name && !oldNameStillUsedElsewhere) graph.delete(notebookValueCellId(oldName));
      return prev.map((b) => (b.id === id && b.type === "value" ? { ...b, name } : b));
    });
  }

  function updateValueNumber(id: string, value: number) {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== id || b.type !== "value") return b;
        graph.set(notebookValueCellId(b.name), value);
        return { ...b, value };
      }),
    );
  }

  return (
    <div>
      {blocks.map((block) => (
        <div key={block.id} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", margin: "0.75rem 0" }}>
          <div style={{ flex: 1 }}>
            {block.type === "text" ? (
              <textarea
                value={block.content}
                onChange={(e) => updateText(block.id, e.target.value)}
                rows={3}
                style={{ width: "100%", font: "inherit", padding: "0.5rem", boxSizing: "border-box" }}
              />
            ) : block.type === "value" ? (
              <label style={{ fontSize: "0.9rem" }}>
                value{" "}
                <input
                  value={block.name}
                  onChange={(e) => updateValueName(block.id, e.target.value)}
                  style={{ font: "inherit", width: "8ch" }}
                />{" "}
                ={" "}
                <input
                  type="number"
                  value={block.value}
                  onChange={(e) => updateValueNumber(block.id, Number(e.target.value))}
                  style={{ font: "inherit", width: "10ch" }}
                />
              </label>
            ) : (
              <NotebookGraphBlock graph={graph} blockId={block.id} initialSource={block.initialSource} />
            )}
          </div>
          <button type="button" onClick={() => removeBlock(block.id)} title="Remove this block">
            ✕
          </button>
        </div>
      ))}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", margin: "0.5rem 0" }}>
        <button type="button" onClick={addTextBlock}>
          + Text block
        </button>
        <button type="button" onClick={addGraphBlock}>
          + Graph block
        </button>
        <button type="button" onClick={addValueBlock}>
          + Value block
        </button>
        <button type="button" onClick={forkView} title="Open this exact document in a new tab to explore an alternate path">
          Fork this view
        </button>
        <button type="button" onClick={handleSave}>
          Save to gallery
        </button>
      </div>
      {saveStatus && <p style={{ fontSize: "0.85rem", color: "#5b6b8c" }}>{saveStatus}</p>}
    </div>
  );
}
