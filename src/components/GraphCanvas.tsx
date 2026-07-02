import { Rational, Symbolic, type DifferentiationStep, type Expr, type Path2D } from "mallory-ts";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CellGraph } from "../lib/cell-graph.ts";
import { exportVideo } from "../lib/export-video.ts";
import { exprToLatex } from "../lib/expr-to-latex.ts";
import { integersModuloStructure } from "../lib/finite-structure.ts";
import { collectFreeVars, defaultSliderRange } from "../lib/free-vars.ts";
import { DEFAULT_GRAPH_STATE, decodeGraphState, encodeGraphState, type GraphState } from "../lib/graph-state.ts";
import { preprocessImplicitMultiplication } from "../lib/implicit-mult.ts";
import { resolveNaturalLanguageQuery } from "../lib/nl-query.ts";
import { evaluateExprAsRational } from "../lib/rational-eval.ts";
import { drawPath, drawPoint, drawScatter, type Viewport } from "../lib/render-path.ts";
import { sampleExpr } from "../lib/sample-function.ts";
import { sampleStructureExpr, type ScatterPoint } from "../lib/sample-structure.ts";
import { interpolateKeyframes, timelineDuration, type Keyframe } from "../lib/timeline.ts";
import { TexSpan } from "./TexSpan.tsx";
import { useCell } from "../lib/use-cell.ts";
import { toDataX, toScreenX, toScreenY } from "../lib/viewport.ts";

const STRUCTURE_OPTIONS: Array<{ label: string; modulus: number | null }> = [
  { label: "Real numbers", modulus: null },
  { label: "Z/2Z (GF(2))", modulus: 2 },
  { label: "Z/5Z", modulus: 5 },
  { label: "Z/7Z (GF(7))", modulus: 7 },
  { label: "Z/11Z", modulus: 11 },
];

const WIDTH = 600;
const HEIGHT = 600;
const RESOLUTION = 400;
const AXIS_VARIABLE = "x";
const HANDLE_HIT_RADIUS = 12;
const CELL_ID = DEFAULT_GRAPH_STATE.cells[0].id;
const EXPR_CELL = `expr:${CELL_ID}`;
const FREE_VARS_CELL = `freeVars:${CELL_ID}`;
const PARAMS_CELL = `params:${CELL_ID}`;
const PATH_CELL = `path:${CELL_ID}`;
const POINT_X_CELL = `pointX:${CELL_ID}`;
const POINT_CELL = `point:${CELL_ID}`;
const EXACT_CELL = `exact:${CELL_ID}`;
const STRUCTURE_CELL = `structure:${CELL_ID}`;
const SCATTER_CELL = `scatter:${CELL_ID}`;
const DERIVATIVE_CELL = `derivative:${CELL_ID}`;
const TIME_CELL = `time:${CELL_ID}`;
const TIMELINE_DURATION_CELL = `timelineDuration:${CELL_ID}`;
const paramCellId = (name: string) => `param:${CELL_ID}:${name}`;
const trackCellId = (name: string) => `track:${CELL_ID}:${name}`;

interface CurvePoint {
  x: number;
  y: number;
}

interface Derivative {
  steps: DifferentiationStep[];
  result: Expr;
}

/**
 * Sets up the reactive graph once: source expr cell -> free-var list ->
 * per-variable slider cells (seeded lazily, so re-parsing on every keystroke
 * doesn't clobber a value the user already dragged) -> params snapshot ->
 * derived sampled-path cell. PATH_CELL falls back to the last successfully
 * sampled path on a parse/eval error, so a mid-typing invalid expression
 * (e.g. "2x sin(") leaves the last good curve on screen instead of blanking
 * the canvas.
 */
function useExpressionGraph(source: string, viewport: Viewport): CellGraph {
  const ref = useRef<CellGraph | null>(null);
  if (!ref.current) {
    const graph = new CellGraph();
    graph.set(EXPR_CELL, source);

    graph.define(FREE_VARS_CELL, () => {
      let names: string[] = [];
      try {
        const expr = Symbolic.parse(preprocessImplicitMultiplication(graph.get<string>(EXPR_CELL)));
        names = collectFreeVars(expr, AXIS_VARIABLE);
      } catch {
        // Leave `names` empty on a mid-typing parse error; sliders just don't update.
      }
      for (const name of names) {
        const id = paramCellId(name);
        if (!graph.has(id)) graph.set(id, defaultSliderRange(name).default);
      }
      return names;
    });

    graph.define(PARAMS_CELL, () => {
      const names = graph.get<string[]>(FREE_VARS_CELL);
      const params: Record<string, number> = {};
      for (const name of names) params[name] = graph.get<number>(paramCellId(name));
      return params;
    });

    let lastGoodPath: Path2D | null = null;
    graph.define(PATH_CELL, () => {
      try {
        const params = graph.get<Record<string, number>>(PARAMS_CELL);
        lastGoodPath = sampleExpr(
          graph.get<string>(EXPR_CELL),
          { min: viewport.xMin, max: viewport.xMax },
          RESOLUTION,
          AXIS_VARIABLE,
          params,
        );
      } catch {
        if (!lastGoodPath) throw new Error(`Initial expression "${source}" failed to parse`);
      }
      return lastGoodPath;
    });

    graph.set(POINT_X_CELL, (viewport.xMin + viewport.xMax) / 2);

    // A handle dragged along the curve: x follows the pointer, y is
    // re-derived from the current expression/params, so it stays
    // curve-constrained through any edit or slider drag.
    let lastGoodPoint: CurvePoint | null = null;
    graph.define(POINT_CELL, () => {
      try {
        const x = graph.get<number>(POINT_X_CELL);
        const params = graph.get<Record<string, number>>(PARAMS_CELL);
        const compiled = Symbolic.compile(preprocessImplicitMultiplication(graph.get<string>(EXPR_CELL)));
        lastGoodPoint = { x, y: compiled({ ...params, [AXIS_VARIABLE]: x }) };
      } catch {
        // Leave the handle at its last good position on a mid-typing parse error.
      }
      return lastGoodPoint;
    });

    // Exact-mode readout: re-evaluates the current handle position over
    // Rational arithmetic instead of floats. Returns null (not "0.333...")
    // whenever the expression isn't exactly representable — a `func` node or
    // a non-integer `pow` exponent — so callers fall back to the float value.
    graph.define(EXACT_CELL, () => {
      try {
        const x = graph.get<number>(POINT_X_CELL);
        const params = graph.get<Record<string, number>>(PARAMS_CELL);
        const expr = Symbolic.parse(preprocessImplicitMultiplication(graph.get<string>(EXPR_CELL)));
        const env: Record<string, Rational> = { [AXIS_VARIABLE]: Rational.fromNumber(x) };
        for (const [name, value] of Object.entries(params)) env[name] = Rational.fromNumber(value);
        return evaluateExprAsRational(expr, env).toString();
      } catch {
        return null;
      }
    });

    // "Show steps" accordion: derivative of the current expression w.r.t. the
    // axis variable, plus a bottom-up trace of every rule applied.
    graph.define(DERIVATIVE_CELL, (): Derivative | null => {
      try {
        const expr = Symbolic.parse(preprocessImplicitMultiplication(graph.get<string>(EXPR_CELL)));
        return Symbolic.differentiateSteps(expr, AXIS_VARIABLE);
      } catch {
        return null;
      }
    });

    graph.set(STRUCTURE_CELL, null as number | null);

    // Structure selector: when set to a modulus, plots a finite scatter (all
    // elements of Z/nZ) instead of the continuous sampled path.
    graph.define(SCATTER_CELL, () => {
      const modulus = graph.get<number | null>(STRUCTURE_CELL);
      if (modulus === null) return null;
      try {
        const params = graph.get<Record<string, number>>(PARAMS_CELL);
        return sampleStructureExpr(graph.get<string>(EXPR_CELL), integersModuloStructure(modulus), AXIS_VARIABLE, params);
      } catch {
        return [];
      }
    });

    // Parameter timeline: a param's value cell is either a plain `set` cell
    // (static, dragged manually) or, once SliderControl enables a keyframe
    // track for it, redefined to interpolate from that track + TIME_CELL --
    // the same "cell reads another cell's current value" mechanism that
    // powers sliders and direct manipulation elsewhere in this graph.
    graph.set(TIME_CELL, 0);
    graph.define(TIMELINE_DURATION_CELL, () => {
      const names = graph.get<string[]>(FREE_VARS_CELL);
      return timelineDuration(names.map((name) => graph.get<Keyframe[] | undefined>(trackCellId(name))));
    });

    ref.current = graph;
  }
  return ref.current;
}

export function GraphCanvas() {
  const viewport = DEFAULT_GRAPH_STATE.viewport;
  const graph = useExpressionGraph(DEFAULT_GRAPH_STATE.cells[0].source, viewport);
  const path = useCell<Path2D>(graph, PATH_CELL);
  const point = useCell<CurvePoint | null>(graph, POINT_CELL);
  const exact = useCell<string | null>(graph, EXACT_CELL);
  const freeVars = useCell<string[]>(graph, FREE_VARS_CELL);
  const modulus = useCell<number | null>(graph, STRUCTURE_CELL);
  const scatter = useCell<ScatterPoint[] | null>(graph, SCATTER_CELL);
  const derivative = useCell<Derivative | null>(graph, DERIVATIVE_CELL);
  const time = useCell<number>(graph, TIME_CELL);
  const duration = useCell<number>(graph, TIMELINE_DURATION_CELL);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draggingRef = useRef(false);
  const [source, setSource] = useState(DEFAULT_GRAPH_STATE.cells[0].source);
  const [mode, setMode] = useState<"float" | "exact">("float");
  const [showSteps, setShowSteps] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [exportFormat, setExportFormat] = useState<"mp4" | "gif">("mp4");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportVideoFn = useServerFn(exportVideo);

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const names = graph.get<string[]>(FREE_VARS_CELL);
      const params: Record<string, number> = {};
      const tracks: Record<string, Keyframe[] | undefined> = {};
      for (const name of names) {
        params[name] = graph.get<number>(paramCellId(name));
        tracks[name] = graph.get<Keyframe[] | undefined>(trackCellId(name));
      }
      const result = await exportVideoFn({
        data: {
          source: graph.get<string>(EXPR_CELL),
          params,
          tracks,
          viewport,
          duration,
          format: exportFormat,
        },
      });
      const bytes = Uint8Array.from(atob(result.data), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: result.mimeType }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `mallory-graph-export.${exportFormat}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  }

  // Hydrate from the URL fragment (if any) once, on mount. Params/structure
  // are written before the source, so when the new source dirties
  // FREE_VARS_CELL, its lazy default-seeding (`if (!graph.has(id))`) finds
  // these slider cells already populated and leaves the decoded values alone.
  useEffect(() => {
    const decoded = decodeGraphState(window.location.hash.slice(1));
    if (!decoded) return;
    for (const [name, value] of Object.entries(decoded.params)) graph.set(paramCellId(name), value);
    graph.set(STRUCTURE_CELL, decoded.structureModulus);
    graph.set(EXPR_CELL, decoded.cells[0].source);
    setSource(decoded.cells[0].source);
    setMode(decoded.mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the URL fragment in sync with the live graph state, so copying the
  // current URL and opening it elsewhere reproduces the graph exactly.
  useEffect(() => {
    function syncUrl() {
      const names = graph.get<string[]>(FREE_VARS_CELL);
      const params: Record<string, number> = {};
      for (const name of names) params[name] = graph.get<number>(paramCellId(name));
      const state: GraphState = {
        v: 2,
        cells: [{ id: CELL_ID, source: graph.get<string>(EXPR_CELL) }],
        viewport,
        params,
        structureModulus: graph.get<number | null>(STRUCTURE_CELL),
        mode,
      };
      window.history.replaceState(null, "", `#${encodeGraphState(state)}`);
    }
    syncUrl();
    return graph.subscribeAll(syncUrl);
  }, [graph, viewport, mode]);

  // Timeline playback: advances TIME_CELL by real elapsed time (scaled by
  // speed) every frame, looping back to 0 at `duration` or stopping there.
  useEffect(() => {
    if (!playing || duration <= 0) return;
    let raf = 0;
    let last = performance.now();
    function tick(now: number) {
      const dt = ((now - last) / 1000) * speed;
      last = now;
      let next = graph.get<number>(TIME_CELL) + dt;
      if (next >= duration) {
        if (loop) next %= duration;
        else {
          next = duration;
          setPlaying(false);
        }
      }
      graph.set(TIME_CELL, next);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, loop, speed, duration, graph]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    if (scatter) {
      drawScatter(ctx, scatter, viewport, WIDTH, HEIGHT);
    } else {
      drawPath(ctx, path, viewport, WIDTH, HEIGHT);
      if (point) drawPoint(ctx, point, viewport, WIDTH, HEIGHT);
    }
  }, [path, point, scatter, viewport]);

  function handlePointerDown(e: PointerEvent<HTMLCanvasElement>) {
    if (!point || modulus !== null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const handleSx = toScreenX(point.x, viewport, WIDTH);
    const handleSy = toScreenY(point.y, viewport, HEIGHT);
    if (Math.hypot(sx - handleSx, sy - handleSy) > HANDLE_HIT_RADIUS) return;
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (!draggingRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const x = Math.min(viewport.xMax, Math.max(viewport.xMin, toDataX(sx, viewport, WIDTH)));
    graph.set(POINT_X_CELL, x);
  }

  function handlePointerUp(e: PointerEvent<HTMLCanvasElement>) {
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  return (
    <div>
      <label>
        y ={" "}
        <input
          value={source}
          onChange={(e) => {
            const value = e.target.value;
            setSource(value);
            graph.set(EXPR_CELL, resolveNaturalLanguageQuery(value) ?? value);
          }}
          style={{ font: "inherit", width: "20ch" }}
        />
      </label>
      {freeVars.length > 0 && (
        <div style={{ display: "flex", gap: "1rem", margin: "0.5rem 0" }}>
          {freeVars.map((name) => (
            <SliderControl key={name} graph={graph} name={name} />
          ))}
        </div>
      )}
      {duration > 0 && (
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", margin: "0.5rem 0" }}>
          <button type="button" onClick={() => setPlaying((p) => !p)}>
            {playing ? "Pause" : "Play"}
          </button>
          <label>
            <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> Loop
          </label>
          <label>
            Speed{" "}
            <input
              type="number"
              value={speed}
              min={0.1}
              step={0.1}
              style={{ width: "4ch" }}
              onChange={(e) => setSpeed(Number(e.target.value))}
            />
          </label>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.01}
            value={Math.min(time, duration)}
            onChange={(e) => {
              setPlaying(false);
              graph.set(TIME_CELL, Number(e.target.value));
            }}
          />
          <span>
            {time.toFixed(2)}s / {duration.toFixed(2)}s
          </span>
          <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as "mp4" | "gif")}>
            <option value="mp4">MP4</option>
            <option value="gif">GIF</option>
          </select>
          <button type="button" onClick={handleExport} disabled={exporting}>
            {exporting ? "Exporting…" : "Export"}
          </button>
          {exportError && <span style={{ color: "crimson" }}>{exportError}</span>}
        </div>
      )}
      <label style={{ display: "block", margin: "0.5rem 0" }}>
        Structure:{" "}
        <select
          value={modulus === null ? "real" : String(modulus)}
          onChange={(e) => {
            const v = e.target.value;
            graph.set(STRUCTURE_CELL, v === "real" ? null : Number(v));
          }}
        >
          {STRUCTURE_OPTIONS.map((opt) => (
            <option key={opt.label} value={opt.modulus === null ? "real" : String(opt.modulus)}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      {modulus === null && (
        <div role="radiogroup" aria-label="Arithmetic mode" style={{ margin: "0.5rem 0" }}>
          <label>
            <input type="radio" name="mode" checked={mode === "float"} onChange={() => setMode("float")} /> Float
          </label>{" "}
          <label>
            <input type="radio" name="mode" checked={mode === "exact"} onChange={() => setMode("exact")} /> Exact
          </label>
        </div>
      )}
      <div>
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          style={{ border: "1px solid #ccc", touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      </div>
      {modulus === null && point && (
        <div>
          y = {mode === "exact" ? exact ?? `${point.y.toFixed(4)} (not exact)` : point.y.toFixed(4)}
        </div>
      )}
      {modulus === null && derivative && (
        <div style={{ margin: "0.5rem 0" }}>
          <button type="button" onClick={() => setShowSteps((v) => !v)}>
            {showSteps ? "▾" : "▸"} Show steps: dy/dx = <TexSpan tex={exprToLatex(derivative.result)} />
          </button>
          {showSteps && (
            <ol>
              {derivative.steps.map((step, i) => (
                <li key={i}>
                  <strong>{step.rule}</strong>: d/dx[<TexSpan tex={exprToLatex(step.input)} />] ={" "}
                  <TexSpan tex={exprToLatex(step.output)} />
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

function SliderControl({ graph, name }: { graph: CellGraph; name: string }) {
  const id = paramCellId(name);
  const trackId = trackCellId(name);
  const value = useCell<number>(graph, id);
  const track = useCell<Keyframe[] | undefined>(graph, trackId);
  const range = defaultSliderRange(name);
  const animated = track != null && track.length > 0;

  function toggleAnimated() {
    if (animated) {
      graph.set(id, value);
      graph.set(trackId, undefined);
    } else {
      graph.set(trackId, [{ t: 0, value }, { t: 3, value: range.max }]);
      graph.define(id, () => interpolateKeyframes(graph.get<Keyframe[]>(trackId), graph.get<number>(TIME_CELL)));
    }
  }

  function updateKeyframe(i: number, patch: Partial<Keyframe>) {
    if (!track) return;
    const next = track.map((k, idx) => (idx === i ? { ...k, ...patch } : k)).sort((a, b) => a.t - b.t);
    graph.set(trackId, next);
  }

  function addKeyframe() {
    if (!track) return;
    const lastT = track.length > 0 ? track[track.length - 1].t : 0;
    graph.set(trackId, [...track, { t: lastT + 1, value: range.default }]);
  }

  function removeKeyframe(i: number) {
    if (!track) return;
    graph.set(trackId, track.filter((_, idx) => idx !== i));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem", border: "1px solid #eee", padding: "0.4rem" }}>
      <label style={{ display: "flex", flexDirection: "column" }}>
        {name} = {value.toFixed(2)}
        <input
          type="range"
          min={range.min}
          max={range.max}
          step={range.step}
          value={value}
          disabled={animated}
          onChange={(e) => graph.set(id, Number(e.target.value))}
        />
      </label>
      <label>
        <input type="checkbox" checked={animated} onChange={toggleAnimated} /> Animate
      </label>
      {animated && track && (
        <div>
          {track.map((k, i) => (
            <div key={i} style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
              <input
                type="number"
                aria-label={`keyframe ${i} time`}
                value={k.t}
                step={0.1}
                style={{ width: "4ch" }}
                onChange={(e) => updateKeyframe(i, { t: Number(e.target.value) })}
              />
              <span>s:</span>
              <input
                type="number"
                aria-label={`keyframe ${i} value`}
                value={k.value}
                step={range.step}
                style={{ width: "5ch" }}
                onChange={(e) => updateKeyframe(i, { value: Number(e.target.value) })}
              />
              {track.length > 1 && (
                <button type="button" onClick={() => removeKeyframe(i)}>
                  ×
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addKeyframe}>
            + keyframe
          </button>
        </div>
      )}
    </div>
  );
}
