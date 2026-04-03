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

const DEFAULT_TEXT = {
  kerBasis: "계산 전",
  kerGroup: "계산 전",
  imBasis: "계산 전",
  imGroup: "계산 전",
  homology: "계산 전",
};

let lastPanelSignature = "";

function getEl(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const el = getEl(id);
  if (!el) return;
  el.textContent = value;
}

function setRow(group, key, value) {
  const id = PANEL_IDS[group]?.[key];
  if (!id) return;
  setText(id, value);
}

function setGroup(group, values = {}) {
  setRow(group, "kerBasis", values.kerBasis ?? DEFAULT_TEXT.kerBasis);
  setRow(group, "kerGroup", values.kerGroup ?? DEFAULT_TEXT.kerGroup);
  setRow(group, "imBasis", values.imBasis ?? DEFAULT_TEXT.imBasis);
  setRow(group, "imGroup", values.imGroup ?? DEFAULT_TEXT.imGroup);
  setRow(group, "homology", values.homology ?? DEFAULT_TEXT.homology);
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

function normalizeValues(values = {}) {
  return {
    0: {
      kerBasis: values[0]?.kerBasis ?? DEFAULT_TEXT.kerBasis,
      kerGroup: values[0]?.kerGroup ?? DEFAULT_TEXT.kerGroup,
      imBasis: values[0]?.imBasis ?? DEFAULT_TEXT.imBasis,
      imGroup: values[0]?.imGroup ?? DEFAULT_TEXT.imGroup,
      homology: values[0]?.homology ?? DEFAULT_TEXT.homology,
    },
    1: {
      kerBasis: values[1]?.kerBasis ?? DEFAULT_TEXT.kerBasis,
      kerGroup: values[1]?.kerGroup ?? DEFAULT_TEXT.kerGroup,
      imBasis: values[1]?.imBasis ?? DEFAULT_TEXT.imBasis,
      imGroup: values[1]?.imGroup ?? DEFAULT_TEXT.imGroup,
      homology: values[1]?.homology ?? DEFAULT_TEXT.homology,
    },
    2: {
      kerBasis: values[2]?.kerBasis ?? DEFAULT_TEXT.kerBasis,
      kerGroup: values[2]?.kerGroup ?? DEFAULT_TEXT.kerGroup,
      imBasis: values[2]?.imBasis ?? DEFAULT_TEXT.imBasis,
      imGroup: values[2]?.imGroup ?? DEFAULT_TEXT.imGroup,
      homology: values[2]?.homology ?? DEFAULT_TEXT.homology,
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
  const c0 = state?.points?.length ?? 0;
  const c1 = state?.lines?.length ?? 0;
  const c2 = state?.faces?.length ?? 0;

  setAlgebraPanel({
    0: {
      kerBasis: `\\(C_0\\) 후보 ${c0}개`,
      kerGroup: "계산 전",
      imBasis: "계산 전",
      imGroup: "계산 전",
      homology: "계산 전",
    },
    1: {
      kerBasis: `\\(C_1\\) 후보 ${c1}개`,
      kerGroup: "계산 전",
      imBasis: "계산 전",
      imGroup: "계산 전",
      homology: "계산 전",
    },
    2: {
      kerBasis: `\\(C_2\\) 후보 ${c2}개`,
      kerGroup: "계산 전",
      imBasis: "\\(0\\)",
      imGroup: "\\(0\\)",
      homology: "계산 전",
    },
  });
}

export function initializeAlgebraPanel(state) {
  lastPanelSignature = "";
  updateAlgebraFromState(state);
}