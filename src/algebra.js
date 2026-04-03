const PANEL_IDS = {
  0: {
    ker: "ker-0",
    im: "im-1",
    iso: "iso-0",
    basis: "basis-0",
  },
  1: {
    ker: "ker-1",
    im: "im-2",
    iso: "iso-1",
    basis: "basis-1",
  },
  2: {
    ker: "ker-2",
    im: "im-3",
    iso: "iso-2",
    basis: "basis-2",
  },
};

const DEFAULT_TEXT = {
  ker: "표시 예정",
  im: "표시 예정",
  iso: "표시 예정",
  basis: "표시 예정",
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
  setRow(group, "ker", values.ker ?? DEFAULT_TEXT.ker);
  setRow(group, "im", values.im ?? DEFAULT_TEXT.im);
  setRow(group, "iso", values.iso ?? DEFAULT_TEXT.iso);
  setRow(group, "basis", values.basis ?? DEFAULT_TEXT.basis);
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
  지금은 계산 전 단계라서, state를 받아서
  대충 chain group 크기 정도만 보여주는 placeholder 업데이트를 한다.
  나중에 여기 안에 boundary matrix / ker / im / quotient 계산을 붙이면 됨.
*/
export function updateAlgebraFromState(state) {
  const c0 = state?.points?.length ?? 0;
  const c1 = state?.lines?.length ?? 0;
  const c2 = state?.faces?.length ?? 0;

  setGroup(0, {
    ker: `ker ∂_0: 계산 전`,
    im: `im ∂_1: 계산 전`,
    iso: `H_0 ≅ 계산 전`,
    basis: `C_0 basis 후보: ${c0}개 vertex`,
  });

  setGroup(1, {
    ker: `ker ∂_1: 계산 전`,
    im: `im ∂_2: 계산 전`,
    iso: `H_1 ≅ 계산 전`,
    basis: `C_1 basis 후보: ${c1}개 edge`,
  });

  setGroup(2, {
    ker: `ker ∂_2: 계산 전`,
    im: `im ∂_3: 0`,
    iso: `H_2 ≅ 계산 전`,
    basis: `C_2 basis 후보: ${c2}개 face`,
  });
}

export function initializeAlgebraPanel(state) {
  resetAlgebraPanel();
  updateAlgebraFromState(state);
}