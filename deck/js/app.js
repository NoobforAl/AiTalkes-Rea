const Reveal = window.Reveal; // classic build, loaded by a <script> tag (avoids .mjs MIME issues on Windows)
import { gsap } from "../node_modules/gsap/index.js";
import { highlightDOM, hlAsmLine, hlLog, esc } from "./highlight.js";
import { renderGraph } from "./graph.js";

const params = new URLSearchParams(location.search);
const JUMP_END = params.has("end"); // debug: render every animation at its final frame
const STATIC =
  params.has("print-pdf") || params.has("static") || matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- RE progress stepper (the 6 phases of the analysis) ---------- */
const PHASES = ["Recon", "Strings", "Functions", "Disassemble", "Algorithm", "Key"];
const bar = document.getElementById("re-progress");
bar.innerHTML =
  `<div class="track"><div class="fill"></div></div>` +
  PHASES.map((p, i) => `<div class="step"><div class="dot">${i + 1}</div><span>${p}</span></div>`).join("");
const steps = [...bar.querySelectorAll(".step")];
const fill = bar.querySelector(".fill");
let phase = 0;
function setPhase(n, animate = true) {
  phase = n;
  steps.forEach((s, i) => {
    s.classList.toggle("done", i < n - 1);
    s.classList.toggle("now", i === n - 1);
  });
  const pct = n <= 1 ? 0 : Math.min(100, ((n - 1) / (PHASES.length - 1)) * 100);
  const trackW = bar.querySelector(".track").clientWidth;
  gsap.to(fill, { width: (trackW * pct) / 100, duration: animate && !STATIC ? 0.6 : 0, ease: "power2.out" });
}

/* ---------- helpers ---------- */
let tl = null;
const q = (root, sel) => [...root.querySelectorAll(sel)];
function typeInto(t, el, text, { prompt = "", speed = 0.035, at } = {}) {
  const o = { n: 0 };
  t.set(el, { innerHTML: `<span class="p">${prompt}</span><span class="cur"></span>` }, at);
  t.to(o, {
    n: text.length,
    duration: Math.max(0.4, text.length * speed),
    ease: "none",
    onUpdate() {
      el.innerHTML = `<span class="p">${prompt}</span>${text.slice(0, Math.round(o.n))}<span class="cur"></span>`;
    },
    onComplete() {
      el.innerHTML = `<span class="p">${prompt}</span>${text}`;
    },
  });
}
const fillStatic = (el, text, prompt) => {
  if (el) el.innerHTML = `<span class="p">${prompt}</span>${text}`;
};

/* ---------- decrypt demo data (real ciphertext from sample/secret.enc) ---------- */
const CIPHER_HEX = "225d1625635b783d4817225921082766111d5d0e147a4e1222475b4f271a0959471849285d1e5965185927590b1e40";
const KEY = "S3cr3t!";
const cipher = CIPHER_HEX.match(/../g).map((h) => parseInt(h, 16));
const plain = cipher.map((c, i) => String.fromCharCode(((c - 7) & 0xff) ^ KEY.charCodeAt(i % KEY.length)));
const glyph = (ch) => (ch === "\n" ? "↵" : ch === " " ? "␣" : ch);
const bytesEl = document.getElementById("bytes");
bytesEl.innerHTML = cipher
  .map((c, i) => `<div class="b"><span>${c.toString(16).padStart(2, "0")}</span><small>${i}</small></div>`)
  .join("");
const plainEl = document.getElementById("plain");
plainEl.textContent = plain.join("").trim();

/* ---------- recorded sessions (deck/casts/*.json, written by scripts/record.mjs) ---------- */
const casts = {};
const loadCast = (name) => (casts[name] ??= fetch(`casts/${name}.json`).then((r) => r.json()));

/* control-flow graph (deck/casts/graph.json); drawn when its slide is shown, because blocks are measured */
const drawGraph = (s) => loadCast("graph").then((g) => renderGraph(s.querySelector(".cfg-graph"), g));
const showGraph = (s) => drawGraph(s).then((g) => g.hot.forEach((h) => h.classList.add("hl")));
const castNote = (st) =>
  `# ${st.ms} ms${st.trimmed ? " · output trimmed" : ""}${st.cmd.startsWith("rea") ? " · includes npx startup" : ""}`;
function castMeta(s, c) {
  s.querySelector(".cast-title").textContent = c.provider ? `${c.tool} · ${c.provider}` : c.tool;
  s.querySelector(".cast-meta").innerHTML =
    `Output and timings are real (recorded ${c.recordedAt.slice(0, 10)}); typing is replayed.<span class="cast-hint"></span>`;
}

/* Manual stepping: a slide can hold back its later steps until the presenter presses Space / →.
   The current slide sets `advance`; it returns true when it used the key (otherwise Reveal moves to the next slide). */
let advance = null;
const NEXT_KEYS = new Set([" ", "ArrowRight", "ArrowDown", "PageDown", "n", "N"]);
window.addEventListener(
  "keydown",
  (e) => {
    if (!advance || !NEXT_KEYS.has(e.key) || e.ctrlKey || e.metaKey || e.altKey || !advance()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  },
  true,
);
function castBoxes(s, c) {
  const body = s.querySelector(".cast-body");
  body.replaceChildren();
  return c.steps.map((st) => {
    const b = document.createElement("div"),
      cmd = document.createElement("div"),
      out = document.createElement("div");
    out.innerHTML =
      st.lines
        .map((l) => `<span class="o">${(st.label === "Disassemble" ? hlAsmLine(l) : hlLog(l)) || " "}</span>`)
        .join("") + `<span class="o cm">${castNote(st)}</span>`;
    b.append(cmd, out);
    body.append(b);
    return { b, cmd, out };
  });
}

/* ---------- per-slide animations ---------- */
const anims = {
  cover(s) {
    tl.from(q(s, ".badge,h1,.sub"), { y: 40, autoAlpha: 0, duration: 0.7, stagger: 0.18, ease: "power3.out" })
      .from(q(s, ".blob,.blob2"), { scale: 0.6, autoAlpha: 0, duration: 0.9, stagger: 0.15, ease: "power2.out" }, 0)
      .from(q(s, ".deco"), { y: 40, autoAlpha: 0, duration: 0.7, ease: "power3.out" }, 0.5)
      .from(q(s, ".deco .r"), { x: -20, autoAlpha: 0, duration: 0.35, stagger: 0.15 }, 0.8);
  },
  toc(s) {
    tl.from(q(s, "h2"), { y: -20, autoAlpha: 0, duration: 0.4 }).from(q(s, ".toc li"), {
      x: -60,
      autoAlpha: 0,
      duration: 0.45,
      stagger: 0.12,
      ease: "power2.out",
    });
  },
  divider(s) {
    tl.from(q(s, ".big-n"), { scale: 0.5, autoAlpha: 0, duration: 0.6, ease: "back.out(1.6)" })
      .from(q(s, "h2,p"), { x: -60, autoAlpha: 0, duration: 0.6, stagger: 0.15 }, "-=0.2")
      .from(q(s, ".blob"), { scale: 0.7, autoAlpha: 0, duration: 0.9 }, 0);
  },
  stagger(s) {
    tl.from(q(s, "h2"), { y: -20, autoAlpha: 0, duration: 0.4 }).from(
      q(s, ".card,.callout,.term,.flow,.lane"),
      { x: -80, autoAlpha: 0, duration: 0.55, stagger: 0.25, ease: "power2.out" },
      "-=0.1",
    );
  },
  code(s) {
    tl.from(q(s, ".ln"), { x: -30, autoAlpha: 0, duration: 0.35, stagger: 0.12 })
      .from(q(s, ".bullets li"), { x: -50, autoAlpha: 0, duration: 0.5, stagger: 0.3 }, 0.4)
      .fromTo(
        q(s, ".ln.hl"),
        { backgroundColor: "rgba(200,230,201,0)" },
        { backgroundColor: "#C8E6C9", duration: 0.6 },
        "-=0.2",
      );
  },
  "term-recon"(s) {
    const [c1, c2] = [s.querySelector(".cmd1"), s.querySelector(".cmd2")];
    setPhase(1);
    tl.set(q(s, ".out1,.out2,.out3"), { autoAlpha: 0 });
    typeInto(tl, c1, "iI", { prompt: "[0x140001000]> " });
    tl.to(s.querySelector(".out1"), { autoAlpha: 1, duration: 0.4 }).add(() => setPhase(2), "+=0.5");
    typeInto(tl, c2, "izz~S3cr3t,secret,encrypted", { prompt: "[0x140001000]> " });
    tl.to(s.querySelector(".out2"), { autoAlpha: 1, duration: 0.4 })
      .fromTo(
        q(s, ".out2 .k"),
        { backgroundColor: "rgba(200,230,201,0)" },
        { backgroundColor: "#C8E6C9", duration: 0.5 },
      )
      .to(s.querySelector(".out3"), { autoAlpha: 1, y: 0, duration: 0.5 }, "+=0.2");
    tl.set(s.querySelector(".out3"), { y: 20 }, 0);
  },
  flow(s) {
    setPhase(3);
    tl.from(q(s, ".term"), { y: 30, autoAlpha: 0, duration: 0.5 })
      .from(q(s, ".node,.arrow"), { x: -60, autoAlpha: 0, duration: 0.4, stagger: 0.25 })
      .to(q(s, ".node.key"), { scale: 1.06, duration: 0.3, yoyo: true, repeat: 3, ease: "sine.inOut" });
  },
  asm(s) {
    setPhase(4);
    const lines = q(s, ".ln"),
      notes = q(s, ".notes li");
    tl.from(lines, { x: -30, autoAlpha: 0, duration: 0.3, stagger: 0.1 });
    tl.set(notes, { autoAlpha: 0 });
    q(s, "[data-note]").forEach((ln, i) => {
      tl.add(() => ln.classList.add("hl"), "+=0.4")
        .to(notes[i], { autoAlpha: 1, x: 0, duration: 0.4 }, "<")
        .add(() => {
          if (i === 3) setPhase(5);
        }, "<");
    });
  },
  cast(s) {
    const mine = tl;
    loadCast(s.dataset.cast).then((c) => {
      if (tl !== mine) return; // slide changed while loading
      castMeta(s, c);
      const boxes = castBoxes(s, c);
      const hint = s.querySelector(".cast-hint");
      let shown = -1;
      const play = (i) => {
        shown = i;
        const { b, cmd, out } = boxes[i];
        boxes.forEach((x) => x.b.classList.remove("on"));
        b.classList.add("on");
        setPhase(c.steps[i].phase);
        hint.textContent = ` ${i + 1 < boxes.length ? "Press Space for the next step" : "Last step"} (${i + 1} / ${boxes.length}).`;
        tl.kill();
        tl = gsap.timeline();
        tl.set(out.children, { autoAlpha: 0 });
        typeInto(tl, cmd, c.steps[i].cmd, { prompt: "$ ", speed: 0.02 });
        tl.to(out.children, { autoAlpha: 1, duration: 0.05, stagger: 0.07 }, "+=0.15");
      };
      play(0);
      advance = () => {
        if (shown + 1 >= boxes.length) return false; // last step: let Reveal go to the next slide
        play(shown + 1);
        return true;
      };
      if (JUMP_END) {
        play(boxes.length - 1);
        tl.progress(1);
      }
    });
  },
  walk(s) {
    const lines = q(s, ".code .ln"),
      caps = q(s, ".caps li");
    const steps = [...new Set(q(s, ".code [data-step]").map((l) => l.dataset.step))];
    tl.from(q(s, ".code"), { autoAlpha: 0, y: 20, duration: 0.4 }).set(caps, { autoAlpha: 0 });
    steps.forEach((st) => {
      tl.add(() => {
        lines.forEach((l) => l.classList.toggle("hl", l.dataset.step === st));
        caps.forEach((c) => c.classList.toggle("now", c.dataset.step === st));
      }, "+=0.9").to(
        caps.filter((c) => c.dataset.step === st),
        { autoAlpha: 1, x: 0, duration: 0.4 },
        "<",
      );
    });
    tl.add(() => {
      lines.forEach((l) => l.classList.remove("hl"));
      caps.forEach((c) => c.classList.remove("now"));
    }, "+=0.9").from(q(s, ".callout"), { y: 20, autoAlpha: 0, duration: 0.5 });
  },
  map(s) {
    tl.from(q(s, ".maphead"), { autoAlpha: 0, duration: 0.3 })
      .from(q(s, ".maprow"), { x: -60, autoAlpha: 0, duration: 0.45, stagger: 0.6 })
      .from(q(s, ".callout"), { y: 20, autoAlpha: 0, duration: 0.5 }, "+=0.3");
  },
  decrypt(s) {
    setPhase(5);
    const cells = q(s, ".b");
    cells.forEach((c, i) => {
      c.classList.remove("dec");
      c.firstElementChild.textContent = cipher[i].toString(16).padStart(2, "0");
    });
    tl.add(() => {
      plainEl.textContent = "";
    }, 0).from(q(s, "p,.bytes"), { autoAlpha: 0, y: 20, duration: 0.5, stagger: 0.2 });
    const o = { n: 0 };
    tl.to(o, {
      n: cells.length,
      duration: 3.2,
      ease: "none",
      delay: 0.4,
      onUpdate() {
        const k = Math.round(o.n);
        cells.forEach((c, i) => {
          if (i < k && !c.classList.contains("dec")) {
            c.classList.add("dec");
            c.firstElementChild.textContent = glyph(plain[i]);
          }
        });
        plainEl.textContent = plain.slice(0, k).join("").replace(/\n/g, "");
      },
    })
      .add(() => setPhase(6))
      .add(() => setPhase(7), "+=0.6")
      .fromTo(plainEl, { scale: 0.98 }, { scale: 1, duration: 0.4, ease: "back.out(2)" });
  },
  loop(s) {
    tl.from(q(s, ".node,.arrow"), { x: -60, autoAlpha: 0, duration: 0.4, stagger: 0.25 });
    for (let p = 1; p <= 6; p++) tl.add(() => setPhase(p), p === 1 ? "+=0.2" : "+=0.55");
    tl.from(q(s, ".callout"), { y: 20, autoAlpha: 0, duration: 0.5 });
  },
  graph(s) {
    setPhase(4);
    const mine = tl;
    const notes = q(s, ".cfg-notes");
    tl.set(notes, { autoAlpha: 0 });
    drawGraph(s).then((g) => {
      if (tl !== mine) return; // slide changed while loading
      const { nodeMap: n, edges: e, labels: l } = g; // edges: entry->head, false, true, back; labels: false, true, back
      const reveal = (els) => tl.from(els, { autoAlpha: 0, y: 14, duration: 0.45, ease: "power2.out" }, "+=0.3");
      reveal(n.entry);
      reveal(e[0]);
      reveal(n.head);
      reveal([e[1], l[0]]);
      reveal(n.body);
      reveal([e[3], l[2]]);
      reveal([e[2], l[1]]);
      reveal(n.exit);
      tl.to(notes, { autoAlpha: 1, duration: 0.5 }, "+=0.2").add(
        () => g.hot.forEach((h) => h.classList.add("hl")),
        "+=0.3",
      );
      if (JUMP_END) tl.progress(1);
    });
  },
  "term-rea"(s) {
    setPhase(4);
    const c = s.querySelector(".cmd1"),
      out = s.querySelector(".out1");
    tl.set(out, { autoAlpha: 0 });
    typeInto(tl, c, "rea inspect-with-objdump ./weakcrypt.exe disassemble", { prompt: "$ ", speed: 0.03 });
    tl.to(out, { autoAlpha: 1, duration: 0.5 });
  },
  lanes(s) {
    const manual = q(s, '[data-lane="manual"] .chip'),
      agent = q(s, '[data-lane="agent"] .chip');
    const on = (c) => () => c.classList.add("on");
    manual.forEach((c) => c.classList.remove("on"));
    agent.forEach((c) => c.classList.remove("on"));
    tl.from(q(s, "h2"), { y: -20, autoAlpha: 0, duration: 0.4 });
    manual.forEach((c, i) => tl.add(on(c), i === 0 ? "+=0.2" : "+=0.9"));
    agent.forEach((c, i) => tl.add(on(c), i === 0 ? "+=0.3" : i === agent.length - 1 ? "+=0.8" : "+=0.25"));
    tl.from(q(s, ".card"), { y: 30, autoAlpha: 0, duration: 0.5, stagger: 0.25 }, "+=0.3");
  },
};

/* ---------- syntax highlighting (C + asm) ---------- */
q(document, ".code[data-lang]").forEach((el) => highlightDOM(el, el.dataset.lang));
q(document, ".maprow > .ltr").forEach((el) => highlightDOM(el, el.classList.contains("hlc") ? "asm" : "c"));
q(document, ".cover .deco .r").forEach((el) => highlightDOM(el, "asm"));
q(document, "[data-anim=term-recon] .out1, [data-anim=term-recon] .out2, [data-anim=flow] .term .body").forEach((el) =>
  highlightDOM(el, "log"),
);

/* ---------- wiring ---------- */
const deck = new Reveal({
  width: 1920,
  height: 1080,
  margin: 0,
  minScale: 0.1,
  maxScale: 2,
  rtl: false,
  hash: true,
  controls: false,
  progress: true,
  slideNumber: false,
  transition: "fade",
  transitionSpeed: "fast",
  backgroundTransition: "none",
  center: false,
  pdfSeparateFragments: false,
});

function enter(e) {
  const s = e.currentSlide;
  const idx = deck.getSlides().indexOf(s);
  document.querySelector("#footer .num").textContent = `${idx + 1} / ${deck.getTotalSlides()}`;
  if (tl) {
    tl.kill();
    tl = null;
  }
  advance = null; // only the slide being shown may hold back steps
  q(s, ".cur").forEach((c) => c.remove());
  gsap.set(q(s, "*"), { clearProps: "all" });
  q(s, ".cfg-graph").forEach((h) => h.replaceChildren()); // positions were just cleared; it is redrawn below
  const ph = Number(s.dataset.phase || 0);
  bar.classList.toggle("off", !ph);
  if (ph) setPhase(ph, false);
  const fn = anims[s.dataset.anim];
  if (STATIC || !fn) {
    staticState(s);
    if (s.dataset.anim === "graph") showGraph(s);
    return;
  }
  tl = gsap.timeline({ delay: JUMP_END ? 0 : 0.15 });
  fn(s);
  if (JUMP_END) tl.progress(1);
}

function staticState(s) {
  /* make the slide fully readable when animations are off (print / reduced motion) */
  fillStatic(
    s.querySelector(".cmd1"),
    s.dataset.anim === "term-rea" ? "rea inspect-with-objdump ./weakcrypt.exe disassemble" : "iI",
    s.dataset.anim === "term-rea" ? "$ " : "[0x140001000]> ",
  );
  fillStatic(s.querySelector(".cmd2"), "izz~S3cr3t,secret,encrypted", "[0x140001000]> ");
  q(s, "[data-note]").forEach((l) => l.classList.add("hl"));
  if (s.dataset.anim === "decrypt") {
    q(s, ".b").forEach((c, i) => {
      c.classList.add("dec");
      c.firstElementChild.textContent = glyph(plain[i]);
    });
    plainEl.textContent = plain.join("").trim();
  }
}

/* recorded slides: show the last recorded step when animations are off */
q(document, "[data-anim=cast]").forEach((s) =>
  loadCast(s.dataset.cast).then((c) => {
    castMeta(s, c);
    const boxes = castBoxes(s, c),
      i = c.steps.length - 1;
    boxes[i].b.classList.add("on");
    fillStatic(boxes[i].cmd, c.steps[i].cmd, "$ ");
  }),
);
/* make sure static fallbacks are in place before the first animation runs */
q(document, ".slides section").forEach(staticState);
/* keep the stepper/footer layer aligned with the scaled slide canvas */
const chrome = document.getElementById("chrome");
function fitChrome() {
  const s = deck.getScale();
  chrome.style.transform = `translate(${(innerWidth - 1920 * s) / 2}px, ${(innerHeight - 1080 * s) / 2}px) scale(${s})`;
}
deck.on("ready", fitChrome);
deck.on("resize", fitChrome);
deck.on("pdf-ready", () => q(document, "[data-anim=graph]").forEach(showGraph)); // print: every slide is laid out at once
deck.on("ready", enter);
deck.on("slidechanged", enter);
deck.initialize();
window.deck = deck;
