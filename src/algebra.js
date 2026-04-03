const PANEL_IDS = {
  0: {
    kerBasis: "h0-ker-basis",
    kerGroup: "h0-ker-group",
    imBasis: "h0-im-basis",
    imGroup: "h0-im-group",
    homology: "h0-group",
  },
  1: {
    kerBasis: "h1-ker-basis",
    kerGroup: "h1-ker-group",
    imBasis: "h1-im-basis",
    imGroup: "h1-im-group",
    homology: "h1-group",
  },
  2: {
    kerBasis: "h2-ker-basis",
    kerGroup: "h2-ker-group",
    imBasis: "h2-im-basis",
    imGroup: "h2-im-group",
    homology: "h2-group",
  },
};

const DEFAULT_HTML = {
  kerBasis: "표시 예정",
  kerGroup: "표시 예정",
  imBasis: "표시 예정",
  imGroup: "표시 예정",
  homology: "표시 예정",
};

let lastPanelSignature = "";

function getEl(id) {
  return document.getElementById(id);
}

function setHtml(id, value) {
  const el = getEl(id);
  if (!el) return;
  el.innerHTML = value;
}

function setRow(group, key, value) {
  const id = PANEL_IDS[group]?.[key];
  if (!id) return;
  setHtml(id, value);
}

function setGroup(group, values = {}) {
  setRow(group, "kerBasis", values.kerBasis ?? DEFAULT_HTML.kerBasis);
  setRow(group, "kerGroup", values.kerGroup ?? DEFAULT_HTML.kerGroup);
  setRow(group, "imBasis", values.imBasis ?? DEFAULT_HTML.imBasis);
  setRow(group, "imGroup", values.imGroup ?? DEFAULT_HTML.imGroup);
  setRow(group, "homology", values.homology ?? DEFAULT_HTML.homology);
}

function collectMathElements() {
  return Object.values(PANEL_IDS)
    .flatMap((group) => Object.values(group))
    .map((id) => getEl(id))
    .filter(Boolean);
}

async function typesetAlgebraPanel() {
  if (!window.MathJax?.typesetPromise) return;
  try {
    await window.MathJax.typesetPromise(collectMathElements());
  } catch (err) {
    console.error("MathJax typeset failed:", err);
  }
}

/* ----------------------------- BigInt helpers ----------------------------- */

function bi(x) {
  return BigInt(x);
}

function absBI(x) {
  return x < 0n ? -x : x;
}

function gcdBI(a, b) {
  a = absBI(a);
  b = absBI(b);
  while (b !== 0n) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

function truncDivBI(a, b) {
  if (b === 0n) {
    throw new Error("Division by zero in truncDivBI");
  }
  const q = absBI(a) / absBI(b);
  return a * b >= 0n ? q : -q;
}

/* ------------------------------- Matrices -------------------------------- */

function makeMatrix(rows, cols, fill = 0n) {
  return {
    rows,
    cols,
    data: Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => fill)
    ),
  };
}

function cloneMatrix(M) {
  return {
    rows: M.rows,
    cols: M.cols,
    data: M.data.map((row) => row.slice()),
  };
}

function identityMatrix(n) {
  const M = makeMatrix(n, n, 0n);
  for (let i = 0; i < n; i += 1) {
    M.data[i][i] = 1n;
  }
  return M;
}

function matrixMultiply(A, B) {
  if (A.cols !== B.rows) {
    throw new Error(`Matrix multiply shape mismatch: ${A.rows}x${A.cols} times ${B.rows}x${B.cols}`);
  }

  const C = makeMatrix(A.rows, B.cols, 0n);
  for (let i = 0; i < A.rows; i += 1) {
    for (let k = 0; k < A.cols; k += 1) {
      const aik = A.data[i][k];
      if (aik === 0n) continue;
      for (let j = 0; j < B.cols; j += 1) {
        const bkj = B.data[k][j];
        if (bkj === 0n) continue;
        C.data[i][j] += aik * bkj;
      }
    }
  }
  return C;
}

function swapRows(M, i, j) {
  if (i === j) return;
  [M.data[i], M.data[j]] = [M.data[j], M.data[i]];
}

function swapCols(M, i, j) {
  if (i === j) return;
  for (let r = 0; r < M.rows; r += 1) {
    [M.data[r][i], M.data[r][j]] = [M.data[r][j], M.data[r][i]];
  }
}

function rowAdd(M, target, source, k) {
  if (k === 0n) return;
  for (let c = 0; c < M.cols; c += 1) {
    M.data[target][c] += k * M.data[source][c];
  }
}

function colAdd(M, target, source, k) {
  if (k === 0n) return;
  for (let r = 0; r < M.rows; r += 1) {
    M.data[r][target] += k * M.data[r][source];
  }
}

function rowNeg(M, i) {
  for (let c = 0; c < M.cols; c += 1) {
    M.data[i][c] = -M.data[i][c];
  }
}

function colNeg(M, j) {
  for (let r = 0; r < M.rows; r += 1) {
    M.data[r][j] = -M.data[r][j];
  }
}

function selectTrailingColumns(M, startCol) {
  const cols = Math.max(0, M.cols - startCol);
  const R = makeMatrix(M.rows, cols, 0n);
  for (let i = 0; i < M.rows; i += 1) {
    for (let j = startCol; j < M.cols; j += 1) {
      R.data[i][j - startCol] = M.data[i][j];
    }
  }
  return R;
}

function selectTrailingRows(M, startRow) {
  const rows = Math.max(0, M.rows - startRow);
  const R = makeMatrix(rows, M.cols, 0n);
  for (let i = startRow; i < M.rows; i += 1) {
    for (let j = 0; j < M.cols; j += 1) {
      R.data[i - startRow][j] = M.data[i][j];
    }
  }
  return R;
}

function diagonalEntries(M) {
  const d = [];
  const t = Math.min(M.rows, M.cols);
  for (let i = 0; i < t; i += 1) {
    d.push(M.data[i][i]);
  }
  return d;
}

function nonzeroDiagonalEntries(M) {
  return diagonalEntries(M).filter((x) => x !== 0n);
}

function rankFromDiagonal(M) {
  return nonzeroDiagonalEntries(M).length;
}

function getColumn(M, j) {
  const col = [];
  for (let i = 0; i < M.rows; i += 1) {
    col.push(M.data[i][j]);
  }
  return col;
}

/* --------------------------- Smith normal form --------------------------- */
/*
  Returns U, Uinv, V, Vinv such that U * A * V = D.
  This is intended for the small matrices in this UI.
*/
function smithNormalForm(matrix) {
  const A = cloneMatrix(matrix);
  const U = identityMatrix(A.rows);
  const Uinv = identityMatrix(A.rows);
  const V = identityMatrix(A.cols);
  const Vinv = identityMatrix(A.cols);

  function opSwapRows(i, j) {
    swapRows(A, i, j);
    swapRows(U, i, j);
    swapCols(Uinv, i, j);
  }

  function opSwapCols(i, j) {
    swapCols(A, i, j);
    swapCols(V, i, j);
    swapRows(Vinv, i, j);
  }

  function opRowAdd(target, source, k) {
    rowAdd(A, target, source, k);
    rowAdd(U, target, source, k);
    colAdd(Uinv, source, target, -k);
  }

  function opColAdd(target, source, k) {
    colAdd(A, target, source, k);
    colAdd(V, target, source, k);
    rowAdd(Vinv, source, target, -k);
  }

  function opRowNeg(i) {
    rowNeg(A, i);
    rowNeg(U, i);
    colNeg(Uinv, i);
  }

  let k = 0;
  let l = 0;

  while (k < A.rows && l < A.cols) {
    let pivotPos = null;
    let bestAbs = null;

    for (let i = k; i < A.rows; i += 1) {
      for (let j = l; j < A.cols; j += 1) {
        const value = A.data[i][j];
        if (value === 0n) continue;
        const a = absBI(value);
        if (bestAbs === null || a < bestAbs) {
          bestAbs = a;
          pivotPos = [i, j];
        }
      }
    }

    if (!pivotPos) break;

    if (pivotPos[0] !== k) opSwapRows(pivotPos[0], k);
    if (pivotPos[1] !== l) opSwapCols(pivotPos[1], l);

    while (true) {
      if (A.data[k][l] === 0n) {
        let found = null;
        let localBest = null;

        for (let i = k; i < A.rows; i += 1) {
          for (let j = l; j < A.cols; j += 1) {
            const value = A.data[i][j];
            if (value === 0n) continue;
            const a = absBI(value);
            if (localBest === null || a < localBest) {
              localBest = a;
              found = [i, j];
            }
          }
        }

        if (!found) break;
        if (found[0] !== k) opSwapRows(found[0], k);
        if (found[1] !== l) opSwapCols(found[1], l);
      }

      for (let i = 0; i < A.rows; i += 1) {
        if (i === k) continue;
        while (A.data[i][l] !== 0n) {
          if (absBI(A.data[i][l]) < absBI(A.data[k][l])) {
            opSwapRows(i, k);
          }
          const q = truncDivBI(A.data[i][l], A.data[k][l]);
          opRowAdd(i, k, -q);
          if (A.data[i][l] !== 0n && absBI(A.data[i][l]) < absBI(A.data[k][l])) {
            opSwapRows(i, k);
          }
        }
      }

      for (let j = 0; j < A.cols; j += 1) {
        if (j === l) continue;
        while (A.data[k][j] !== 0n) {
          if (absBI(A.data[k][j]) < absBI(A.data[k][l])) {
            opSwapCols(j, l);
          }
          const q = truncDivBI(A.data[k][j], A.data[k][l]);
          opColAdd(j, l, -q);
          if (A.data[k][j] !== 0n && absBI(A.data[k][j]) < absBI(A.data[k][l])) {
            opSwapCols(j, l);
          }
        }
      }

      let hasNonzeroElsewhere = false;
      for (let i = 0; i < A.rows; i += 1) {
        if (i !== k && A.data[i][l] !== 0n) {
          hasNonzeroElsewhere = true;
          break;
        }
      }
      if (!hasNonzeroElsewhere) {
        for (let j = 0; j < A.cols; j += 1) {
          if (j !== l && A.data[k][j] !== 0n) {
            hasNonzeroElsewhere = true;
            break;
          }
        }
      }
      if (hasNonzeroElsewhere) continue;

      const pivot = A.data[k][l];
      let badPos = null;
      for (let i = k; i < A.rows; i += 1) {
        for (let j = l; j < A.cols; j += 1) {
          if (i === k && j === l) continue;
          if (A.data[i][j] % pivot !== 0n) {
            badPos = [i, j];
            break;
          }
        }
        if (badPos) break;
      }

      if (!badPos) break;

      opRowAdd(k, badPos[0], 1n);
      opColAdd(l, badPos[1], 1n);
    }

    if (k < A.rows && l < A.cols && A.data[k][l] < 0n) {
      opRowNeg(k);
    }

    k += 1;
    l += 1;
  }

  return {
    D: A,
    U,
    Uinv,
    V,
    Vinv,
  };
}

/* ------------------------- Quotient complex builder ------------------------ */

function sortedPairKey(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function buildPointRepresentativeMap(state) {
  const pointIds = state.points.map((p) => p.id);
  const parent = new Map(pointIds.map((id) => [id, id]));

  function find(x) {
    let p = parent.get(x);
    if (p === undefined) {
      parent.set(x, x);
      return x;
    }
    while (p !== parent.get(p)) {
      p = parent.get(p);
    }
    let cur = x;
    while (parent.get(cur) !== p) {
      const next = parent.get(cur);
      parent.set(cur, p);
      cur = next;
    }
    return p;
  }

  function union(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    if (ra < rb) {
      parent.set(rb, ra);
    } else {
      parent.set(ra, rb);
    }
  }

  const lineById = new Map(state.lines.map((line) => [line.id, line]));

  for (const glue of state.glues ?? []) {
    if (glue.dim === 0) {
      if (glue.a?.kind === "point" && glue.b?.kind === "point") {
        union(glue.a.id, glue.b.id);
      }
      continue;
    }

    if (glue.dim === 1) {
      const lineA = lineById.get(glue.a?.id);
      const lineB = lineById.get(glue.b?.id);
      if (!lineA || !lineB) continue;

      if (glue.reversed) {
        union(lineA.a, lineB.b);
        union(lineA.b, lineB.a);
      } else {
        union(lineA.a, lineB.a);
        union(lineA.b, lineB.b);
      }
    }
  }

  const classesByRoot = new Map();
  for (const id of pointIds) {
    const root = find(id);
    if (!classesByRoot.has(root)) {
      classesByRoot.set(root, []);
    }
    classesByRoot.get(root).push(id);
  }

  const repByPoint = new Map();
  const classes = [];

  for (const members of [...classesByRoot.values()]) {
    members.sort((a, b) => a - b);
    const rep = members[0];
    for (const id of members) {
      repByPoint.set(id, rep);
    }
    classes.push({
      rep,
      members,
      label: `\\left[P_{${rep}}\\right]`,
    });
  }

  classes.sort((a, b) => a.rep - b.rep);

  const vertexIndexByRep = new Map();
  classes.forEach((cls, index) => {
    vertexIndexByRep.set(cls.rep, index);
  });

  return {
    repByPoint,
    vertexClasses: classes,
    vertexIndexByRep,
  };
}

function buildEdgeClasses(state) {
  const lineById = new Map(state.lines.map((line) => [line.id, line]));
  const glueByLineId = new Map();

  for (const glue of state.glues ?? []) {
    if (glue.dim !== 1) continue;
    if (glue.a?.kind === "line") glueByLineId.set(glue.a.id, glue);
    if (glue.b?.kind === "line") glueByLineId.set(glue.b.id, glue);
  }

  const edgeClasses = [];
  const edgeClassByLineId = new Map();
  const visited = new Set();

  const sortedLines = [...state.lines].sort((a, b) => a.id - b.id);

  for (const line of sortedLines) {
    if (visited.has(line.id)) continue;

    const glue = glueByLineId.get(line.id);

    if (!glue) {
      const edgeClass = {
        repLineId: line.id,
        memberLineIds: [line.id],
        memberSigns: new Map([[line.id, 1]]),
        label: `\\left[L_{${line.id}}\\right]`,
      };
      edgeClasses.push(edgeClass);
      edgeClassByLineId.set(line.id, edgeClass);
      visited.add(line.id);
      continue;
    }

    const ids = [glue.a.id, glue.b.id].sort((a, b) => a - b);
    const baseSigns = new Map([
      [glue.a.id, 1],
      [glue.b.id, glue.reversed ? -1 : 1],
    ]);

    const repLineId = ids[0];
    const repBaseSign = baseSigns.get(repLineId);

    const memberSigns = new Map();
    for (const id of ids) {
      memberSigns.set(id, baseSigns.get(id) * repBaseSign);
    }

    const edgeClass = {
      repLineId,
      memberLineIds: ids.slice(),
      memberSigns,
      label: `\\left[L_{${repLineId}}\\right]`,
    };

    edgeClasses.push(edgeClass);
    for (const id of ids) {
      edgeClassByLineId.set(id, edgeClass);
      visited.add(id);
    }
  }

  edgeClasses.sort((a, b) => a.repLineId - b.repLineId);
  const edgeIndexByRepLineId = new Map();
  edgeClasses.forEach((edgeClass, index) => {
    edgeIndexByRepLineId.set(edgeClass.repLineId, index);
  });

  return {
    lineById,
    edgeClasses,
    edgeClassByLineId,
    edgeIndexByRepLineId,
  };
}

function buildFaceClasses(state) {
  const faces = [...state.faces].sort((a, b) => a.id - b.id);
  return {
    faceClasses: faces.map((face) => ({
      id: face.id,
      face,
      label: `\\left[F_{${face.id}}\\right]`,
    })),
  };
}

function buildBoundaryData(state) {
  const vertices = buildPointRepresentativeMap(state);
  const edges = buildEdgeClasses(state);
  const faces = buildFaceClasses(state);

  const boundary1 = makeMatrix(
    vertices.vertexClasses.length,
    edges.edgeClasses.length,
    0n
  );

  for (let j = 0; j < edges.edgeClasses.length; j += 1) {
    const edgeClass = edges.edgeClasses[j];
    const repLine = edges.lineById.get(edgeClass.repLineId);
    if (!repLine) continue;

    const sourceRep = vertices.repByPoint.get(repLine.a);
    const targetRep = vertices.repByPoint.get(repLine.b);
    if (sourceRep === undefined || targetRep === undefined) continue;

    const sourceIndex = vertices.vertexIndexByRep.get(sourceRep);
    const targetIndex = vertices.vertexIndexByRep.get(targetRep);
    if (sourceIndex === undefined || targetIndex === undefined) continue;

    boundary1.data[sourceIndex][j] -= 1n;
    boundary1.data[targetIndex][j] += 1n;
  }

  const lineByEndpointKey = new Map();
  for (const line of state.lines) {
    lineByEndpointKey.set(sortedPairKey(line.a, line.b), line);
  }

  const boundary2 = makeMatrix(
    edges.edgeClasses.length,
    faces.faceClasses.length,
    0n
  );

  for (let j = 0; j < faces.faceClasses.length; j += 1) {
    const face = faces.faceClasses[j].face;

    const terms = [
      [face.b, face.c, 1n],
      [face.a, face.c, -1n],
      [face.a, face.b, 1n],
    ];

    for (const [u, v, termSign] of terms) {
      const line = lineByEndpointKey.get(sortedPairKey(u, v));
      if (!line) continue;

      const edgeClass = edges.edgeClassByLineId.get(line.id);
      if (!edgeClass) continue;

      const edgeIndex = edges.edgeClasses.findIndex(
        (item) => item.repLineId === edgeClass.repLineId
      );
      if (edgeIndex < 0) continue;

      let signVsStored = 0n;
      if (line.a === u && line.b === v) {
        signVsStored = 1n;
      } else if (line.a === v && line.b === u) {
        signVsStored = -1n;
      } else {
        continue;
      }

      const memberSign = bi(edgeClass.memberSigns.get(line.id) ?? 1);
      boundary2.data[edgeIndex][j] += termSign * signVsStored * memberSign;
    }
  }

  return {
    basisLabels0: vertices.vertexClasses.map((item) => item.label),
    basisLabels1: edges.edgeClasses.map((item) => item.label),
    basisLabels2: faces.faceClasses.map((item) => item.label),
    boundary1,
    boundary2,
  };
}

/* -------------------------- Homology presentation ------------------------- */

function zeroBoundary(rows) {
  return makeMatrix(rows, 0, 0n);
}

function coeffToTeX(coeff) {
  return coeff.toString();
}

function formatLinearCombination(vector, basisLabels) {
  const terms = [];

  for (let i = 0; i < vector.length; i += 1) {
    const coeff = vector[i];
    if (coeff === 0n) continue;

    const absCoeff = absBI(coeff);
    const label = basisLabels[i];
    const body = absCoeff === 1n ? `${label}` : `${coeffToTeX(absCoeff)}${label}`;

    if (terms.length === 0) {
      terms.push(coeff < 0n ? `-${body}` : body);
    } else {
      terms.push(coeff < 0n ? `- ${body}` : `+ ${body}`);
    }
  }

  return terms.length > 0 ? terms.join(" ") : "0";
}

function formatBasisLinesFromMatrix(basisMatrix, ambientBasisLabels) {
  if (basisMatrix.cols === 0) {
    return `\\(0\\)`;
  }

  const lines = [];
  for (let j = 0; j < basisMatrix.cols; j += 1) {
    const vector = getColumn(basisMatrix, j);
    const expr = formatLinearCombination(vector, ambientBasisLabels);
    lines.push(`<div class="basis-line">\\( e_{${j + 1}} = ${expr} \\)</div>`);
  }
  return lines.join("");
}

function formatImageBasisLines(diagonal) {
  if (diagonal.length === 0) {
    return `\\(0\\)`;
  }

  const lines = diagonal.map((d, i) => {
    const coeff = d === 1n ? "" : `${d.toString()}`;
    return `<div class="basis-line">\\( ${coeff}e_{${i + 1}} \\)</div>`;
  });

  return lines.join("");
}

function formatKerGroup(k) {
  if (k === 0) return `\\(0\\)`;

  const terms = [];
  for (let i = 1; i <= k; i += 1) {
    terms.push(`\\mathbb{Z}e_{${i}}`);
  }
  return `\\(${terms.join(" \\oplus ")}\\)`;
}

function formatImageGroup(diagonal) {
  if (diagonal.length === 0) return `\\(0\\)`;

  const terms = diagonal.map((d, i) => {
    if (d === 1n) return `\\mathbb{Z}e_{${i + 1}}`;
    return `${d.toString()}\\mathbb{Z}e_{${i + 1}}`;
  });

  return `\\(${terms.join(" \\oplus ")}\\)`;
}

function formatHomology(diagonal, kernelRank) {
  const torsionTerms = [];
  for (const d of diagonal) {
    if (d > 1n) {
      torsionTerms.push(`\\mathbb{Z}/${d.toString()}\\mathbb{Z}`);
    }
  }

  const freeRank = kernelRank - diagonal.length;
  const parts = torsionTerms.slice();

  if (freeRank === 1) {
    parts.push(`\\mathbb{Z}`);
  } else if (freeRank > 1) {
    parts.push(`\\mathbb{Z}^{${freeRank}}`);
  }

  if (parts.length === 0) {
    return `\\(0\\)`;
  }

  return `\\(${parts.join(" \\oplus ")}\\)`;
}

function computeHomologyPresentation(boundaryN, boundaryNp1, basisLabelsN) {
  const snfBoundary = smithNormalForm(boundaryN);
  const rankBoundary = rankFromDiagonal(snfBoundary.D);

  const kernelBasisOld = selectTrailingColumns(snfBoundary.V, rankBoundary);
  const kernelRank = kernelBasisOld.cols;

  const coordsInVBasis = matrixMultiply(snfBoundary.Vinv, boundaryNp1);
  const imageInKernelCoordinates = selectTrailingRows(coordsInVBasis, rankBoundary);

  const snfImageInKernel = smithNormalForm(imageInKernelCoordinates);
  const imageRank = rankFromDiagonal(snfImageInKernel.D);
  const diagonal = nonzeroDiagonalEntries(snfImageInKernel.D);

  const kernelBasis = matrixMultiply(kernelBasisOld, snfImageInKernel.Uinv);

  return {
    kerBasis: formatBasisLinesFromMatrix(kernelBasis, basisLabelsN),
    kerGroup: formatKerGroup(kernelRank),
    imBasis: formatImageBasisLines(diagonal),
    imGroup: formatImageGroup(diagonal),
    homology: formatHomology(diagonal, kernelRank),
    imageRank,
    kernelRank,
  };
}

function computeAllHomology(state) {
  const { basisLabels0, basisLabels1, basisLabels2, boundary1, boundary2 } =
    buildBoundaryData(state);

  const boundary0 = makeMatrix(0, basisLabels0.length, 0n);
  const boundary3 = zeroBoundary(basisLabels2.length);

  return {
    0: computeHomologyPresentation(boundary0, boundary1, basisLabels0),
    1: computeHomologyPresentation(boundary1, boundary2, basisLabels1),
    2: computeHomologyPresentation(boundary2, boundary3, basisLabels2),
  };
}

/* ------------------------------- Public API ------------------------------- */

function normalizeValues(values = {}) {
  return {
    0: {
      kerBasis: values[0]?.kerBasis ?? DEFAULT_HTML.kerBasis,
      kerGroup: values[0]?.kerGroup ?? DEFAULT_HTML.kerGroup,
      imBasis: values[0]?.imBasis ?? DEFAULT_HTML.imBasis,
      imGroup: values[0]?.imGroup ?? DEFAULT_HTML.imGroup,
      homology: values[0]?.homology ?? DEFAULT_HTML.homology,
    },
    1: {
      kerBasis: values[1]?.kerBasis ?? DEFAULT_HTML.kerBasis,
      kerGroup: values[1]?.kerGroup ?? DEFAULT_HTML.kerGroup,
      imBasis: values[1]?.imBasis ?? DEFAULT_HTML.imBasis,
      imGroup: values[1]?.imGroup ?? DEFAULT_HTML.imGroup,
      homology: values[1]?.homology ?? DEFAULT_HTML.homology,
    },
    2: {
      kerBasis: values[2]?.kerBasis ?? DEFAULT_HTML.kerBasis,
      kerGroup: values[2]?.kerGroup ?? DEFAULT_HTML.kerGroup,
      imBasis: values[2]?.imBasis ?? DEFAULT_HTML.imBasis,
      imGroup: values[2]?.imGroup ?? DEFAULT_HTML.imGroup,
      homology: values[2]?.homology ?? DEFAULT_HTML.homology,
    },
  };
}

export function resetAlgebraPanel() {
  const values = normalizeValues();
  setGroup(0, values[0]);
  setGroup(1, values[1]);
  setGroup(2, values[2]);
  lastPanelSignature = JSON.stringify(values);
  typesetAlgebraPanel();
}

export function setAlgebraPanel(values = {}) {
  const normalized = normalizeValues(values);
  const signature = JSON.stringify(normalized);

  if (signature === lastPanelSignature) return;

  setGroup(0, normalized[0]);
  setGroup(1, normalized[1]);
  setGroup(2, normalized[2]);

  lastPanelSignature = signature;
  typesetAlgebraPanel();
}

export function updateAlgebraFromState(state) {
  try {
    const values = computeAllHomology(state);
    setAlgebraPanel(values);
  } catch (err) {
    console.error("Algebra panel update failed:", err);
    setAlgebraPanel({
      0: {
        kerBasis: "\\(\\text{계산 오류}\\)",
        kerGroup: "\\(\\text{계산 오류}\\)",
        imBasis: "\\(\\text{계산 오류}\\)",
        imGroup: "\\(\\text{계산 오류}\\)",
        homology: "\\(\\text{계산 오류}\\)",
      },
      1: {
        kerBasis: "\\(\\text{계산 오류}\\)",
        kerGroup: "\\(\\text{계산 오류}\\)",
        imBasis: "\\(\\text{계산 오류}\\)",
        imGroup: "\\(\\text{계산 오류}\\)",
        homology: "\\(\\text{계산 오류}\\)",
      },
      2: {
        kerBasis: "\\(\\text{계산 오류}\\)",
        kerGroup: "\\(\\text{계산 오류}\\)",
        imBasis: "\\(\\text{계산 오류}\\)",
        imGroup: "\\(\\text{계산 오류}\\)",
        homology: "\\(\\text{계산 오류}\\)",
      },
    });
  }
}

export function initializeAlgebraPanel(state) {
  lastPanelSignature = "";
  updateAlgebraFromState(state);
}