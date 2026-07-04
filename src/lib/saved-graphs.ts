/**
 * Server-only save/gallery store for GraphCanvasMulti sessions -- a minimal
 * "publish" primitive from the research roadmap (not real-time collaboration
 * or a full community platform, just save-and-list-and-reopen). A plain
 * JSON file under `data/`, mirroring export-video.ts's "single Dokku
 * process, no real queue/DB infra needed yet" reasoning -- good enough for
 * one app instance, not a multi-instance-safe store.
 */
import { createServerFn } from "@tanstack/react-start";
import type { MultiGraphState } from "./multi-graph-state.ts";

export interface SavedGraphSummary {
  id: string;
  title: string;
  createdAt: number;
}

interface SavedGraphRecord extends SavedGraphSummary {
  state: MultiGraphState;
}

async function dataFilePath(): Promise<string> {
  const path = await import("node:path");
  return path.join(process.cwd(), "data", "saved-graphs.json");
}

async function readStore(): Promise<SavedGraphRecord[]> {
  const { promises: fs } = await import("node:fs");
  try {
    const raw = await fs.readFile(await dataFilePath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedGraphRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeStore(records: SavedGraphRecord[]): Promise<void> {
  const { promises: fs } = await import("node:fs");
  const path = await import("node:path");
  const filePath = await dataFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(records, null, 2));
}

export const saveGraph = createServerFn({ method: "POST" })
  .validator((data: { title: string; state: MultiGraphState }) => data)
  .handler(async ({ data }): Promise<{ id: string }> => {
    const records = await readStore();
    const id = crypto.randomUUID();
    records.push({ id, title: data.title.trim() || "Untitled", createdAt: Date.now(), state: data.state });
    await writeStore(records);
    return { id };
  });

export const listSavedGraphs = createServerFn({ method: "GET" }).handler(async (): Promise<SavedGraphSummary[]> => {
  const records = await readStore();
  return records
    .map(({ id, title, createdAt }) => ({ id, title, createdAt }))
    .sort((a, b) => b.createdAt - a.createdAt);
});

export const getSavedGraph = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<MultiGraphState> => {
    const records = await readStore();
    const record = records.find((r) => r.id === data.id);
    if (!record) throw new Error("Unknown or deleted saved graph.");
    return record.state;
  });

export const deleteSavedGraph = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<void> => {
    const records = await readStore();
    await writeStore(records.filter((r) => r.id !== data.id));
  });
