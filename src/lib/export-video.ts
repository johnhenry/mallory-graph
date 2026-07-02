/**
 * Server-only manim-js video/GIF export: translates the graph's expression
 * plus its current parameter timeline into a scripted manim-js Scene
 * (Axes.plot + alwaysRedraw), then renders it to a video/GIF buffer.
 *
 * Deliberately does NOT use ValueTracker + Scene.play() to drive per-segment
 * timing: Scene.play()'s trailing-config `runTime` override relies on a
 * `_playConfig` marker that nothing in this manim-js version ever sets, so a
 * custom per-segment duration can't be threaded through play() as written
 * upstream. Instead, a single time accumulator (advanced via a plain
 * `addUpdater` on the already-scene-safe Axes mobject) plus a lone
 * `scene.wait(duration)` drives the whole clip; `alwaysRedraw` re-samples the
 * curve every frame straight from `interpolateKeyframes`, sidestepping the
 * play()/runTime question entirely.
 *
 * Phase 11b: rendering runs as a background job rather than inside the SSR
 * request -- a long/high-res export would otherwise hold a request open for
 * the render's full wall-clock duration (ffmpeg + per-frame canvas draws),
 * risking proxy/gateway timeouts. The job store is a plain in-memory Map:
 * this app runs as a single Dokku process, so there's no multi-instance
 * fan-out to coordinate and no need for real queue infra (Redis/BullMQ) yet.
 * Jobs are swept on a timer so a browser that never polls again doesn't leak
 * the rendered buffer forever.
 */
import { createServerFn } from "@tanstack/react-start";
import { Symbolic } from "mallory-ts";
import { Axes, alwaysRedraw, render } from "manim-js/node";
import { preprocessImplicitMultiplication } from "./implicit-mult.ts";
import { interpolateKeyframes, type Keyframe } from "./timeline.ts";

export interface ExportVideoInput {
  source: string;
  /** Current value of every free variable (used as-is for the ones with no track). */
  params: Record<string, number>;
  /** Keyframe track per free variable; absent/undefined means "held at params[name]". */
  tracks: Record<string, Keyframe[] | undefined>;
  viewport: { xMin: number; xMax: number; yMin: number; yMax: number };
  duration: number;
  format: "mp4" | "gif";
}

export interface ExportVideoResult {
  data: string;
  mimeType: string;
}

type ExportJob =
  | { status: "pending" }
  | { status: "done"; result: ExportVideoResult }
  | { status: "error"; message: string };

const JOB_TTL_MS = 5 * 60 * 1000;
const jobs = new Map<string, ExportJob>();
const jobCreatedAt = new Map<string, number>();

function sweepExpiredJobs() {
  const now = Date.now();
  for (const [id, createdAt] of jobCreatedAt) {
    if (now - createdAt > JOB_TTL_MS) {
      jobs.delete(id);
      jobCreatedAt.delete(id);
    }
  }
}

async function runExportJob(jobId: string, data: ExportVideoInput) {
  const { source, params, tracks, viewport, duration, format } = data;
  try {
    const compiled = Symbolic.compile(preprocessImplicitMultiplication(source));

    async function construct(scene: any) {
      const axes = new Axes({
        xRange: [viewport.xMin, viewport.xMax, (viewport.xMax - viewport.xMin) / 10],
        yRange: [viewport.yMin, viewport.yMax, (viewport.yMax - viewport.yMin) / 10],
      });
      let elapsed = 0;
      axes.addUpdater((_mob: unknown, dt: number) => {
        elapsed += dt;
      });

      const curve = alwaysRedraw(() =>
        axes.plot(
          (x: number) => {
            const env: Record<string, number> = { ...params, x };
            for (const [name, track] of Object.entries(tracks)) {
              if (track) env[name] = interpolateKeyframes(track, elapsed);
            }
            return compiled(env);
          },
          { xRange: [viewport.xMin, viewport.xMax], color: "#3b82f6" },
        ),
      );

      scene.add(axes, curve);
      await scene.wait(duration);
    }

    const { promises: fs } = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mallory-graph-export-"));
    const outPath = path.join(dir, `export.${format}`);

    try {
      await render(construct, {
        output: outPath,
        format,
        fps: 24,
        pixelWidth: 640,
        pixelHeight: 640,
        background: "#ffffff",
        verbose: false,
      });
      const buffer = await fs.readFile(outPath);
      jobs.set(jobId, {
        status: "done",
        result: { data: buffer.toString("base64"), mimeType: format === "gif" ? "image/gif" : "video/mp4" },
      });
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  } catch (e) {
    jobs.set(jobId, { status: "error", message: e instanceof Error ? e.message : String(e) });
  }
}

export const startExportVideoJob = createServerFn({ method: "POST" })
  .validator((data: ExportVideoInput) => data)
  .handler(async ({ data }) => {
    if (data.duration <= 0) {
      throw new Error("Nothing to export: no parameter has a keyframe track.");
    }
    sweepExpiredJobs();
    const jobId = crypto.randomUUID();
    jobs.set(jobId, { status: "pending" });
    jobCreatedAt.set(jobId, Date.now());
    // Deliberately not awaited: the render runs in the background while this
    // server fn returns immediately with a job id to poll.
    void runExportJob(jobId, data);
    return { jobId };
  });

export const getExportVideoJob = createServerFn({ method: "GET" })
  .validator((data: { jobId: string }) => data)
  .handler(async ({ data }) => {
    const job = jobs.get(data.jobId);
    if (!job) throw new Error("Unknown or expired export job.");
    return job;
  });
