import { useState } from "react";
import { NotebookGraphBlock } from "./NotebookGraphBlock.tsx";

type Block = { id: string; type: "text"; content: string } | { id: string; type: "graph"; initialSource: string };

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
      "A reactive notebook: mix free-form notes with live graph cells. Each graph cell below is its own independent reactive expression list (see NotebookGraphBlock) -- there's no cross-cell reference yet (a later cell reading an earlier cell's value), which is the actual defining feature of an Observable-style notebook; that's the natural next extension once this document shell is in place.",
  },
  { id: "graph-1", type: "graph", initialSource: "sin(x)" },
];

/**
 * v1 reactive notebook surface: an ordered, editable list of blocks (plain
 * text or a graph cell), built directly on CellGraph -- the biggest single
 * item from the research roadmap, scoped down deliberately. Ephemeral
 * within the page (no save/load for the notebook document as a whole; each
 * graph block already has its own independent reactive core, just not
 * wired to any shared/URL-persisted state the way GraphCanvasMulti is).
 */
export function NotebookPanel() {
  const [blocks, setBlocks] = useState<Block[]>(DEFAULT_BLOCKS);

  function addTextBlock() {
    setBlocks((prev) => [...prev, { id: crypto.randomUUID(), type: "text", content: "" }]);
  }

  function addGraphBlock() {
    setBlocks((prev) => [...prev, { id: crypto.randomUUID(), type: "graph", initialSource: "x" }]);
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  function updateText(id: string, content: string) {
    setBlocks((prev) => prev.map((b) => (b.id === id && b.type === "text" ? { ...b, content } : b)));
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
            ) : (
              <NotebookGraphBlock initialSource={block.initialSource} />
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
      </div>
    </div>
  );
}
