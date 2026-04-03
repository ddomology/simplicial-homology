export function createRenderer({ svg, tooltipEl, state, model, getFaceHandlers }) {
  const NS = "http://www.w3.org/2000/svg";

  function createSvg(tag, attrs = {}) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v);
    }
    return el;
  }

function addText(g, x, y, text, attrs = {}) {
  const el = createSvg("text", {
    x,
    y,
    "font-size": 14,
    "font-weight": 700,
    fill: "#d8e2f5",
    "text-anchor": "middle",
    "pointer-events": "none",
    ...attrs,
  });
  el.textContent = text;
  g.appendChild(el);
  return el;
}

  function faceVisualState(face) {
    const hovered = model.faceEquals(state.hoveredFace, face);
    const selected = state.selectedFaces.some((item) => model.faceEquals(item, face));
    const glued = model.getGlueForFace(face);
    const dragging =
      state.drag.active &&
      state.drag.face &&
      model.faceEquals(state.drag.face, face);

    return { hovered, selected, glued, dragging };
  }

  function isBuildVertex(pointId) {
    return state.buildVertices.some((point) => point.id === pointId);
  }

  function attachFaceEvents(el, face) {
    const handlers = getFaceHandlers();
    el.style.cursor = state.mode === "select" ? "grab" : "pointer";

    el.addEventListener("mouseenter", (evt) => {
      handlers.onFaceHoverStart?.(face, evt);
    });

    el.addEventListener("mousemove", (evt) => {
      handlers.onFaceHoverMove?.(face, evt);
    });

    el.addEventListener("mouseleave", (evt) => {
      handlers.onFaceHoverEnd?.(face, evt);
    });

	el.addEventListener('mousedown', evt => {
	  evt.stopPropagation();
	  evt.preventDefault();

	  const pos = boardPoint(evt);
	  state.mouse = pos;

	  if (state.mode === 'select') {
		beginDrag(face, pos);
		return;
	  }

	  if (state.mode === 'addPoint') {
		addPoint(pos.x, pos.y);
		render();
		return;
	  }

	  if (state.mode === 'addLine' || state.mode === 'addFace') {
		const point = getOrCreatePoint(pos);
		handleBuildPoint(point);
	  }
	});
  }

  function drawPoint(g, point) {
    const face = model.faceRef("point", point.id);
    const s = faceVisualState(face);
    const build = isBuildVertex(point.id);

    const color = s.glued
      ? s.glued.color
      : s.selected
        ? "#ffe083"
        : build
          ? "#ffb25d"
          : s.dragging
            ? "#ffb774"
            : s.hovered
              ? "#9ad1ff"
              : "#f4f7fb";

    const halo = s.hovered || s.selected || s.glued || build || s.dragging;

    if (halo) {
      g.appendChild(
        createSvg("circle", {
          cx: point.x,
          cy: point.y,
          r: 15,
          fill: s.glued
            ? s.glued.color
            : s.selected
              ? "#ffe083"
              : build
                ? "#ffb25d"
                : "#5cb4ff",
          opacity: 0.18,
        })
      );
    }

    g.appendChild(
      createSvg("circle", {
        cx: point.x,
        cy: point.y,
        r: 8,
        fill: color,
        stroke: s.glued ? s.glued.color : "#10141c",
        "stroke-width": 2,
      })
    );

    const hit = createSvg("circle", {
      cx: point.x,
      cy: point.y,
      r: 18,
      fill: "transparent",
    });
    attachFaceEvents(hit, face);
    g.appendChild(hit);

    addText(g, point.x, point.y - 16, model.pointLabel(point), {
      "font-size": 11,
      fill: "#aebad3",
    });

    if (s.glued) {
      addText(g, point.x, point.y + 24, `g${s.glued.id}`, {
        fill: s.glued.color,
        "font-size": 11,
      });
    }
  }

  function drawLine(g, line) {
    const A = model.getPointById(line.a);
    const B = model.getPointById(line.b);
    if (!A || !B) return;

    const face = model.faceRef("line", line.id);
    const s = faceVisualState(face);

    const color = s.glued
      ? s.glued.color
      : s.selected
        ? "#ffe083"
        : s.dragging
          ? "#ffb774"
          : s.hovered
            ? "#8bd1ff"
            : "#dbe7ff";

    if (s.hovered || s.selected || s.glued || s.dragging) {
      g.appendChild(
        createSvg("line", {
          x1: A.x,
          y1: A.y,
          x2: B.x,
          y2: B.y,
          stroke: s.glued ? s.glued.color : s.selected ? "#ffe083" : "#58b7ff",
          "stroke-width": 16,
          "stroke-linecap": "round",
          opacity: 0.18,
        })
      );
    }

    g.appendChild(
      createSvg("line", {
        x1: A.x,
        y1: A.y,
        x2: B.x,
        y2: B.y,
        stroke: color,
        "stroke-width": 5,
        "stroke-linecap": "round",
      })
    );

    const hit = createSvg("line", {
      x1: A.x,
      y1: A.y,
      x2: B.x,
      y2: B.y,
      stroke: "transparent",
      "stroke-width": 22,
      "stroke-linecap": "round",
    });
    attachFaceEvents(hit, face);
    g.appendChild(hit);

    addText(g, (A.x + B.x) / 2, (A.y + B.y) / 2 - 10, model.lineLabel(line), {
      "font-size": 11,
      fill: "#aebad3",
    });

    if (s.glued) {
      addText(g, (A.x + B.x) / 2, (A.y + B.y) / 2 + 14, `g${s.glued.id}`, {
        fill: s.glued.color,
        "font-size": 11,
      });
    }
  }

  function drawFace(g, faceObj) {
    const A = model.getPointById(faceObj.a);
    const B = model.getPointById(faceObj.b);
    const C = model.getPointById(faceObj.c);
    if (!A || !B || !C) return;

    const pts = `${A.x},${A.y} ${B.x},${B.y} ${C.x},${C.y}`;
    const face = model.faceRef("face", faceObj.id);
    const s = faceVisualState(face);

    const color = s.dragging ? "#ffcb84" : s.hovered ? "#7fd7df" : "#73c8cf";

    g.appendChild(
      createSvg("polygon", {
        points: pts,
        fill: color,
        opacity: s.dragging ? 0.25 : s.hovered ? 0.22 : 0.14,
        stroke: "rgba(255,255,255,0.14)",
        "stroke-width": s.hovered || s.dragging ? 2.1 : 1.2,
      })
    );

    const hit = createSvg("polygon", {
      points: pts,
      fill: "transparent",
    });
    attachFaceEvents(hit, face);
    g.appendChild(hit);

    const cx = (A.x + B.x + C.x) / 3;
    const cy = (A.y + B.y + C.y) / 3;
    addText(g, cx, cy + 4, model.faceLabel(faceObj), {
      "font-size": 11,
      fill: "#d8e2f5",
    });
  }

  function renderGrid() {
	  const grid = createSvg("g", {
		"pointer-events": "none",
	  });

    for (let x = 0; x <= 1200; x += 60) {
      grid.appendChild(
        createSvg("line", {
          x1: x,
          y1: 0,
          x2: x,
          y2: 900,
          stroke: "rgba(255,255,255,0.05)",
          "stroke-width": 1,
        })
      );
    }

    for (let y = 0; y <= 900; y += 60) {
      grid.appendChild(
        createSvg("line", {
          x1: 0,
          y1: y,
          x2: 1200,
          y2: y,
          stroke: "rgba(255,255,255,0.05)",
          "stroke-width": 1,
        })
      );
    }

    return grid;
  }

  function renderBuildPreview(svgRoot) {
    if (state.mode === "addLine" && state.buildVertices.length === 1) {
      const A = state.buildVertices[0];
      svgRoot.appendChild(
        createSvg("line", {
          x1: A.x,
          y1: A.y,
          x2: state.mouse.x,
          y2: state.mouse.y,
          stroke: "rgba(255,224,131,0.85)",
          "stroke-width": 3,
          "stroke-dasharray": "8 6",
          "stroke-linecap": "round",
        })
      );
    }

    if (state.mode === "addFace" && state.buildVertices.length >= 1) {
      const pts = [
        ...state.buildVertices.map((p) => `${p.x},${p.y}`),
        `${state.mouse.x},${state.mouse.y}`,
      ].join(" ");

      if (state.buildVertices.length === 1) {
        svgRoot.appendChild(
          createSvg("line", {
            x1: state.buildVertices[0].x,
            y1: state.buildVertices[0].y,
            x2: state.mouse.x,
            y2: state.mouse.y,
            stroke: "rgba(127,215,223,0.9)",
            "stroke-width": 3,
            "stroke-dasharray": "8 6",
            "stroke-linecap": "round",
          })
        );
      } else if (state.buildVertices.length === 2) {
        svgRoot.appendChild(
          createSvg("polygon", {
            points: pts,
            fill: "rgba(127,215,223,0.15)",
            stroke: "rgba(127,215,223,0.9)",
            "stroke-width": 2.2,
            "stroke-dasharray": "8 6",
          })
        );
      }
    }
  }

  function render() {
    svg.innerHTML = "";
    svg.appendChild(renderGrid());

    const facesGroup = createSvg("g");
    for (const face of state.faces) {
      drawFace(facesGroup, face);
    }
    svg.appendChild(facesGroup);

    const linesGroup = createSvg("g");
    for (const line of state.lines) {
      drawLine(linesGroup, line);
    }
    svg.appendChild(linesGroup);

    const pointsGroup = createSvg("g");
    for (const point of state.points) {
      drawPoint(pointsGroup, point);
    }
    svg.appendChild(pointsGroup);

    const previewGroup = createSvg("g", {
	  "pointer-events": "none",
	});
    renderBuildPreview(previewGroup);
    svg.appendChild(previewGroup);
  }

  return {
    render,
    createSvg,
    addText,
    renderGrid,
    renderBuildPreview,
  };
}