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
 * Bounded MVP per the plan's own flagged risk: renders synchronously inside
 * the request (short clip, modest resolution) rather than an async job
 * queue or separate worker app.
 */
import { createServerFn } from "@tanstack/react-start";
import { Symbolic } from "mallory-ts";
import { Axes, alwaysRedraw, render } from "manim-js/node";
import { preprocessImplicitMultiplication } from "./implicit-mult.ts";
import { interpolateKeyframes, type Keyframe } from "./timeline.ts";

const MAX_DURATION_SECONDS = 12;

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

export const exportVideo = createServerFn({ method: "POST" })
  .validator((data: ExportVideoInput) => data)
  .handler(async ({ data }) => {
    const { source, params, tracks, viewport, duration, format } = data;
    if (duration <= 0) {
      throw new Error("Nothing to export: no parameter has a keyframe track.");
    }
    const clampedDuration = Math.min(duration, MAX_DURATION_SECONDS);
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
      await scene.wait(clampedDuration);
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
      return {
        data: buffer.toString("base64"),
        mimeType: format === "gif" ? "image/gif" : "video/mp4",
      };
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
