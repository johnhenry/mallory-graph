/**
 * Server-only ecmanim video/GIF export for a z = f(x, y) surface
 * (johnhenry/mallory-graph#3, pass 2) -- the 3D page previously had no
 * export path at all. The scene is a ThreeDAxes + a function-based Surface
 * (cleaner than importing the client's Three.js mesh data: ecmanim's
 * Surface takes the same (u, v) -> point closure the client's sampler is
 * itself built from, so there's nothing to serialize), animated with a
 * slow full camera orbit over the export's duration -- the compelling
 * default for a 3D clip. The cross-section slider's highlight is NOT
 * animated here; the orbit is the core deliverable (see #3's own
 * "optional flourish" framing).
 *
 * `this.camera = new ThreeDCamera({...})` in the Scene subclass's own
 * constructor is now the idiomatic, ecmanim-0.5.0-and-later pattern for a
 * 3D export -- no external camera threading needed (see
 * `export-render.ts`'s doc comment for the ecmanim-0.2.0 bug this used to
 * work around, how 0.5.0 fixed the *projection* half of it, and why the
 * camera's own `background` config field is still required explicitly
 * despite that fix).
 *
 * A Scene *subclass* (not a bare construct function) is required for 3D:
 * makeScene instantiates a plain 2D Scene for bare functions; only a
 * ThreeDScene drives depth sorting and ambient camera rotation. The class
 * is created per-job, closing over the request data.
 *
 * 3D timeline parity (johnhenry/mallory-graph#3, pass 3): when any free
 * variable has a keyframe track, the surface is no longer static -- it's
 * re-tessellated every frame via `Surface.setFunc` from a `surface.addUpdater`
 * callback, composing for free with the existing camera-orbit
 * `beginAmbientCameraRotation`/`wait` structure (`ThreeDScene.updateMobjects`
 * runs every mobject's updaters during both `scene.play()` and `scene.wait()`
 * -- confirmed in ecmanim's own source, no restructuring needed here). The
 * plain orbit-only (no animated params) path is unchanged: `setFunc` is
 * never called, so there's zero added per-frame cost for the common case.
 *
 * Scrub-preview (mallory-graph#9): `buildSurfaceScene` is the single scene
 * factory shared by the full render (`runSurfaceExportJob`) and the
 * single-frame preview (`renderSurfacePreviewFrame`), mirroring
 * export-video.ts's `buildConstruct`/`renderExportPreviewFrame` split -- so
 * the preview can never drift from what the real export produces.
 * `renderStill`'s own doc comment (ecmanim/src/node.ts) confirms it accepts
 * a Scene subclass directly, same as `render()`, not just a bare construct
 * function -- no bare-function wrapper needed for the 3D case despite
 * `makeScene` otherwise requiring a ThreeDScene subclass for depth sorting
 * and ambient camera rotation.
 */
import { createServerFn } from "@tanstack/react-start";
import { Symbolic } from "mallory-math";
import { renderStill, Surface, ThreeDAxes, ThreeDCamera, ThreeDScene } from "ecmanim/node";
import { completeExportJob, createExportJob, failExportJob, type ExportVideoResult } from "./export-jobs.ts";
import { renderExportToBuffer } from "./export-render.ts";
import { preprocessImplicitMultiplication } from "./implicit-mult.ts";
import { interpolateKeyframes, type Keyframe } from "./timeline.ts";

const SURFACE_COLORS = ["#3b82f6", "#60a5fa"];
const SURFACE_RESOLUTION = 28;
/**
 * Resolution used on the animated path (`Surface.setFunc` rebuilds the whole
 * face mesh every frame, unlike the static/orbit-only path which builds
 * once). Measured directly (one animated var, duration=4s, 24fps -> 120
 * setFunc calls) against a same-duration static-orbit export before picking
 * this: at resolution 28, the animated export's total wall-clock was ~1.5x
 * the static one's (setFunc itself averaged ~13ms/call, ~1.5s of the clip's
 * ~11s total render time) -- comfortably inside the ~2-3x acceptance
 * ceiling, so the animated path keeps the same resolution as the static one
 * rather than trading visual fidelity for speed it doesn't need. (A
 * candidate resolution=18 measured ~1.1x -- faster, but not needed to clear
 * the bar.)
 */
const ANIMATED_SURFACE_RESOLUTION = SURFACE_RESOLUTION;

export interface SurfaceExportInput {
  source: string;
  /** Current value of every free variable (used as-is for the ones with no track). */
  params: Record<string, number>;
  /** Keyframe track per free variable; absent/undefined means "held at params[name]". */
  tracks: Record<string, Keyframe[] | undefined>;
  xDomain: { min: number; max: number };
  yDomain: { min: number; max: number };
  duration: number;
  format: "mp4" | "gif";
}

/**
 * Common padding/fallback logic for a sampled [zMin, zMax] extent -- shared
 * by the static (`surfaceZRange`) and animated (`animatedSurfaceZRange`)
 * samplers below. Non-finite input (nothing finite sampled at all) falls
 * back to a symmetric unit-ish range so the axes still have extent; a
 * degenerate/flat result gets a +/-1 pad instead of a zero-width axis.
 */
function padZExtent(zMin: number, zMax: number): [number, number] {
  if (!Number.isFinite(zMin) || !Number.isFinite(zMax)) return [-1, 1];
  if (zMax - zMin < 1e-9) return [zMin - 1, zMax + 1];
  const pad = (zMax - zMin) * 0.1;
  return [zMin - pad, zMax + pad];
}

/** Coarse [zMin, zMax] sample of `f` over the export's x/y domain, skipping non-finite samples (poles, domain holes). */
function sampleZExtent(f: (x: number, y: number) => number, input: SurfaceExportInput): [number, number] {
  let zMin = Number.POSITIVE_INFINITY;
  let zMax = Number.NEGATIVE_INFINITY;
  const N = 24;
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const x = input.xDomain.min + (i / N) * (input.xDomain.max - input.xDomain.min);
      const y = input.yDomain.min + (j / N) * (input.yDomain.max - input.yDomain.min);
      const z = f(x, y);
      if (!Number.isFinite(z)) continue;
      if (z < zMin) zMin = z;
      if (z > zMax) zMax = z;
    }
  }
  return [zMin, zMax];
}

/**
 * z-range for the axes, from a coarse sample of the surface itself --
 * hardcoding a range would clip a tall surface and dwarf a flat one.
 */
function surfaceZRange(f: (x: number, y: number) => number, input: SurfaceExportInput): [number, number] {
  const [zMin, zMax] = sampleZExtent(f, input);
  return padZExtent(zMin, zMax);
}

/**
 * Like `surfaceZRange`, but for an animated surface: samples at t=0, t=duration,
 * and every keyframe time (deduped, clamped to [0, duration]) across every
 * track, then unions the extents -- so the fixed z-axis comfortably bounds
 * the whole clip instead of just the initial frame.
 */
function animatedSurfaceZRange(zAt: (t: number, x: number, y: number) => number, input: SurfaceExportInput): [number, number] {
  const times = new Set<number>([0, input.duration]);
  for (const track of Object.values(input.tracks)) {
    if (!track) continue;
    for (const k of track) {
      if (k.t >= 0 && k.t <= input.duration) times.add(k.t);
    }
  }
  let zMin = Number.POSITIVE_INFINITY;
  let zMax = Number.NEGATIVE_INFINITY;
  for (const t of times) {
    const [tMin, tMax] = sampleZExtent((x, y) => zAt(t, x, y), input);
    if (tMin < zMin) zMin = tMin;
    if (tMax > zMax) zMax = tMax;
  }
  return padZExtent(zMin, zMax);
}

/**
 * The shared scene factory for both the full render and the single-frame
 * preview -- one factory so the preview can't drift out of sync with what
 * the real export produces (see this file's own doc comment).
 */
function buildSurfaceScene(data: SurfaceExportInput) {
  const compiled = Symbolic.compile(preprocessImplicitMultiplication(data.source));
  const hasAnimatedParams = Object.values(data.tracks).some((track) => track != null && track.length > 0);
  const zAt = (t: number, x: number, y: number): number => {
    const env: Record<string, number> = { ...data.params, x, y };
    for (const [name, track] of Object.entries(data.tracks)) {
      if (track) env[name] = interpolateKeyframes(track, t);
    }
    return compiled(env);
  };
  const [zMin, zMax] = hasAnimatedParams
    ? animatedSurfaceZRange(zAt, data)
    : surfaceZRange((x, y) => zAt(0, x, y), data);
  const { xDomain, yDomain, duration } = data;

  return class SurfaceExportScene extends ThreeDScene {
    constructor() {
      super();
      this.camera = new ThreeDCamera({
        phi: (65 * Math.PI) / 180,
        theta: (-45 * Math.PI) / 180,
        zoom: 0.75,
        background: "#ffffff",
      });
    }
    override async construct() {
      const axes = new ThreeDAxes({
        xRange: [xDomain.min, xDomain.max, (xDomain.max - xDomain.min) / 10],
        yRange: [yDomain.min, yDomain.max, (yDomain.max - yDomain.min) / 10],
        zRange: [zMin, zMax, (zMax - zMin) / 4],
        xLength: 6,
        yLength: 6,
        zLength: 3,
      });
      // A pole/hole still has to return *a* point (Surface tessellates a
      // full grid); clamp it to the axes' z extent so one singular cell
      // doesn't stretch the whole tessellation off-frame.
      const surfaceFuncAt = (t: number) => (u: number, v: number) => {
        const z = zAt(t, u, v);
        return axes.c2p(u, v, Number.isFinite(z) ? Math.min(Math.max(z, zMin), zMax) : zMin);
      };
      const surface = new Surface(surfaceFuncAt(0), {
        uRange: [xDomain.min, xDomain.max],
        vRange: [yDomain.min, yDomain.max],
        resolution: hasAnimatedParams ? ANIMATED_SURFACE_RESOLUTION : SURFACE_RESOLUTION,
        checkerboardColors: SURFACE_COLORS,
        fillOpacity: 0.85,
      });
      this.enableDepthSorting(true);
      this.add(axes, surface);
      if (hasAnimatedParams) {
        let elapsed = 0;
        surface.addUpdater(
          (_m, dt) => {
            elapsed += dt;
            surface.setFunc(surfaceFuncAt(elapsed));
          },
          { hashExtra: () => String(elapsed) },
        );
      }
      // One full orbit over the clip: rate is radians/second.
      this.beginAmbientCameraRotation({ rate: (2 * Math.PI) / duration });
      await this.wait(duration);
      this.stopAmbientCameraRotation();
    }
  };
}

async function runSurfaceExportJob(jobId: string, data: SurfaceExportInput) {
  try {
    completeExportJob(jobId, await renderExportToBuffer(buildSurfaceScene(data), data.format));
  } catch (e) {
    failExportJob(jobId, e);
  }
}

/**
 * One PNG frame of the surface export at `time` seconds, for a scrub
 * preview -- mirrors export-video.ts's `renderExportPreviewFrame`
 * (mallory-graph#9). Rendered at half the export's resolution (320x320 vs
 * 640x640) since it's a transient UI aid, not the deliverable.
 */
export const renderSurfacePreviewFrame = createServerFn({ method: "POST" })
  .validator((data: SurfaceExportInput & { time: number }) => data)
  .handler(async ({ data }): Promise<ExportVideoResult> => {
    const scene = buildSurfaceScene(data);

    const { promises: fs } = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mallory-graph-surface-preview-"));
    const outPath = path.join(dir, "preview.png");
    try {
      await renderStill(scene, {
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

export const startSurfaceExportJob = createServerFn({ method: "POST" })
  .validator((data: SurfaceExportInput) => data)
  .handler(async ({ data }) => {
    if (!(data.duration > 0)) throw new Error("Export duration must be positive.");
    const jobId = createExportJob();
    // Not awaited: renders in the background; the client polls via
    // export-video.ts's getExportVideoJob (one shared store/poll endpoint).
    void runSurfaceExportJob(jobId, data);
    return { jobId };
  });
