/**
 * Server-only ecmanim video/GIF export: translates the graph's expression
 * plus its current parameter timeline into a scripted ecmanim Scene
 * (Axes.plot + alwaysRedraw), then renders it to a video/GIF buffer.
 *
 * Drives elapsed time via a real ValueTracker animated through
 * `scene.play(tracker.animate..., {runTime})` -- ecmanim (as of 0.0.11)
 * fixed the bug where a bare `{runTime}` config, without an undocumented
 * internal `_playConfig` marker, silently fell through and crashed
 * (GitHub issue #19), which is exactly what this render loop needs; the
 * 0.2.0 upgrade kept that behavior (verified against a standalone probe
 * render before anything new was built on it).
 * `.animate`'s builder getter takes no config, and its default rate
 * function is an eased `smooth` curve, not linear -- that would make
 * parameters animate non-uniformly in time (speeding up mid-clip, slowing at
 * the edges) versus the straight linear elapsed-time progression this
 * export has always used, so the Transform is constructed directly with
 * `rate_functions.linear` instead of going through `.animate`.
 * `alwaysRedraw` still re-samples the curve every frame straight from
 * `interpolateKeyframes`, reading the tracker's current (per-frame
 * interpolated) value instead of a manually-accumulated `elapsed` variable.
 *
 * ecmanim 0.2.0 additions used here (johnhenry/mallory-graph#3):
 * - `MathTex` typesets the expression's LaTeX (client-supplied, see
 *   `ExportVideoInput.latex`) as an equation label. Static for the whole
 *   clip -- a per-frame-updating label for animated parameters is a
 *   possible future nicety, not built here. MathTex renders via
 *   MathJax->SVG->Beziers, no LaTeX binary; `initMathTex()` is awaited once
 *   per process and construction failure just skips the label rather than
 *   failing the export.
 * - `Flash` plays a brief highlight at each root crossing (computed
 *   server-side from the curve's initial-state sample -- the single-pane
 *   client doesn't have a roots cell to pass, unlike /multi) as a short
 *   prelude before the parameter animation. Roots are of the t=0 curve;
 *   an animated parameter can move them, which the static prelude
 *   deliberately doesn't chase.
 * - `renderStill(construct, {time})` powers the scrub preview: one PNG
 *   frame at an arbitrary time, request/response (no job queue -- a single
 *   frame is fast), so the export UI can show what the clip looks like at
 *   any timestamp before committing to a full render.
 *
 * The default Axes/MathTex colors are manim's white-on-dark convention --
 * invisible against this export's white background -- so both get explicit
 * dark colors.
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
import { Symbolic } from "mallory-math";
import {
  Axes,
  alwaysRedraw,
  Flash,
  initMathTex,
  MathTex,
  rate_functions,
  render,
  renderStill,
  Transform,
  ValueTracker,
} from "ecmanim/node";
import { preprocessImplicitMultiplication } from "./implicit-mult.ts";
import { findRootCrossings, sampleExpr } from "./sample-function.ts";
import { HIGHLIGHT_PRELUDE_SECONDS, interpolateKeyframes, type Keyframe } from "./timeline.ts";

const AXIS_COLOR = "#334155";
const LABEL_COLOR = "#111827";
const CURVE_COLOR = "#3b82f6";
/** Half-height of ecmanim's frame in scene units; the render is square, so the visible half-WIDTH is also this. */
const SQUARE_HALF_SPAN = 4;

export interface ExportVideoInput {
  source: string;
  /** Current value of every free variable (used as-is for the ones with no track). */
  params: Record<string, number>;
  /** Keyframe track per free variable; absent/undefined means "held at params[name]". */
  tracks: Record<string, Keyframe[] | undefined>;
  viewport: { xMin: number; xMax: number; yMin: number; yMax: number };
  duration: number;
  format: "mp4" | "gif";
  /** Typeset equation label (LaTeX source, client-generated via exprToLatex). Absent/invalid just omits the label. */
  latex?: string;
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

let mathTexReady: Promise<unknown> | null = null;

/**
 * Root crossings of the curve in its initial (t=0) state -- the points the
 * Flash prelude highlights. Computed server-side from a fresh sample: the
 * single-pane GraphCanvas that drives this export has no roots cell of its
 * own to pass along (that's a /multi feature), and re-deriving here keeps
 * the export self-contained. Sampling failure (mid-typing garbage) just
 * means no highlights.
 */
function initialRootCrossings(data: ExportVideoInput): { x: number; y: number }[] {
  try {
    const env: Record<string, number> = { ...data.params };
    for (const [name, track] of Object.entries(data.tracks)) {
      if (track) env[name] = interpolateKeyframes(track, 0);
    }
    const path = sampleExpr(
      data.source,
      { min: data.viewport.xMin, max: data.viewport.xMax },
      400,
      "x",
      env,
      undefined,
      { min: data.viewport.yMin, max: data.viewport.yMax },
    );
    return findRootCrossings(path);
  } catch {
    return [];
  }
}

/**
 * The shared scene script for both the full render and the single-frame
 * preview -- one construct so the preview can't drift out of sync with what
 * the real export produces.
 */
function buildConstruct(data: ExportVideoInput, roots: { x: number; y: number }[]) {
  const { source, params, tracks, viewport, duration } = data;
  const compiled = Symbolic.compile(preprocessImplicitMultiplication(source));

  return async function construct(scene: any) {
    // Explicit lengths are load-bearing on ecmanim 0.2.0: without them, an
    // axis is sized ~one scene unit per data unit, so this app's default
    // asymmetric yRange (-10..100 = 110 units) ran the axes -- and the curve
    // plotted against them -- almost entirely off-frame, rendering blank
    // clips (caught when the 0.0.11 -> 0.2.0 upgrade was verified against
    // the real viewport, not just a small symmetric scratch range).
    const axes = new Axes({
      xRange: [viewport.xMin, viewport.xMax, (viewport.xMax - viewport.xMin) / 10],
      yRange: [viewport.yMin, viewport.yMax, (viewport.yMax - viewport.yMin) / 10],
      xLength: 7,
      yLength: 6.4,
      axisConfig: { color: AXIS_COLOR },
    });
    const elapsedTracker = new ValueTracker(0);

    const curve = alwaysRedraw(() =>
      axes.plot(
        (x: number) => {
          const elapsed = elapsedTracker.getValue();
          const env: Record<string, number> = { ...params, x };
          for (const [name, track] of Object.entries(tracks)) {
            if (track) env[name] = interpolateKeyframes(track, elapsed);
          }
          return compiled(env);
        },
        { xRange: [viewport.xMin, viewport.xMax], color: CURVE_COLOR },
      ),
    );

    // Not scene.add()'d: a ValueTracker has no visible geometry of its own
    // (manim's convention too) -- it only needs to be handed to play() to
    // drive its own interpolation, which alwaysRedraw's curve then reads.
    scene.add(axes, curve);

    if (data.latex) {
      try {
        mathTexReady ??= initMathTex();
        await mathTexReady;
        const label = new MathTex(`y = ${data.latex}`, { color: LABEL_COLOR });
        // The render is square, so toCorner(UL) (which positions against the
        // full 16:9-ish frame) would land outside the visible crop --
        // top-center inside the square-safe zone instead, scaled to fit.
        const maxWidth = SQUARE_HALF_SPAN * 2 - 1;
        if (label.getWidth() > maxWidth) label.scale(maxWidth / label.getWidth());
        label.moveTo([0, SQUARE_HALF_SPAN - 0.6, 0]);
        scene.add(label);
      } catch {
        // Bad/unrenderable latex -- the label is a nicety, never fail the export for it.
      }
    }

    if (roots.length > 0) {
      const flashes = roots.map((r) => new Flash(axes.c2p(r.x, r.y)));
      await scene.play(...flashes, { runTime: HIGHLIGHT_PRELUDE_SECONDS });
    }

    const target = elapsedTracker.copy();
    target.setValue(duration);
    const advanceTime = new Transform(elapsedTracker, target, { rateFunc: rate_functions.linear });
    await scene.play(advanceTime, { runTime: duration });
  };
}

async function runExportJob(jobId: string, data: ExportVideoInput) {
  const { format } = data;
  try {
    const construct = buildConstruct(data, initialRootCrossings(data));

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

/**
 * One PNG frame of the export at `time` seconds, for the scrub-preview
 * slider -- ecmanim's renderStill replays the same construct the full
 * export uses (so the preview can't lie) up to the requested time and
 * renders exactly one frame. Fast enough to be a plain request/response;
 * no job queue involved. Preview is rendered at half the export's
 * resolution since it's a transient UI aid, not the deliverable.
 */
export const renderExportPreviewFrame = createServerFn({ method: "POST" })
  .validator((data: ExportVideoInput & { time: number }) => data)
  .handler(async ({ data }): Promise<ExportVideoResult> => {
    const construct = buildConstruct(data, initialRootCrossings(data));

    const { promises: fs } = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mallory-graph-preview-"));
    const outPath = path.join(dir, "preview.png");
    try {
      await renderStill(construct, {
        output: outPath,
        time: Math.max(0, data.time),
        pixelWidth: 320,
        pixelHeight: 320,
        background: "#ffffff",
        verbose: false,
      });
      const buffer = await fs.readFile(outPath);
      return { data: buffer.toString("base64"), mimeType: "image/png" };
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
