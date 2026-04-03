export function createModel(state) {
  function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  function area2(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  }

  function sortedPair(a, b) {
    return a < b ? [a, b] : [b, a];
  }

  function sortedTriple(a, b, c) {
    return [a, b, c].sort((m, n) => m - n);
  }

  function nearestPoint(pos) {
    let best = null;
    let bestDist = Infinity;

    for (const p of state.points) {
      const d = distance(pos, p);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }

    if (best && bestDist <= state.snapRadius) {
      return best;
    }
    return null;
  }

  function getPointById(id) {
    return state.points.find((p) => p.id === id) || null;
  }

  function getLineById(id) {
    return state.lines.find((line) => line.id === id) || null;
  }

  function pointLabel(point) {
    return `P${point.id}`;
  }

  function lineLabel(line) {
    return `L${line.id}`;
  }

  function faceLabel(face) {
    return `F${face.id}`;
  }

  function faceRef(kind, id) {
    return {
      kind,
      id,
      dim: kind === "point" ? 0 : kind === "line" ? 1 : 2,
    };
  }

  function faceEquals(a, b) {
    return !!a && !!b && a.kind === b.kind && a.id === b.id;
  }

  function faceName(face) {
    if (face.kind === "point") return `point #${face.id}`;
    if (face.kind === "line") return `line #${face.id}`;
    return `face #${face.id}`;
  }

  function getGlueForFace(face) {
    return (
      state.glues.find((g) => faceEquals(g.a, face) || faceEquals(g.b, face)) ||
      null
    );
  }

  function getGlueById(id) {
    return state.glues.find((glue) => glue.id === id) || null;
  }

  function getLineGlue(lineId) {
    return (
      state.glues.find(
        (glue) =>
          glue.dim === 1 &&
          ((glue.a.kind === "line" && glue.a.id === lineId) ||
            (glue.b.kind === "line" && glue.b.id === lineId))
      ) || null
    );
  }

  function getLineEndpoints(lineId) {
    const line = getLineById(lineId);
    if (!line) return null;
    return [line.a, line.b];
  }

  function isCompatible(a, b) {
    if (!a || !b) return false;
    if (faceEquals(a, b)) return false;
    if (a.dim !== b.dim) return false;
    if (a.dim === 2) return false;
    if (getGlueForFace(a) || getGlueForFace(b)) return false;
    return true;
  }

  function canApplyGlue() {
    return (
      state.selectedFaces.length === 2 &&
      isCompatible(state.selectedFaces[0], state.selectedFaces[1])
    );
  }

  function addPoint(x, y) {
    const point = {
      id: state.nextPointId++,
      x,
      y,
    };
    state.points.push(point);
    return point;
  }

  function getOrCreatePoint(pos) {
    return nearestPoint(pos) || addPoint(pos.x, pos.y);
  }

  function findLineByEndpoints(aId, bId) {
    const [u, v] = sortedPair(aId, bId);

    return (
      state.lines.find((line) => {
        const [x, y] = sortedPair(line.a, line.b);
        return u === x && v === y;
      }) || null
    );
  }

  function addLine(aId, bId) {
    if (aId === bId) return null;
    if (!getPointById(aId) || !getPointById(bId)) return null;

    const existing = findLineByEndpoints(aId, bId);
    if (existing) return existing;

    const line = {
      id: state.nextLineId++,
      a: aId,
      b: bId,
    };
    state.lines.push(line);
    return line;
  }

  function findFaceByVertices(aId, bId, cId) {
    const target = sortedTriple(aId, bId, cId).join("-");

    return (
      state.faces.find(
        (face) =>
          sortedTriple(face.a, face.b, face.c).join("-") === target
      ) || null
    );
  }

  function addFace(aId, bId, cId) {
    const uniq = new Set([aId, bId, cId]);
    if (uniq.size < 3) return null;

    const A = getPointById(aId);
    const B = getPointById(bId);
    const C = getPointById(cId);

    if (!A || !B || !C) return null;
    if (Math.abs(area2(A, B, C)) < 1e-6) return null;

    addLine(aId, bId);
    addLine(bId, cId);
    addLine(cId, aId);

    const existing = findFaceByVertices(aId, bId, cId);
    if (existing) return existing;

    const face = {
      id: state.nextFaceId++,
      a: aId,
      b: bId,
      c: cId,
    };
    state.faces.push(face);
    return face;
  }

  function applyGlue() {
    if (!canApplyGlue()) return null;

    const glue = {
      id: state.nextGlueId++,
      color: `hsl(${((state.glues.length + 1) * 137.508) % 360} 78% 62%)`,
      dim: state.selectedFaces[0].dim,
      a: state.selectedFaces[0],
      b: state.selectedFaces[1],
      reversed: false,
    };

    state.glues.push(glue);
    state.selectedFaces = [];
    return glue;
  }

  function toggleGlueOrientation(glueId) {
    const glue = getGlueById(glueId);
    if (!glue || glue.dim !== 1) return null;

    glue.reversed = !glue.reversed;
    return glue;
  }

  function buildPointGlueGraph() {
    const adjacency = new Map();
    const glueIdsByPoint = new Map();

    function ensurePoint(id) {
      if (!adjacency.has(id)) adjacency.set(id, new Set());
      if (!glueIdsByPoint.has(id)) glueIdsByPoint.set(id, new Set());
    }

    function linkPoints(u, v, glueId) {
      ensurePoint(u);
      ensurePoint(v);
      adjacency.get(u).add(v);
      adjacency.get(v).add(u);
      glueIdsByPoint.get(u).add(glueId);
      glueIdsByPoint.get(v).add(glueId);
    }

    for (const glue of state.glues) {
      if (glue.dim === 0) {
        if (glue.a.kind === "point" && glue.b.kind === "point") {
          linkPoints(glue.a.id, glue.b.id, glue.id);
        }
        continue;
      }

      if (glue.dim === 1) {
        const endpointsA = getLineEndpoints(glue.a.id);
        const endpointsB = getLineEndpoints(glue.b.id);
        if (!endpointsA || !endpointsB) continue;

        const [a0, a1] = endpointsA;
        const [b0, b1] = endpointsB;

        if (glue.reversed) {
          linkPoints(a0, b1, glue.id);
          linkPoints(a1, b0, glue.id);
        } else {
          linkPoints(a0, b0, glue.id);
          linkPoints(a1, b1, glue.id);
        }
      }
    }

    return { adjacency, glueIdsByPoint };
  }

  function getPointGlueComponent(pointId) {
    const { adjacency, glueIdsByPoint } = buildPointGlueGraph();

    if (!adjacency.has(pointId)) {
      return {
        pointIds: new Set([pointId]),
        glueIds: new Set(),
      };
    }

    const visited = new Set();
    const glueIds = new Set();
    const queue = [pointId];
    visited.add(pointId);

    while (queue.length > 0) {
      const current = queue.shift();

      const localGlueIds = glueIdsByPoint.get(current);
      if (localGlueIds) {
        for (const glueId of localGlueIds) {
          glueIds.add(glueId);
        }
      }

      const neighbors = adjacency.get(current);
      if (!neighbors) continue;

      for (const next of neighbors) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }

    return {
      pointIds: visited,
      glueIds,
    };
  }

  function getPointGlueColor(pointId) {
    const component = getPointGlueComponent(pointId);
    if (component.glueIds.size === 0) return null;

    let bestGlue = null;
    for (const glueId of component.glueIds) {
      const glue = getGlueById(glueId);
      if (!glue) continue;
      if (!bestGlue || glue.id < bestGlue.id) {
        bestGlue = glue;
      }
    }

    return bestGlue ? bestGlue.color : null;
  }

  function getLineArrowDirection(lineId) {
    const glue = getLineGlue(lineId);
    const line = getLineById(lineId);

    if (!glue || !line) return null;

    if (glue.a.kind === "line" && glue.a.id === lineId) {
      return {
        fromPointId: line.a,
        toPointId: line.b,
        reversed: false,
        glueId: glue.id,
      };
    }

    if (glue.b.kind === "line" && glue.b.id === lineId) {
      if (glue.reversed) {
        return {
          fromPointId: line.b,
          toPointId: line.a,
          reversed: true,
          glueId: glue.id,
        };
      }

      return {
        fromPointId: line.a,
        toPointId: line.b,
        reversed: false,
        glueId: glue.id,
      };
    }

    return null;
  }

  function getDragPointIds(face) {
    if (face.kind === "point") {
      return [face.id];
    }

    if (face.kind === "line") {
      const line = state.lines.find((item) => item.id === face.id);
      return line ? [line.a, line.b] : [];
    }

    const area = state.faces.find((item) => item.id === face.id);
    return area ? [area.a, area.b, area.c] : [];
  }

  function resetState(clearHistory = true) {
    state.points = [];
    state.lines = [];
    state.faces = [];
    state.hoveredFace = null;
    state.selectedFaces = [];
    state.glues = [];
    state.nextPointId = 1;
    state.nextLineId = 1;
    state.nextFaceId = 1;
    state.nextGlueId = 1;
    state.buildVertices = [];
    state.mouse = { x: 0, y: 0 };
    state.drag = {
      active: false,
      moved: false,
      face: null,
      startMouse: null,
      pointStarts: [],
      beforeSnapshot: null,
    };

    if (clearHistory) {
      state.history.undoStack = [];
      state.history.redoStack = [];
    }
  }

  return {
    state,
    distance,
    area2,
    sortedPair,
    sortedTriple,
    nearestPoint,
    getPointById,
    getLineById,
    getGlueById,
    getLineGlue,
    getLineEndpoints,
    pointLabel,
    lineLabel,
    faceLabel,
    faceRef,
    faceEquals,
    faceName,
    getGlueForFace,
    isCompatible,
    canApplyGlue,
    addPoint,
    getOrCreatePoint,
    findLineByEndpoints,
    addLine,
    findFaceByVertices,
    addFace,
    applyGlue,
    toggleGlueOrientation,
    buildPointGlueGraph,
    getPointGlueComponent,
    getPointGlueColor,
    getLineArrowDirection,
    getDragPointIds,
    resetState,
  };
}