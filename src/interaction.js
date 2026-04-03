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

  function isRotateButtonTarget(node) {
    return !!node?.closest?.('[data-rotate-button="true"]');
  }

  function isLineTarget(node) {
    return !!node?.closest?.('[data-face-kind="line"]');
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
    state.hoveredRotateLineId = null;
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
    state.hoveredRotateLineId = null;
    recordHistory(beforeSnapshot);
    renderAll();
  }

  function setMode(mode) {
    state.mode = mode;
    state.buildVertices = [];
    state.selectedFaces = [];
    state.hoveredRotateLineId = null;
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
    state.hoveredRotateLineId = null;
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
    if (evt.button !== undefined && evt.button !== 0) return;

    const pos = boardPoint(evt);
    state.mouse = pos;

    if (state.mode === "select") {
      state.hoveredRotateLineId =
        face.kind === "line" && model.getLineGlue?.(face.id) ? face.id : null;
      beginDrag(face, pos);
      return;
    }

    state.hoveredRotateLineId = null;

    if (state.mode === "addPoint") {
      const beforeSnapshot = createHistorySnapshot();
      model.addPoint(pos.x, pos.y);
      recordHistory(beforeSnapshot);
      renderAll();
      return;
    }

    if (state.mode === "addLine" || state.mode === "addFace") {
      const beforeSnapshot = createHistorySnapshot();
      const point = model.getOrCreatePoint(pos);
      const createdPoint = !snapshotsEqual(beforeSnapshot, createHistorySnapshot());

      if (createdPoint) {
        recordHistory(beforeSnapshot);
      }

      handleBuildPoint(point);
    }
  }

  function handleFaceHoverStart(face, evt) {
    state.hoveredFace = face;

    if (face.kind === "line" && model.getLineGlue?.(face.id)) {
      state.hoveredRotateLineId = face.id;
    } else {
      state.hoveredRotateLineId = null;
    }

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

  function handleFaceHoverEnd(face, evt) {
    const next = evt?.relatedTarget;

    if (face?.kind === "line" && isRotateButtonTarget(next)) {
      tooltipEl.style.display = "none";
      return;
    }

    state.hoveredFace = null;

    if (face?.kind === "line" && state.hoveredRotateLineId === face.id) {
      state.hoveredRotateLineId = null;
    }

    tooltipEl.style.display = "none";
    renderAll();
  }

  function handleRotateHoverStart(lineId, _glueId, _evt) {
    state.hoveredRotateLineId = lineId;
    state.hoveredFace = model.faceRef("line", lineId);
    tooltipEl.style.display = "none";
    renderAll();
  }

  function handleRotateHoverMove(_lineId, _glueId, _evt) {}

  function handleRotateHoverEnd(lineId, _glueId, evt) {
    const next = evt?.relatedTarget;

    if (isLineTarget(next)) {
      state.hoveredRotateLineId = lineId;
      return;
    }

    state.hoveredRotateLineId = null;
    state.hoveredFace = null;
    tooltipEl.style.display = "none";
    renderAll();
  }

  function handleRotatePointerDown(lineId, glueId, evt) {
    evt.stopPropagation();
    evt.preventDefault();

    const beforeSnapshot = createHistorySnapshot();
    const result = model.toggleGlueOrientation?.(glueId);

    if (result) {
      state.hoveredRotateLineId = lineId;
      recordHistory(beforeSnapshot);
      renderAll();
    }
  }

  function handleBoardPointerDown(evt) {
    if (evt.button !== undefined && evt.button !== 0) return;
    if (evt.target !== svg) return;

    const pos = boardPoint(evt);
    state.mouse = pos;
    state.hoveredRotateLineId = null;

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
  }

  function handleGlobalPointerMove(evt) {
    const pos = boardPoint(evt);
    state.mouse = pos;

    tooltipEl.style.left = `${evt.clientX}px`;
    tooltipEl.style.top = `${evt.clientY}px`;

    if (state.drag.active) {
      if (evt.buttons === 0) {
        endDrag();
        return;
      }

      evt.preventDefault();
      moveDrag(pos);
      return;
    }

    if (state.mode === "addLine" || state.mode === "addFace") {
      renderAll();
    }
  }

  function handleGlobalPointerUp() {
    endDrag();
  }

  function bindGlobalEvents() {
    if (globalEventsBound) return;
    globalEventsBound = true;

    svg.addEventListener("pointerdown", handleBoardPointerDown);
    window.addEventListener("pointermove", handleGlobalPointerMove, { passive: false });
    window.addEventListener("pointerup", handleGlobalPointerUp);
    window.addEventListener("pointercancel", handleGlobalPointerUp);
    window.addEventListener("blur", handleGlobalPointerUp);
  }

  function runSelfTests() {
    function assert(condition, name) {
      console.assert(condition, `Self-test failed: ${name}`);
    }

    model.resetState();

    const p1 = model.addPoint(0, 0);
    const p2 = model.addPoint(100, 0);
    const p3 = model.addPoint(0, 100);
    const p4 = model.addPoint(200, 0);
    const p5 = model.addPoint(300, 0);

    const lineA = model.addLine(p1.id, p2.id);
    const lineB = model.addLine(p4.id, p5.id);

    assert(lineA !== null, "addLine creates a line");
    assert(state.lines.length === 2, "line count after two addLine calls");

    const face = model.addFace(p1.id, p2.id, p3.id);
    assert(face !== null, "addFace creates a face");
    assert(state.faces.length === 1, "face count after addFace");
    assert(state.lines.length === 4, "addFace auto-creates missing boundary edges");

    const pointGlueA = model.faceRef("point", p1.id);
    const pointGlueB = model.faceRef("point", p2.id);
    const lineGlueA = model.faceRef("line", lineA.id);
    const lineGlueB = model.faceRef("line", lineB.id);
    const twoFace = model.faceRef("face", 1);

    assert(model.isCompatible(pointGlueA, pointGlueB) === true, "point glue allowed");
    assert(model.isCompatible(pointGlueA, lineGlueA) === false, "mixed-dimension glue blocked");
    assert(
      model.isCompatible(twoFace, model.faceRef("face", 2)) === false,
      "2-face glue blocked"
    );

    state.selectedFaces = [lineGlueA, lineGlueB];
    const glue = model.applyGlue();
    assert(glue?.dim === 1, "line glue gets created");

    const arrowA = model.getLineArrowDirection?.(lineA.id);
    const arrowB = model.getLineArrowDirection?.(lineB.id);
    assert(arrowA?.fromPointId === p1.id, "line A arrow direction");
    assert(arrowB?.fromPointId === p4.id, "line B arrow default direction");

    model.toggleGlueOrientation?.(glue.id);
    const arrowBFlipped = model.getLineArrowDirection?.(lineB.id);
    assert(arrowBFlipped?.fromPointId === p5.id, "line B arrow flips on toggle");

    const dragPointIdsForLine = model.getDragPointIds(model.faceRef("line", lineA.id));
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

    const l1 = model.addLine(p1.id, p2.id);
    model.addFace(p2.id, p3.id, p4.id);

    const l2 = model.addLine(p5.id, p6.id);
    model.addFace(p5.id, p6.id, p7.id);

    state.selectedFaces = [
      model.faceRef("line", l1.id),
      model.faceRef("line", l2.id),
    ];
    model.applyGlue();

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
    handleRotateHoverStart,
    handleRotateHoverMove,
    handleRotateHoverEnd,
    handleRotatePointerDown,
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