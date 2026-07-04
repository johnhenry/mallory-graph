import { useRef, useState } from "react";
import { CellGraph } from "../lib/cell-graph.ts";
import { notebookValueCellId } from "../lib/cell-ids.ts";
import { NotebookGraphBlock } from "./NotebookGraphBlock.tsx";

type Block =
  | { id: string; type: "text"; content: string }
  | { id: string; type: "graph"; initialSource: string }
  | { id: string; type: "value"; name: string; value: number };

// Fixed string ids (not crypto.randomUUID()) for the two seeded blocks --
// this array is built at module scope, which SSR evaluates once server-side
// and once client-side; a random id here would differ between the two,
// producing a React key/hydration mismatch. New blocks added via the
// buttons below are only ever created client-side (a user click), so
// crypto.randomUUID() there is safe.
const DEFAULT_BLOCKS: Block[] = [
  {
    id: "intro",
    type: "text",
    content:
      "A reactive notebook: mix free-form notes with live graph cells and named value cells. Every graph cell below shares one CellGraph, so a graph cell's expression can reference an earlier value cell by name -- e.g. a value block named \"k\" makes \"k\" available to any graph cell below it, sourced live instead of getting its own independent slider. Referencing another graph cell's entire curve (not just a named scalar) is a later extension.",
  },
  { id: "graph-1", type: "graph", initialSource: "sin(x)" },
];

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
 * Ephemeral within the page (no save/load for the notebook document as a
 * whole; each graph block's viewport/expression-list cells are namespaced
 * per block via `cellIdsNotebookBlock`, but not URL-persisted the way
 * GraphCanvasMulti is).
 */
export function NotebookPanel() {
  const [blocks, setBlocks] = useState<Block[]>(DEFAULT_BLOCKS);
  const graphRef = useRef<CellGraph | null>(null);
  if (!graphRef.current) graphRef.current = new CellGraph();
  const graph = graphRef.current;

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

  // Renaming writes the value under the NEW name's cell, leaving the old
  // name's cell as a harmless orphan -- same tolerance for orphaned cells
  // GraphCanvasMulti's own removeRow already has (it doesn't clean up a
  // removed row's cells either), and simpler than trying to migrate/rename
  // a cell in place.
  function updateValueName(id: string, name: string) {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== id || b.type !== "value") return b;
        graph.set(notebookValueCellId(name), b.value);
        return { ...b, name };
      }),
    );
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
      </div>
    </div>
  );
}
