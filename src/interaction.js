export function createInteraction({ state, svg, tooltipEl, model, renderAll }) {
  let globalEventsBound = false;

  function boardPoint(evt) {
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) {
      return { x: 0, y: 0 };
    }
    const transformed = pt.matrixTransform(ctm.inverse());
    return { x: transformed.x, y: transformed.y };
  }
function createHistorySnapshot() {
  return {
    points: state.points.map((p) => ({ ...p })),
    lines: state.lines.map((l) => ({ ...l })),
    faces: state.faces.map((f) => ({ ...f })),
    glues: state.glues.map((g) => ({
      ...g,
      a: g.a ? { ...g.a } : null,
      b: g.b ? { ...g.b } : null,
    })),
    nextPointId: state.nextPointId,
    nextLineId: state.nextLineId,
    nextFaceId: state.nextFaceId,
    nextGlueId: state.nextGlueId,
  };
}

function applyHistorySnapshot(snapshot) {
  state.points = snapshot.points.map((p) => ({ ...p }));
  state.lines = snapshot.lines.map((l) => ({ ...l }));
  state.faces = snapshot.faces.map((f) => ({ ...f }));
  state.glues = snapshot.glues.map((g) => ({
    ...g,
    a: g.a ? { ...g.a } : null,
    b: g.b ? { ...g.b } : null,
  }));

  state.nextPointId = snapshot.nextPointId;
  state.nextLineId = snapshot.nextLineId;
  state.nextFaceId = snapshot.nextFaceId;
  state.nextGlueId = snapshot.nextGlueId;

  state.hoveredFace = null;
  state.selectedFaces = [];
  state.buildVertices = [];
  state.drag = {
    active: false,
    moved: false,
    face: null,
    startMouse: null,
    pointStarts: [],
    beforeSnapshot: null,
  };

  tooltipEl.style.display = "none";
}

function snapshotsEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function pushUndoSnapshot(snapshot) {
  state.history.undoStack.push(snapshot);
  if (state.history.undoStack.length > state.history.maxSize) {
    state.history.undoStack.shift();
  }
}

function recordHistory(beforeSnapshot) {
  const afterSnapshot = createHistorySnapshot();
  if (snapshotsEqual(beforeSnapshot, afterSnapshot)) {
    return false;
  }
  pushUndoSnapshot(beforeSnapshot);
  state.history.redoStack = [];
  return true;
}

function canUndo() {
  return state.history.undoStack.length > 0;
}

function canRedo() {
  return state.history.redoStack.length > 0;
}

function undoHistory() {
  if (!canUndo()) return;
  const current = createHistorySnapshot();
  const previous = state.history.undoStack.pop();
  state.history.redoStack.push(current);
  applyHistorySnapshot(previous);
  renderAll();
}

function redoHistory() {
  if (!canRedo()) return;
  const current = createHistorySnapshot();
  const next = state.history.redoStack.pop();
  pushUndoSnapshot(current);
  applyHistorySnapshot(next);
  renderAll();
}

function resetAllWithHistory() {
  const beforeSnapshot = createHistorySnapshot();
  model.resetState(false);
  state.mode = "select";
  recordHistory(beforeSnapshot);
  renderAll();
}

  function setMode(mode) {
    state.mode = mode;
    state.buildVertices = [];
    state.selectedFaces = [];
	state.drag = {
	  active: false,
	  moved: false,
	  face: null,
	  startMouse: null,
	  pointStarts: [],
	  beforeSnapshot: null,
	};
    renderAll();
  }

  function canApplyGlue() {
    return model.canApplyGlue();
  }

	function applyGlue() {
	  if (!model.canApplyGlue()) return;
	  const beforeSnapshot = createHistorySnapshot();
	  model.applyGlue();
	  recordHistory(beforeSnapshot);
	  renderAll();
	}

function handleBuildPoint(point) {
  if (state.mode === "select" || state.mode === "addPoint") return;
  if (state.buildVertices.some((p) => p.id === point.id)) return;

  state.buildVertices.push(point);

  let mutated = false;
  const beforeSnapshot = createHistorySnapshot();

  if (state.mode === "addLine" && state.buildVertices.length === 2) {
    mutated = !!model.addLine(state.buildVertices[0].id, state.buildVertices[1].id);
    state.buildVertices = [];
  }

  if (state.mode === "addFace" && state.buildVertices.length === 3) {
    mutated = !!model.addFace(
      state.buildVertices[0].id,
      state.buildVertices[1].id,
      state.buildVertices[2].id
    );
    state.buildVertices = [];
  }

  if (mutated) {
    recordHistory(beforeSnapshot);
  }

  renderAll();
}

  function toggleSelectedFace(face) {
    const index = state.selectedFaces.findIndex((item) =>
      model.faceEquals(item, face)
    );

    if (index >= 0) {
      state.selectedFaces.splice(index, 1);
      renderAll();
      return;
    }

    if (model.getGlueForFace(face)) return;
    if (face.dim === 2) return;

    if (state.selectedFaces.length === 0) {
      state.selectedFaces = [face];
    } else if (state.selectedFaces.length === 1) {
      if (model.isCompatible(state.selectedFaces[0], face)) {
        state.selectedFaces.push(face);
      } else {
        state.selectedFaces = [face];
      }
    } else {
      state.selectedFaces = [face];
    }

    renderAll();
  }

	function beginDrag(face, pos) {
	  const pointIds = [...new Set(model.getDragPointIds(face))];

	  state.drag = {
		active: true,
		moved: false,
		face,
		startMouse: pos,
		pointStarts: pointIds
		  .map((id) => model.getPointById(id))
		  .filter(Boolean)
		  .map((point) => ({
			id: point.id,
			x: point.x,
			y: point.y,
		  })),
		beforeSnapshot: createHistorySnapshot(),
	  };
	}

  function moveDrag(pos) {
    if (!state.drag.active) return;

    const dx = pos.x - state.drag.startMouse.x;
    const dy = pos.y - state.drag.startMouse.y;

    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      state.drag.moved = true;
    }

    for (const start of state.drag.pointStarts) {
      const point = model.getPointById(start.id);
      if (!point) continue;
      point.x = start.x + dx;
      point.y = start.y + dy;
    }

    renderAll();
  }

function endDrag() {
  if (!state.drag.active) return;

  const dragFace = state.drag.face;
  const moved = state.drag.moved;
  const beforeSnapshot = state.drag.beforeSnapshot;

  state.drag = {
    active: false,
    moved: false,
    face: null,
    startMouse: null,
    pointStarts: [],
    beforeSnapshot: null,
  };

  if (!moved && dragFace) {
    toggleSelectedFace(dragFace);
    return;
  }

  if (moved && beforeSnapshot) {
    recordHistory(beforeSnapshot);
  }

  renderAll();
}

function handleFacePointerDown(face, evt) {
  const pos = boardPoint(evt);
  state.mouse = pos;

  if (state.mode === "select") {
    beginDrag(face, pos);
    return;
  }

  if (state.mode === "addPoint") {
    model.addPoint(pos.x, pos.y);
    renderAll();
    return;
  }

  if (state.mode === "addLine" || state.mode === "addFace") {
    const point = model.getOrCreatePoint(pos);
    handleBuildPoint(point);
  }
  console.log("face down", state.mode, face.kind, pos);
}

  function handleFaceHoverStart(face, evt) {
    state.hoveredFace = face;
    tooltipEl.style.display = "block";
    tooltipEl.textContent = `${model.faceName(face)} · dim ${face.dim}`;
    tooltipEl.style.left = `${evt.clientX}px`;
    tooltipEl.style.top = `${evt.clientY}px`;
    renderAll();
  }

  function handleFaceHoverMove(_face, evt) {
    tooltipEl.style.left = `${evt.clientX}px`;
    tooltipEl.style.top = `${evt.clientY}px`;
  }

  function handleFaceHoverEnd() {
    state.hoveredFace = null;
    tooltipEl.style.display = "none";
    renderAll();
  }

  function handleBoardMouseDown(evt) {
    if (evt.target !== svg) return;

    const pos = boardPoint(evt);
    state.mouse = pos;

    if (state.mode === "select") {
      state.selectedFaces = [];
      renderAll();
      return;
    }

	if (state.mode === "addPoint") {
	  const beforeSnapshot = createHistorySnapshot();
	  model.addPoint(pos.x, pos.y);
	  recordHistory(beforeSnapshot);
	  renderAll();
	  return;
	}

	const beforeSnapshot = createHistorySnapshot();
	const point = model.getOrCreatePoint(pos);
	const createdPoint = !snapshotsEqual(beforeSnapshot, createHistorySnapshot());

	if (createdPoint) {
	  recordHistory(beforeSnapshot);
	}

	handleBuildPoint(point);
	console.log("board down", state.mode, evt.target);
  }

  function handleGlobalMouseMove(evt) {
    const pos = boardPoint(evt);
    state.mouse = pos;

    tooltipEl.style.left = `${evt.clientX}px`;
    tooltipEl.style.top = `${evt.clientY}px`;

    if (state.drag.active) {
      moveDrag(pos);
      return;
    }

    if (state.mode === "addLine" || state.mode === "addFace") {
      renderAll();
    }
  }

  function handleGlobalMouseUp() {
    endDrag();
  }

  function bindGlobalEvents() {
    if (globalEventsBound) return;
    globalEventsBound = true;

    svg.addEventListener("mousedown", handleBoardMouseDown);
    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
  }

  function runSelfTests() {
    function assert(condition, name) {
      console.assert(condition, `Self-test failed: ${name}`);
    }

    model.resetState();

    const p1 = model.addPoint(0, 0);
    const p2 = model.addPoint(100, 0);
    const p3 = model.addPoint(0, 100);

    const line = model.addLine(p1.id, p2.id);
    assert(line !== null, "addLine creates a line");
    assert(state.lines.length === 1, "line count after addLine");

    const face = model.addFace(p1.id, p2.id, p3.id);
    assert(face !== null, "addFace creates a face");
    assert(state.faces.length === 1, "face count after addFace");
    assert(state.lines.length === 3, "addFace auto-creates missing boundary edges");

    const pointGlueA = model.faceRef("point", 1);
    const pointGlueB = model.faceRef("point", 2);
    const lineGlue = model.faceRef("line", 1);
    const twoFace = model.faceRef("face", 1);

    assert(model.isCompatible(pointGlueA, pointGlueB) === true, "point glue allowed");
    assert(model.isCompatible(pointGlueA, lineGlue) === false, "mixed-dimension glue blocked");
    assert(
      model.isCompatible(twoFace, model.faceRef("face", 2)) === false,
      "2-face glue blocked"
    );

    const dragPointIdsForLine = model.getDragPointIds(model.faceRef("line", line.id));
    const dragPointIdsForFace = model.getDragPointIds(model.faceRef("face", face.id));

    assert(dragPointIdsForLine.length === 2, "line drag uses two endpoints");
    assert(dragPointIdsForFace.length === 3, "face drag uses three vertices");

    model.resetState();
  }

  function seedDemo() {
    const p1 = model.addPoint(220, 180);
    const p2 = model.addPoint(390, 160);
    const p3 = model.addPoint(520, 300);
    const p4 = model.addPoint(330, 430);
    const p5 = model.addPoint(710, 210);
    const p6 = model.addPoint(840, 360);
    const p7 = model.addPoint(650, 520);

    model.addLine(p1.id, p2.id);
    model.addFace(p2.id, p3.id, p4.id);
    model.addLine(p5.id, p6.id);
    model.addFace(p5.id, p6.id, p7.id);

    setMode("select");
  }

  return {
    setMode,
    canApplyGlue,
    applyGlue,

    handleFacePointerDown,
    handleFaceHoverStart,
    handleFaceHoverMove,
    handleFaceHoverEnd,

    bindGlobalEvents,
    runSelfTests,
    seedDemo,
	canUndo,
	canRedo,
	undoHistory,
	redoHistory,
	resetAllWithHistory,
  };
}