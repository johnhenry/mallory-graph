import { Symbolic, type Mesh } from "mallory-ts";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CellGraph } from "../lib/cell-graph.ts";
import { cellIds3D, type CellIds3D } from "../lib/cell-ids.ts";
import { collectFreeVars, defaultSliderRange } from "../lib/free-vars.ts";
import { preprocessImplicitMultiplication } from "../lib/implicit-mult.ts";
import { meshToGeometry, meshToMaterial } from "../lib/mesh-to-geometry.ts";
import { sampleSurface, type SurfaceDomain } from "../lib/sample-surface.ts";
import { useCell } from "../lib/use-cell.ts";

const WIDTH = 600;
const HEIGHT = 600;
const RESOLUTION = 40;
const DOMAIN: SurfaceDomain = { min: -5, max: 5 };

/**
 * Sets up one 3D pane's reactive cells on `graph`, mirroring GraphCanvas's
 * `useExpressionGraph` but for z=f(x,y): source expr -> free-var list (both
 * `x` and `y` are axis variables here, unlike the 2D pane's single `x`) ->
 * per-variable slider cells -> params snapshot -> derived sampled-mesh cell.
 * The mesh cell falls back to the last successfully sampled mesh on a
 * parse/eval error, same reasoning as the 2D path cell.
 */
function useExpressionGraph3D(cellId: string, source: string, externalGraph?: CellGraph): CellGraph {
  const ref = useRef<CellGraph | null>(null);
  if (!ref.current) {
    const graph = externalGraph ?? new CellGraph();
    const ids = cellIds3D(cellId);

    if (!graph.has(ids.expr)) {
      graph.set(ids.expr, source);

      // Kept pure -- no `graph.set()` here. This cell is read via `get()`
      // from inside React's `getSnapshot` during render (through `params`'s
      // own compute), and a write triggered synchronously from there trips
      // React's "Cannot update a component while rendering a different
      // component" guard, which silently drops the resulting update.
      // Newly-discovered free variables get their slider cell seeded by a
      // `useEffect` in Graph3DCanvas instead.
      graph.define(ids.freeVars, () => {
        let names: string[] = [];
        try {
          const expr = Symbolic.parse(preprocessImplicitMultiplication(graph.get<string>(ids.expr)));
          names = collectFreeVars(expr, "x").filter((name) => name !== "y");
        } catch {
          // Leave `names` empty on a mid-typing parse error; sliders just don't update.
        }
        return names;
      });

      graph.define(ids.params, () => {
        const names = graph.get<string[]>(ids.freeVars);
        const params: Record<string, number> = {};
        for (const name of names) params[name] = graph.get<number>(ids.param(name));
        return params;
      });

      let lastGoodMesh: Mesh[] | null = null;
      graph.define(ids.mesh, () => {
        try {
          const params = graph.get<Record<string, number>>(ids.params);
          lastGoodMesh = sampleSurface(graph.get<string>(ids.expr), DOMAIN, DOMAIN, RESOLUTION, params);
        } catch {
          if (!lastGoodMesh) throw new Error(`Initial expression "${source}" failed to parse`);
        }
        return lastGoodMesh;
      });

      // No keyframe-animated params for 3D yet (Phase 11e scope is the
      // surface render + orbit controls, not a 3D timeline UI) -- this pane
      // just holds still if a sibling pane on a shared graph drives TIME_CELL.
      graph.define(ids.timelineDuration, () => 0);
    }

    ref.current = graph;
  }
  return ref.current;
}

export interface Graph3DCanvasProps {
  /** Namespaces this pane's cells on `graph`. */
  cellId?: string;
  /** Initial expression source for this pane, when it isn't already present on `graph`. */
  defaultSource?: string;
  /** Share an existing CellGraph (e.g. a linked 2D+3D view) instead of creating a private one. */
  graph?: CellGraph;
}

export function Graph3DCanvas({ cellId = "pane-3d", defaultSource = "x^2-y^2", graph: externalGraph }: Graph3DCanvasProps = {}) {
  const ids = cellIds3D(cellId);
  const graph = useExpressionGraph3D(cellId, defaultSource, externalGraph);
  const mesh = useCell<Mesh[] | null>(graph, ids.mesh);
  const freeVars = useCell<string[]>(graph, ids.freeVars);
  const exprValue = useCell<string>(graph, ids.expr);
  const [source, setSource] = useState(defaultSource);
  const containerRef = useRef<HTMLDivElement>(null);
  const surfaceGroupRef = useRef<THREE.Group | null>(null);

  // Same reasoning as GraphCanvas: keeps the input box in sync with `ids.expr`
  // regardless of what wrote it (chat, URL hydration, a linked sibling pane).
  useEffect(() => {
    setSource(exprValue);
  }, [exprValue]);

  // Seeds a slider cell for each newly-discovered free variable, deferred
  // to an effect for the same reason as GraphCanvas -- see the comment on
  // `ids.freeVars`'s compute above.
  useEffect(() => {
    for (const name of freeVars) {
      const id = ids.param(name);
      if (!graph.hasValue(id)) graph.set(id, defaultSliderRange(name).default);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, freeVars]);

  // Mount-once: renderer, camera, lights, orbit controls, and the render
  // loop. OrbitControls' damping needs a continuous rAF loop even when the
  // mesh itself isn't changing, so this is a separate effect from the
  // mesh-rebuild one below rather than tearing the whole scene down on every
  // keystroke.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    const camera = new THREE.PerspectiveCamera(50, WIDTH / HEIGHT, 0.1, 1000);
    camera.position.set(8, 8, 8);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(WIDTH, HEIGHT);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(5, 10, 7);
    scene.add(directional);
    scene.add(new THREE.AxesHelper(DOMAIN.max));

    const group = new THREE.Group();
    surfaceGroupRef.current = group;
    scene.add(group);

    let raf = 0;
    function tick() {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      surfaceGroupRef.current = null;
    };
  }, []);

  // Rebuild the surface's geometry/material whenever the sampled mesh
  // changes, disposing the previous frame's GPU resources first.
  useEffect(() => {
    const group = surfaceGroupRef.current;
    if (!group || !mesh) return;
    for (const child of [...group.children]) {
      group.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (Array.isArray(child.material) ? child.material : [child.material]).forEach((m) => m.dispose());
      }
    }
    for (const surfaceMesh of mesh) {
      group.add(new THREE.Mesh(meshToGeometry(surfaceMesh), meshToMaterial(surfaceMesh)));
    }
  }, [mesh]);

  return (
    <div>
      <label>
        z ={" "}
        <input
          value={source}
          onChange={(e) => {
            const value = e.target.value;
            setSource(value);
            graph.set(ids.expr, value);
          }}
          style={{ font: "inherit", width: "20ch" }}
        />
      </label>
      {freeVars.length > 0 && (
        <div style={{ display: "flex", gap: "1rem", margin: "0.5rem 0" }}>
          {freeVars.map((name) => (
            <Slider3DControl key={name} graph={graph} ids={ids} name={name} />
          ))}
        </div>
      )}
      <div ref={containerRef} style={{ width: WIDTH, height: HEIGHT, border: "1px solid #ccc" }} />
      <p style={{ fontSize: "0.85rem", color: "#666" }}>Drag to orbit, scroll to zoom.</p>
    </div>
  );
}

function Slider3DControl({ graph, ids, name }: { graph: CellGraph; ids: CellIds3D; name: string }) {
  const id = ids.param(name);
  const value = useCell<number>(graph, id) ?? defaultSliderRange(name).default;
  const range = defaultSliderRange(name);
  return (
    <label style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem" }}>
      {name} = {value.toFixed(2)}
      <input
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        onChange={(e) => graph.set(id, Number(e.target.value))}
      />
    </label>
  );
}
