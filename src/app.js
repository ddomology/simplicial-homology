import { initializeAlgebraPanel, updateAlgebraFromState } from "./algebra.js";
import { createModel } from "./model.js";
import { createRenderer } from "./render.js";
import { createInteraction } from "./interaction.js";

const dom = {
  svg: document.getElementById("board"),
  tooltipEl: document.getElementById("tooltip"),
  modeChip: document.getElementById("mode-chip"),
  applyGlueButton: document.getElementById("apply-glue"),
  undoButton: document.getElementById("undo-button"),
  redoButton: document.getElementById("redo-button"),
  resetAllButton: document.getElementById("reset-all"),
  modeButtons: {
    select: document.getElementById("mode-select"),
    addPoint: document.getElementById("mode-add-point"),
    addLine: document.getElementById("mode-add-line"),
    addFace: document.getElementById("mode-add-face"),
  },
};

const state = {
  mode: "select",
  points: [],
  lines: [],
  faces: [],
  nextPointId: 1,
  nextLineId: 1,
  nextFaceId: 1,
  hoveredFace: null,
  selectedFaces: [],
  glues: [],
  nextGlueId: 1,
  history: {
  undoStack: [],
  redoStack: [],
  maxSize: 100,
  },
  buildVertices: [],
  mouse: { x: 0, y: 0 },
  snapRadius: 18,
  drag: {
  active: false,
  moved: false,
  face: null,
  startMouse: null,
  pointStarts: [],
  beforeSnapshot: null,
  },
};

const modeChipText = {
  select: "모드: 선택",
  addPoint: "모드: 점 추가",
  addLine: "모드: 선 추가",
  addFace: "모드: 면 추가",
};

const model = createModel(state);

let interaction;

function syncToolbar() {
  for (const [key, button] of Object.entries(dom.modeButtons)) {
    button.classList.toggle("active", state.mode === key);
  }

  dom.modeChip.textContent = modeChipText[state.mode] ?? "모드";
  dom.applyGlueButton.disabled = !interaction.canApplyGlue();
  dom.undoButton.disabled = !interaction.canUndo();
  dom.redoButton.disabled = !interaction.canRedo();
}

const renderer = createRenderer({
  svg: dom.svg,
  tooltipEl: dom.tooltipEl,
  state,
  model,
  getFaceHandlers: () => ({
    onFacePointerDown: interaction.handleFacePointerDown,
    onFaceHoverStart: interaction.handleFaceHoverStart,
    onFaceHoverMove: interaction.handleFaceHoverMove,
    onFaceHoverEnd: interaction.handleFaceHoverEnd,
  }),
});

function renderAll() {
  syncToolbar();
  renderer.render();
  updateAlgebraFromState(state);
  syncToolbar();
}

interaction = createInteraction({
  state,
  svg: dom.svg,
  tooltipEl: dom.tooltipEl,
  model,
  renderAll,
});

function bindToolbarEvents() {
  dom.modeButtons.select.addEventListener("click", () => {
    interaction.setMode("select");
  });

  dom.modeButtons.addPoint.addEventListener("click", () => {
    interaction.setMode("addPoint");
  });

  dom.modeButtons.addLine.addEventListener("click", () => {
    interaction.setMode("addLine");
  });

  dom.modeButtons.addFace.addEventListener("click", () => {
    interaction.setMode("addFace");
  });

  dom.applyGlueButton.addEventListener("click", () => {
    interaction.applyGlue();
  });

  dom.resetAllButton.addEventListener("click", () => {
  interaction.resetAllWithHistory();
  });
  dom.undoButton.addEventListener("click", () => {
    interaction.undoHistory();
  });

  dom.redoButton.addEventListener("click", () => {
    interaction.redoHistory();
  });
}

function initialize() {
  initializeAlgebraPanel(state);
  bindToolbarEvents();
  interaction.bindGlobalEvents();
  interaction.runSelfTests();
  interaction.seedDemo();
  renderAll();
}

initialize();