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
 * Two ecmanim 0.2.0 landmines this file is built around:
 * - `render()` constructs its CanvasRenderer around `options.camera`
 *   BEFORE makeScene runs, so the ThreeDCamera a ThreeDScene installs on
 *   itself is never the camera the renderer actually projects through --
 *   orientation/zoom set inside construct() silently do nothing. The
 *   ready-made ThreeDCamera must be passed through RenderOptions (see
 *   renderExportToBuffer), which both the renderer and the scene then
 *   share (ThreeDScene keeps a camera that's already a ThreeDCamera).
 * - The camera carries its own background: the renderer only applies
 *   `options.background` when the camera has none, and ThreeDCamera's
 *   default is a truthy black -- so white goes in the camera config.
 *
 * A Scene *subclass* (not a bare construct function) is required for 3D:
 * makeScene instantiates a plain 2D Scene for bare functions; only a
 * ThreeDScene drives depth sorting and ambient camera rotation. The class
 * is created per-job, closing over the request data.
 */
import { createServerFn } from "@tanstack/react-start";
import { Symbolic } from "mallory-math";
import { Surface, ThreeDAxes, ThreeDCamera, ThreeDScene } from "ecmanim/node";
import { completeExportJob, createExportJob, failExportJob } from "./export-jobs.ts";
import { renderExportToBuffer } from "./export-render.ts";
import { preprocessImplicitMultiplication } from "./implicit-mult.ts";

const SURFACE_COLORS = ["#3b82f6", "#60a5fa"];
const SURFACE_RESOLUTION = 28;

export interface SurfaceExportInput {
  source: string;
  /** Current value of every free variable (no keyframe tracks -- 3D has no timeline yet, matching Graph3DCanvas). */
  params: Record<string, number>;
  xDomain: { min: number; max: number };
  yDomain: { min: number; max: number };
  duration: number;
  format: "mp4" | "gif";
}

/**
 * z-range for the axes, from a coarse sample of the surface itself --
 * hardcoding a range would clip a tall surface and dwarf a flat one.
 * Non-finite samples (poles, domain holes) are skipped, matching the
 * client sampler's own tolerance; a degenerate/flat result falls back to
 * a symmetric unit-ish range so the axes still have extent.
 */
function surfaceZRange(f: (x: number, y: number) => number, input: SurfaceExportInput): [number, number] {
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
  if (!Number.isFinite(zMin) || !Number.isFinite(zMax)) return [-1, 1];
  if (zMax - zMin < 1e-9) return [zMin - 1, zMax + 1];
  const pad = (zMax - zMin) * 0.1;
  return [zMin - pad, zMax + pad];
}

async function runSurfaceExportJob(jobId: string, data: SurfaceExportInput) {
  try {
    const compiled = Symbolic.compile(preprocessImplicitMultiplication(data.source));
    const f = (x: number, y: number): number => compiled({ ...data.params, x, y });
    const [zMin, zMax] = surfaceZRange(f, data);
    const { xDomain, yDomain, duration } = data;

    class SurfaceExportScene extends ThreeDScene {
      override async construct() {
        const axes = new ThreeDAxes({
          xRange: [xDomain.min, xDomain.max, (xDomain.max - xDomain.min) / 10],
          yRange: [yDomain.min, yDomain.max, (yDomain.max - yDomain.min) / 10],
          zRange: [zMin, zMax, (zMax - zMin) / 4],
          xLength: 6,
          yLength: 6,
          zLength: 3,
        });
        const surface = new Surface(
          (u: number, v: number) => {
            const z = f(u, v);
            // A pole/hole still has to return *a* point (Surface tessellates a
            // full grid); clamp it to the axes' z extent so one singular cell
            // doesn't stretch the whole tessellation off-frame.
            return axes.c2p(u, v, Number.isFinite(z) ? Math.min(Math.max(z, zMin), zMax) : zMin);
          },
          {
            uRange: [xDomain.min, xDomain.max],
            vRange: [yDomain.min, yDomain.max],
            resolution: SURFACE_RESOLUTION,
            checkerboardColors: SURFACE_COLORS,
            fillOpacity: 0.85,
          },
        );
        this.enableDepthSorting(true);
        this.add(axes, surface);
        // One full orbit over the clip: rate is radians/second.
        this.beginAmbientCameraRotation({ rate: (2 * Math.PI) / duration });
        await this.wait(duration);
        this.stopAmbientCameraRotation();
      }
    }

    const camera = new ThreeDCamera({
      phi: (65 * Math.PI) / 180,
      theta: (-45 * Math.PI) / 180,
      zoom: 0.75,
      background: "#ffffff",
    });
    completeExportJob(jobId, await renderExportToBuffer(SurfaceExportScene, data.format, camera));
  } catch (e) {
    failExportJob(jobId, e);
  }
}

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
