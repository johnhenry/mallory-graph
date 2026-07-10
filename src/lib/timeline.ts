/**
 * Parameter timeline/keyframes (Premiere/After-Effects-inspired): a slider
 * parameter can be keyframed (`k=0 at t=0, k=5 at t=3s`) instead of held at a
 * single static value, turning a family of curves into a live in-app
 * animation. Pure math lives here; GraphCanvas wires it into the reactive
 * core by switching a param cell between `graph.set` (static) and
 * `graph.define` (interpolated from a track + the shared TIME_CELL).
 */
export interface Keyframe {
  t: number;
  value: number;
}

/**
 * Linearly interpolates a track's value at time `t`. Assumes `track` is
 * sorted ascending by `t` (callers keep it sorted on every edit). Clamps to
 * the first/last keyframe outside the track's time range.
 */
export function interpolateKeyframes(track: Keyframe[], t: number): number {
  if (track.length === 0) return 0;
  if (t <= track[0].t) return track[0].value;
  const last = track[track.length - 1];
  if (t >= last.t) return last.value;
  for (let i = 0; i < track.length - 1; i++) {
    const a = track[i];
    const b = track[i + 1];
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t;
      return span === 0 ? a.value : a.value + (b.value - a.value) * ((t - a.t) / span);
    }
  }
  return last.value;
}

/** The shared timeline's duration is the latest keyframe across every animated track (0 if none). */
export function timelineDuration(tracks: Array<Keyframe[] | undefined>): number {
  let maxT = 0;
  for (const track of tracks) {
    if (track && track.length > 0) maxT = Math.max(maxT, track[track.length - 1].t);
  }
  return maxT;
}

/**
 * Seconds of Flash-highlight prelude the video export plays before the
 * parameter animation when the curve has root crossings (see
 * export-video.ts's construct). Lives here (client-safe module) rather than
 * in export-video.ts because TanStack Start strips that module down to RPC
 * stubs on the client -- a plain const exported from it wouldn't survive --
 * and the export UI's preview slider needs this to span the full clip.
 */
export const HIGHLIGHT_PRELUDE_SECONDS = 0.8;
