/**
 * Shared server-only rendering helpers for the export paths (2D expression,
 * 3D surface, ODE) -- the temp-dir render-to-buffer dance and the common
 * palette, extracted when the 3D/ODE paths were added
 * (johnhenry/mallory-graph#3, pass 2). Server-only: imported exclusively by
 * server-fn modules, never by client components directly.
 */
import { render } from "ecmanim/node";
import type { ExportVideoResult } from "./export-jobs.ts";

export const AXIS_COLOR = "#334155";
export const LABEL_COLOR = "#111827";
export const CURVE_COLOR = "#3b82f6";
/** Half-height of ecmanim's frame in scene units; the render is square, so the visible half-WIDTH is also this. */
export const SQUARE_HALF_SPAN = 4;

/**
 * Render a construct (bare function or Scene subclass) to a video buffer via
 * a per-job temp dir, cleaned up on every path. `camera` matters for 3D:
 * ecmanim's render() builds its CanvasRenderer around options.camera BEFORE
 * makeScene runs, so a ThreeDScene's self-installed ThreeDCamera is never
 * the one the renderer projects through -- the ready-made ThreeDCamera has
 * to come in through here (with its own background set: the renderer only
 * fills in options.background when the camera has none, and ThreeDCamera's
 * own default is a truthy black).
 */
export async function renderExportToBuffer(
  sceneOrConstruct: unknown,
  format: "mp4" | "gif",
  camera?: unknown,
): Promise<ExportVideoResult> {
  const { promises: fs } = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mallory-graph-export-"));
  const outPath = path.join(dir, `export.${format}`);
  try {
    await render(sceneOrConstruct, {
      output: outPath,
      format,
      fps: 24,
      pixelWidth: 640,
      pixelHeight: 640,
      background: "#ffffff",
      verbose: false,
      ...(camera ? { camera } : {}),
    });
    const buffer = await fs.readFile(outPath);
    return { data: buffer.toString("base64"), mimeType: format === "gif" ? "image/gif" : "video/mp4" };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
