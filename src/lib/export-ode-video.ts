/**
 * Server-only ecmanim video/GIF export for a first-order ODE
 * (johnhenry/mallory-graph#3, pass 2) -- the /ode page previously had no
 * export path. The scene shows the slope field as an ArrowVectorField and
 * the RK4 solution progressively traced from the initial condition: a
 * TracedPath trails a moving dot per direction (one growing forward from
 * (x0, y0), one backward), driven by one linear ValueTracker -- the
 * pedagogically classic "watch the solution evolve from its initial
 * condition", matching the panel's own both-directions plot. StreamLines
 * (continuously flowing field animation) was considered and skipped: the
 * static arrows plus the moving trace already carry the story, and
 * StreamLines' per-frame line rebuilding is the slowest mobject in the
 * family.
 *
 * ArrowVectorField's function speaks *scene* coordinates (manim
 * convention): each sampled scene point is mapped back to data space via
 * axes.p2c, the slope evaluated there, and the unit direction (1, y')
 * mapped forward again through axes.c2p as a scene-space delta -- so the
 * arrows anchor to the same axes the solution curve plots against.
 *
 * The trajectory reuses sampleOdeSolution (the exact sampler the live
 * panel plots with, RK4 in both directions with non-finite cutoffs) and
 * splits its x-ascending point list at the initial condition's seam.
 */
import { createServerFn } from "@tanstack/react-start";
import { Symbolic } from "mallory-math";
import { ArrowVectorField, Axes, Dot, rate_functions, TracedPath, Transform, ValueTracker } from "ecmanim/node";
import { completeExportJob, createExportJob, failExportJob } from "./export-jobs.ts";
import { AXIS_COLOR, renderExportToBuffer } from "./export-render.ts";
import { preprocessImplicitMultiplication } from "./implicit-mult.ts";
import { sampleOdeSolution } from "./sample-ode.ts";

const TRACE_COLOR = "#16a34a";
const HEAD_COLOR = "#dc2626";
const FIELD_MIN_COLOR = "#93c5fd";
const FIELD_MAX_COLOR = "#1d4ed8";
/** Scene-space grid pitch for the field arrows -- ~13 columns across the 7-unit-wide axes. */
const FIELD_STEP = 0.55;

export interface OdeExportInput {
  /** dy/dx as an expression in x and y. */
  source: string;
  x0: number;
  y0: number;
  viewport: { xMin: number; xMax: number; yMin: number; yMax: number };
  duration: number;
  format: "mp4" | "gif";
}

/**
 * The RK4 trajectory split into the two runs a viewer watches grow from the
 * initial condition: `forward` ascending x0 -> xMax, `backward` descending
 * x0 -> xMin. Either may be empty (x0 at a domain edge, or an immediate
 * blow-up).
 */
function splitTrajectory(data: OdeExportInput): { forward: [number, number][]; backward: [number, number][] } {
  const path = sampleOdeSolution(
    data.source,
    data.x0,
    data.y0,
    { min: data.viewport.xMin, max: data.viewport.xMax },
    240,
  );
  const points = path.commands.map((c) => [c.x, c.y] as [number, number]);
  // Seam: the point closest to x0 (sampleOdeSolution seeds both runs there).
  let seam = 0;
  let best = Number.POSITIVE_INFINITY;
  points.forEach(([x], i) => {
    const d = Math.abs(x - data.x0);
    if (d < best) {
      best = d;
      seam = i;
    }
  });
  return {
    forward: points.slice(seam),
    backward: points.slice(0, seam + 1).reverse(),
  };
}

function buildOdeConstruct(data: OdeExportInput) {
  const compiled = Symbolic.compile(preprocessImplicitMultiplication(data.source));
  const slope = (x: number, y: number): number => compiled({ x, y });
  const { forward, backward } = splitTrajectory(data);
  const { viewport, duration } = data;

  return async function construct(scene: any) {
    const axes = new Axes({
      xRange: [viewport.xMin, viewport.xMax, (viewport.xMax - viewport.xMin) / 10],
      yRange: [viewport.yMin, viewport.yMax, (viewport.yMax - viewport.yMin) / 10],
      xLength: 7,
      yLength: 6.4,
      axisConfig: { color: AXIS_COLOR },
      // See export-video.ts's identical config for the fontSize rationale.
      xAxisConfig: { includeNumbers: true, fontSize: 0.24 },
      yAxisConfig: { includeNumbers: true, fontSize: 0.24 },
    });
    scene.add(axes);

    const [sxMin, syMin] = axes.c2p(viewport.xMin, viewport.yMin);
    const [sxMax, syMax] = axes.c2p(viewport.xMax, viewport.yMax);
    const field = new ArrowVectorField(
      (p: number[]) => {
        const [x, y] = axes.p2c(p);
        const m = slope(x, y);
        if (!Number.isFinite(m)) return [0, 0, 0];
        const n = Math.hypot(1, m);
        const a = axes.c2p(x, y);
        const b = axes.c2p(x + 1 / n, y + m / n);
        return [b[0] - a[0], b[1] - a[1], 0];
      },
      {
        xRange: [sxMin, sxMax, FIELD_STEP],
        yRange: [syMin, syMax, FIELD_STEP],
        minColor: FIELD_MIN_COLOR,
        maxColor: FIELD_MAX_COLOR,
      },
    );
    scene.add(field);

    const tracker = new ValueTracker(0);
    const runs = [forward, backward].filter((run) => run.length > 1);
    for (const run of runs) {
      const at = (): number[] => {
        const frac = Math.min(1, Math.max(0, tracker.getValue() / duration));
        const [x, y] = run[Math.min(run.length - 1, Math.floor(frac * (run.length - 1)))] as [number, number];
        return axes.c2p(x, y);
      };
      const dot = new Dot({ point: at(), color: HEAD_COLOR, radius: 0.08 });
      dot.addUpdater(() => {
        dot.moveTo(at());
      });
      const trail = new TracedPath(() => dot.getCenter(), { strokeColor: TRACE_COLOR, strokeWidth: 4 });
      scene.add(trail, dot);
    }

    const target = tracker.copy();
    target.setValue(duration);
    await scene.play(new Transform(tracker, target, { rateFunc: rate_functions.linear }), { runTime: duration });
  };
}

async function runOdeExportJob(jobId: string, data: OdeExportInput) {
  try {
    completeExportJob(jobId, await renderExportToBuffer(buildOdeConstruct(data), data.format));
  } catch (e) {
    failExportJob(jobId, e);
  }
}

export const startOdeExportJob = createServerFn({ method: "POST" })
  .validator((data: OdeExportInput) => data)
  .handler(async ({ data }) => {
    if (!(data.duration > 0)) throw new Error("Export duration must be positive.");
    const jobId = createExportJob();
    // Not awaited: renders in the background; the client polls via
    // export-video.ts's getExportVideoJob (one shared store/poll endpoint).
    void runOdeExportJob(jobId, data);
    return { jobId };
  });
