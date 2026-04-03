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
  kerBasis: "표시 예정",
  kerGroup: "표시 예정",
  imBasis: "표시 예정",
  imGroup: "표시 예정",
  homology: "표시 예정",
};

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

export function resetAlgebraPanel() {
  setGroup(0);
  setGroup(1);
  setGroup(2);
}

export function setAlgebraPanel(values = {}) {
  setGroup(0, values[0]);
  setGroup(1, values[1]);
  setGroup(2, values[2]);
}

/*
  아직 계산은 안 붙이고, 새 UI 구조에 맞는 placeholder만 채운다.
*/
export function updateAlgebraFromState(state) {
  const c0 = state?.points?.length ?? 0;
  const c1 = state?.lines?.length ?? 0;
  const c2 = state?.faces?.length ?? 0;

  setGroup(0, {
    kerBasis: `계산 전 (C_0 후보 ${c0}개)`,
    kerGroup: "계산 전",
    imBasis: "계산 전",
    imGroup: "계산 전",
    homology: "계산 전",
  });

  setGroup(1, {
    kerBasis: `계산 전 (C_1 후보 ${c1}개)`,
    kerGroup: "계산 전",
    imBasis: "계산 전",
    imGroup: "계산 전",
    homology: "계산 전",
  });

  setGroup(2, {
    kerBasis: `계산 전 (C_2 후보 ${c2}개)`,
    kerGroup: "계산 전",
    imBasis: "0",
    imGroup: "0",
    homology: "계산 전",
  });
}

export function initializeAlgebraPanel(state) {
  resetAlgebraPanel();
  updateAlgebraFromState(state);
}