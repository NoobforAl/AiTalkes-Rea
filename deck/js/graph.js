/* Control-flow graph in the style of radare2's `VV`: basic blocks (address + asm) joined by jump / fall-through edges.
   Data comes from deck/casts/graph.json (written by scripts/record.mjs from `afbj` + `pdf`).
   The layout is for one loop shape: entry -> loop head -> (body -> back to head | exit). */
import { esc, hlAsm } from "./highlight.js";

const NS = "http://www.w3.org/2000/svg";
const ROLE_TAG = { entry: "entry", head: "loop head", body: "loop body", exit: "exit" };
const GAP_X = 170;
const GAP_Y = 56;

/* find which block plays which part of the loop */
function classify(blocks) {
  const by = new Map(blocks.map((b) => [b.addr, b]));
  const num = (a) => parseInt(a, 16);
  const head = blocks.find(
    (b) => b.jump && b.fail && blocks.some((o) => o.jump === b.addr && num(o.addr) > num(b.addr)),
  );
  if (!head) throw new Error("graph.json: no loop found");
  return {
    entry: blocks[0],
    head,
    body: by.get(head.fail),
    exit: by.get(head.jump),
  };
}

function blockEl(role, b) {
  const el = document.createElement("div");
  el.className = `cfg-node ${role}`;
  el.innerHTML =
    `<div class="cfg-head"><b>${esc(b.addr)}</b><i>${ROLE_TAG[role]}</i></div>` +
    b.ins
      .map(
        (i) =>
          `<div class="cfg-ln${i.hot ? " hot" : ""}"><span class="tk-addr">${esc(i.addr)}</span>  ${hlAsm(i.text)}</div>`,
      )
      .join("");
  return el;
}

function svg(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/* Draws the graph into `host` (must be visible, so the blocks can be measured). Returns the parts to animate. */
export function renderGraph(host, g) {
  host.replaceChildren();
  const roles = classify(g.blocks);
  const nodes = {};
  for (const [role, b] of Object.entries(roles)) {
    nodes[role] = blockEl(role, b);
    host.append(nodes[role]);
  }

  /* measure, then place: entry / head / exit stacked on the left, the loop body to their right */
  const size = Object.fromEntries(
    Object.entries(nodes).map(([r, el]) => [r, { w: el.offsetWidth, h: el.offsetHeight }]),
  );
  const colW = Math.max(size.entry.w, size.head.w, size.exit.w);
  const pos = {
    entry: { x: (colW - size.entry.w) / 2, y: 0 },
    head: { x: (colW - size.head.w) / 2, y: size.entry.h + GAP_Y },
    body: { x: colW + GAP_X, y: 0 },
  };
  pos.exit = { x: (colW - size.exit.w) / 2, y: pos.head.y + size.head.h + GAP_Y };
  for (const [r, p] of Object.entries(pos)) Object.assign(nodes[r].style, { left: `${p.x}px`, top: `${p.y}px` });
  const box = (r) => ({ ...pos[r], ...size[r], r: pos[r].x + size[r].w, b: pos[r].y + size[r].h });
  const [entry, head, body, exit] = ["entry", "head", "body", "exit"].map(box);
  const width = body.r;
  const height = Math.max(body.b, exit.b);
  host.style.width = `${width}px`;
  host.style.height = `${height}px`;

  /* edges */
  const canvas = svg("svg", { class: "cfg-edges", width, height, viewBox: `0 0 ${width} ${height}` });
  const defs = svg("defs");
  for (const kind of ["flow", "true", "false"]) {
    const m = svg("marker", {
      id: `cfg-arrow-${kind}`,
      viewBox: "0 0 10 10",
      refX: 8,
      refY: 5,
      markerWidth: 5,
      markerHeight: 5,
      orient: "auto-start-reverse",
    });
    m.append(svg("path", { d: "M0 0 L10 5 L0 10 z", class: `cfg-tip ${kind}` }));
    defs.append(m);
  }
  canvas.append(defs);

  const edges = [];
  const labels = [];
  const edge = (kind, pts, label) => {
    const p = svg("path", {
      class: `cfg-edge ${kind}`,
      d: "M" + pts.map(([x, y]) => `${x} ${y}`).join(" L"),
      "marker-end": `url(#cfg-arrow-${kind === "back" ? "flow" : kind})`,
    });
    canvas.append(p);
    edges.push(p);
    if (label) {
      const l = document.createElement("div");
      l.className = `cfg-label ${kind}`;
      l.textContent = label.text;
      host.append(l);
      Object.assign(l.style, { left: `${label.x}px`, top: `${label.y}px` });
      labels.push(l);
    }
  };

  const cx = colW / 2;
  const xFalse = colW + 50;
  const xBack = colW + 110;
  const lastLn = nodes.body.lastElementChild;
  const jmpY = body.y + lastLn.offsetTop + lastLn.offsetHeight / 2;

  // entry falls through into the loop head
  edge("flow", [
    [cx, entry.b],
    [cx, head.y],
  ]);
  // jae not taken (i < len): into the loop body
  edge(
    "false",
    [
      [head.r, head.y + 30],
      [xFalse, head.y + 30],
      [xFalse, body.y + 26],
      [body.x, body.y + 26],
    ],
    { text: "i < len", x: xFalse + 10, y: body.y + 62 },
  );
  // jae taken (i >= len): leave the loop
  edge(
    "true",
    [
      [cx, head.b],
      [cx, exit.y],
    ],
    { text: "i ≥ len", x: cx + 14, y: head.b + 12 },
  );
  // jmp at the end of the body: back to the loop head
  edge(
    "back",
    [
      [body.x, jmpY],
      [xBack, jmpY],
      [xBack, head.b - 22],
      [head.r, head.b - 22],
    ],
    { text: "jmp", x: xBack + 10, y: jmpY - 52 },
  );

  host.prepend(canvas);
  return { nodes: Object.values(nodes), nodeMap: nodes, edges, labels, hot: [...host.querySelectorAll(".cfg-ln.hot")] };
}
