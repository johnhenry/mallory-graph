import assert from "node:assert/strict";
import { test } from "node:test";
import { cellIdsNotebookBlock, notebookValueCellId } from "./cell-ids.ts";

test("cellIdsNotebookBlock namespaces viewport/expressionList by block id, distinct across blocks", () => {
  const a = cellIdsNotebookBlock("block-a");
  const b = cellIdsNotebookBlock("block-b");
  assert.notEqual(a.viewport, b.viewport);
  assert.notEqual(a.expressionList, b.expressionList);
  assert.notEqual(a.viewport, a.expressionList);
});

test("notebookValueCellId is keyed by name, not by any block id -- same name always resolves to the same cell", () => {
  assert.equal(notebookValueCellId("k"), notebookValueCellId("k"));
  assert.notEqual(notebookValueCellId("k"), notebookValueCellId("m"));
});
