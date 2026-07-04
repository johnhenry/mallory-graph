/**
 * Per-pane cell-id namespacing for GraphCanvas, factored out so both the
 * component (src/components/GraphCanvas.tsx) and the chat-command layer
 * (chat-commands.ts) can address the same cells without collisions when
 * multiple panes share one CellGraph (see LinkedGraphPanes.tsx).
 */

// Deliberately NOT namespaced by cellId: linked panes share one CellGraph,
// and scrubbing/playing one pane's timeline should drive every pane's curve
// off the same clock.
export const TIME_CELL = "time";

export function cellIds(cellId: string) {
  return {
    expr: `expr:${cellId}`,
    freeVars: `freeVars:${cellId}`,
    params: `params:${cellId}`,
    path: `path:${cellId}`,
    pointX: `pointX:${cellId}`,
    point: `point:${cellId}`,
    exact: `exact:${cellId}`,
    structure: `structure:${cellId}`,
    scatter: `scatter:${cellId}`,
    derivative: `derivative:${cellId}`,
    timelineDuration: `timelineDuration:${cellId}`,
    regionMask: `regionMask:${cellId}`,
    areaLower: `areaLower:${cellId}`,
    areaUpper: `areaUpper:${cellId}`,
    area: `area:${cellId}`,
    param: (name: string) => `param:${cellId}:${name}`,
    track: (name: string) => `track:${cellId}:${name}`,
  };
}

export type CellIds = ReturnType<typeof cellIds>;

/**
 * Cell-id namespacing for a 3D surface pane (Graph3DCanvas.tsx) -- a
 * deliberately smaller set than `cellIds`: no `point`/`exact`/`scatter`/
 * `derivative`/`structure`, since dragging a curve point, exact-mode
 * readouts, finite-structure scatter, and the derivative accordion are all
 * single-axis-variable 2D concepts that don't have a 3D analog here yet.
 */
export function cellIds3D(cellId: string) {
  return {
    expr: `expr3d:${cellId}`,
    freeVars: `freeVars3d:${cellId}`,
    params: `params3d:${cellId}`,
    mesh: `mesh3d:${cellId}`,
    timelineDuration: `timelineDuration3d:${cellId}`,
    param: (name: string) => `param3d:${cellId}:${name}`,
    track: (name: string) => `track3d:${cellId}:${name}`,
  };
}

export type CellIds3D = ReturnType<typeof cellIds3D>;

/**
 * Cell-id namespacing for a system-of-equations solver panel
 * (SystemSolverPanel.tsx) -- a different input shape entirely from
 * `cellIds`'s single expression + axis variable (N equation strings + N
 * variable names), so it gets its own small, purpose-specific set rather
 * than reusing/extending `cellIds`.
 */
export function cellIdsSystem(cellId: string) {
  return {
    equations: `sysEquations:${cellId}`,
    variables: `sysVariables:${cellId}`,
    solution: `sysSolution:${cellId}`,
  };
}

export type CellIdsSystem = ReturnType<typeof cellIdsSystem>;

/**
 * Cell-id namespacing for the statistics/probability panel
 * (StatisticsPanel.tsx) -- another different input shape (a raw data-value
 * list plus separate distribution-query parameters), so like
 * `cellIdsSystem` it gets its own small, purpose-specific set.
 */
export function cellIdsStatistics(cellId: string) {
  return {
    data: `statsData:${cellId}`,
    summary: `statsSummary:${cellId}`,
    distType: `statsDistType:${cellId}`,
    distMean: `statsDistMean:${cellId}`,
    distSd: `statsDistSd:${cellId}`,
    distN: `statsDistN:${cellId}`,
    distP: `statsDistP:${cellId}`,
    distLambda: `statsDistLambda:${cellId}`,
    distDf: `statsDistDf:${cellId}`,
    queryLower: `statsQueryLower:${cellId}`,
    queryUpper: `statsQueryUpper:${cellId}`,
    query: `statsQuery:${cellId}`,
  };
}

export type CellIdsStatistics = ReturnType<typeof cellIdsStatistics>;

/**
 * Cell-id namespacing for the ODE solver/slope-field panel (OdePanel.tsx) --
 * a two-variable f(x,y) expression plus an initial condition and a
 * rectangular domain, yet another shape distinct from `cellIds`'s
 * single-axis-variable model, so it gets its own small set like
 * `cellIdsSystem`/`cellIdsStatistics`.
 */
export function cellIdsOde(cellId: string) {
  return {
    expr: `odeExpr:${cellId}`,
    x0: `odeX0:${cellId}`,
    y0: `odeY0:${cellId}`,
    xMin: `odeXMin:${cellId}`,
    xMax: `odeXMax:${cellId}`,
    yMin: `odeYMin:${cellId}`,
    yMax: `odeYMax:${cellId}`,
    solution: `odeSolution:${cellId}`,
    slopeField: `odeSlopeField:${cellId}`,
  };
}

/**
 * Cell-id namespacing for the coupled-ODE-system/phase-portrait panel
 * (OdeSystemPanel.tsx) -- a fixed 2-equation/2-variable system (dx/dt,
 * dy/dt) plus an initial condition, a t-domain, and a phase-plane viewport.
 * Fixed at 2 equations/2 variables for v1, the same scope cut
 * SystemSolverPanel (its algebraic-system counterpart) already made.
 */
export function cellIdsOdeSystem(cellId: string) {
  return {
    exprX: `odeSysExprX:${cellId}`,
    exprY: `odeSysExprY:${cellId}`,
    t0: `odeSysT0:${cellId}`,
    x0: `odeSysX0:${cellId}`,
    y0: `odeSysY0:${cellId}`,
    tMin: `odeSysTMin:${cellId}`,
    tMax: `odeSysTMax:${cellId}`,
    xMin: `odeSysXMin:${cellId}`,
    xMax: `odeSysXMax:${cellId}`,
    yMin: `odeSysYMin:${cellId}`,
    yMax: `odeSysYMax:${cellId}`,
    trajectory: `odeSysTrajectory:${cellId}`,
    vectorField: `odeSysVectorField:${cellId}`,
  };
}

export type CellIdsOdeSystem = ReturnType<typeof cellIdsOdeSystem>;

export type CellIdsOde = ReturnType<typeof cellIdsOde>;

// Deliberately NOT namespaced by cellId, same reasoning as TIME_CELL: every
// expression row on a GraphCanvasMulti shares one coordinate system and one
// ordered row list, rather than each owning an independent viewport the way
// LinkedGraphPanes's side-by-side panes do.
export const VIEWPORT_CELL = "viewport";
export const EXPRESSION_LIST_CELL = "expressionList";

/**
 * Cell-id namespacing for one row on a shared multi-expression canvas
 * (GraphCanvasMulti.tsx/ExpressionRow.tsx) -- deliberately a smaller set
 * than `cellIds`: v1 covers the curve itself, its color/visibility,
 * free-variable sliders, and now an optional f' overlay curve (sharing the
 * row's own color, dashed), but not yet the single-pane `GraphCanvas`'s
 * point-drag/exact-mode/step-by-step-differentiation-trace/area/region-
 * shading/finite-structure features, which stay single-expression-only for
 * now (porting each to a multi-curve-aware form is follow-on work, not this
 * pass).
 */
export function cellIdsMultiRow(cellId: string) {
  return {
    expr: `multiExpr:${cellId}`,
    color: `multiColor:${cellId}`,
    visible: `multiVisible:${cellId}`,
    freeVars: `multiFreeVars:${cellId}`,
    params: `multiParams:${cellId}`,
    /** Strict-variables mode (see Symbolic.assertVariables): when on, any variable besides the axis variable is a hard error rather than an auto-inferred slider. */
    strict: `multiStrict:${cellId}`,
    /** {ok:true,path} | {ok:false,message} -- the single source both `path` (falls back to the last good path) and `error` (surfaces the message) read from. */
    pathResult: `multiPathResult:${cellId}`,
    path: `multiPath:${cellId}`,
    error: `multiError:${cellId}`,
    roots: `multiRoots:${cellId}`,
    /** Every gap (singularity/domain boundary) in the sampled path -- see findDiscontinuities. */
    discontinuities: `multiDiscontinuities:${cellId}`,
    /** Whether the f' overlay curve is toggled on for this row. */
    showDerivative: `multiShowDerivative:${cellId}`,
    /** The sampled f' curve (same color as `path`, drawn dashed), or null while `showDerivative` is off. Falls back to the last good sample on a mid-typing parse error, like `path` does. */
    derivativePath: `multiDerivativePath:${cellId}`,
    param: (name: string) => `multiParam:${cellId}:${name}`,
  };
}

export type CellIdsMultiRow = ReturnType<typeof cellIdsMultiRow>;

/**
 * Cell-id namespacing for the implicit-curve panel (ImplicitPanel.tsx) -- a
 * two-variable relation plus a rectangular domain, yet another shape
 * distinct from `cellIds`'s single-axis-variable model.
 */
export function cellIdsImplicit(cellId: string) {
  return {
    expr: `implicitExpr:${cellId}`,
    xMin: `implicitXMin:${cellId}`,
    xMax: `implicitXMax:${cellId}`,
    yMin: `implicitYMin:${cellId}`,
    yMax: `implicitYMax:${cellId}`,
    segments: `implicitSegments:${cellId}`,
  };
}

export type CellIdsImplicit = ReturnType<typeof cellIdsImplicit>;

/**
 * Cell-id namespacing for the parametric/polar panel (ParametricPanel.tsx):
 * either x(t)/y(t) expressions, or a single r(θ) expression converted to
 * x=r·cosθ, y=r·sinθ internally -- one mode flag, one pair of component
 * expressions (reused for whichever mode is active), a t/θ domain, and a
 * resolution.
 */
export function cellIdsParametric(cellId: string) {
  return {
    mode: `paramMode:${cellId}`,
    exprX: `paramExprX:${cellId}`,
    exprY: `paramExprY:${cellId}`,
    exprR: `paramExprR:${cellId}`,
    tMin: `paramTMin:${cellId}`,
    tMax: `paramTMax:${cellId}`,
    path: `paramPath:${cellId}`,
  };
}

export type CellIdsParametric = ReturnType<typeof cellIdsParametric>;

/**
 * Cell-id namespacing for the regression panel (RegressionPanel.tsx) -- one
 * ordered row list (each row a spreadsheet-style {id, x, y}), a fit-type
 * toggle, and (for the nonlinear fit) a model expression plus a map of
 * per-parameter initial guesses -- distinct from every other panel's shape.
 */
export function cellIdsRegression(cellId: string) {
  return {
    rows: `regressionRows:${cellId}`,
    fitType: `regressionFitType:${cellId}`,
    modelExpr: `regressionModelExpr:${cellId}`,
    paramGuesses: `regressionParamGuesses:${cellId}`,
    fit: `regressionFit:${cellId}`,
  };
}

export type CellIdsRegression = ReturnType<typeof cellIdsRegression>;
