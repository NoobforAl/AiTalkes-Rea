/* Tiny syntax highlighter for the slides: C and x86 assembly (Intel / radare2 and AT&T / objdump).
   Emits <span class="tk-*"> tokens; colors live in css/theme.css. */

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
export const esc = (t) => t.replace(/[&<>]/g, (c) => ESC[c]);
const span = (cls, t) => `<span class="tk-${cls}">${esc(t)}</span>`;

/* rules: [sticky regex, class | (match, text, end, state) => class | null] */
function scan(text, rules, state = {}) {
  let out = "",
    i = 0;
  while (i < text.length) {
    let hit = false;
    for (const [re, cls] of rules) {
      re.lastIndex = i;
      const m = re.exec(text);
      if (!m || !m[0]) continue;
      const c = typeof cls === "function" ? cls(m[0], text, i + m[0].length, state) : cls;
      out += c ? span(c, m[0]) : esc(m[0]);
      i += m[0].length;
      hit = true;
      break;
    }
    if (!hit) out += esc(text[i++]);
  }
  return out;
}

/* ---------- C ---------- */
const C_KW = new Set([
  "if",
  "else",
  "for",
  "while",
  "do",
  "return",
  "break",
  "continue",
  "switch",
  "case",
  "sizeof",
  "static",
  "const",
  "struct",
  "typedef",
  "unsigned",
  "signed",
]);
const C_TYPES = new Set([
  "int",
  "char",
  "void",
  "long",
  "short",
  "size_t",
  "FILE",
  "u8",
  "uint8_t",
  "uint32_t",
  "uint64_t",
]);
const C_RULES = [
  [/\/\/.*/y, "comment"],
  [/#\s*(?:define|include|ifdef|ifndef|if|else|endif)\b/y, "kw"],
  [/"(?:\\.|[^"\\])*"/y, "str"],
  [/'(?:\\.|[^'\\])*'/y, "str"],
  [/\b(?:0x[0-9a-fA-F]+|\d+)\b/y, "num"],
  [
    /[A-Za-z_]\w*/y,
    (w, text, end) => {
      if (C_KW.has(w)) return "kw";
      if (C_TYPES.has(w)) return "type";
      if (/^\s*\(/.test(text.slice(end))) return "fn";
      if (/^[A-Z][A-Z0-9_]+$/.test(w)) return "const";
      return null;
    },
  ],
  [/[-+*/%&|^~!=<>?:]+/y, "op"],
];
export const hlC = (text) => scan(text, C_RULES);

/* ---------- assembly ---------- */
const REG = /^(?:[re]?(?:[abcd]x|si|di|bp|sp|ip)|[abcd][lh]|[sd]il|[sb]pl|r(?:8|9|1[0-5])[dwb]?|xmm\d+)$/i;
const SIZE = new Set(["byte", "word", "dword", "qword", "xmmword", "ptr"]);
const FLOW = /^(?:j\w+|call|ret|retn|leave|loop\w*)$/i;
const ASM_RULES = [
  [/[;#].*/y, "comment"],
  [/\b0x[0-9a-fA-F]{6,}\b/y, "addr"],
  [/\$-?(?:0x[0-9a-fA-F]+|\d+)/y, "num"],
  [/\b(?:0x[0-9a-fA-F]+|\d+)\b/y, "num"],
  [/\b(?:var_|arg_|str\.|fcn\.|sym\.|loc\.)\w*/y, "sym"],
  [
    /%?[A-Za-z_][\w.]*/y,
    (w, _t, _e, st) => {
      if (w[0] === "%") return "reg";
      if (SIZE.has(w.toLowerCase())) return "type";
      if (REG.test(w)) return "reg";
      if (!st.mn) {
        st.mn = true;
        return FLOW.test(w) ? "flow" : "mn";
      }
      return null;
    },
  ],
  [/[-+*]+/y, "op"],
];
export const hlAsm = (text, state = { mn: false }) => scan(text, ASM_RULES, state);

/* One line of disassembly output as printed by radare2 (`0x1400011eb  xor eax, ecx`) or
   objdump (`1400011eb: 31 c8   xorl %ecx, %eax`). Anything else (headers, hashes) stays plain. */
export function hlAsmLine(line) {
  let m;
  if ((m = line.match(/^(\s*)([0-9a-f]{6,}:)(\s+)((?:[0-9a-f]{2} )+)(\s*)(.*)$/i)))
    return esc(m[1]) + span("addr", m[2]) + esc(m[3]) + span("bytes", m[4]) + esc(m[5]) + hlAsm(m[6]);
  if ((m = line.match(/^(\s*)(0x[0-9a-f]{6,})(\s+)(.*)$/i)))
    return esc(m[1]) + span("addr", m[2]) + esc(m[3]) + hlAsm(m[4]);
  if (/^\s*;/.test(line)) return span("comment", line);
  return esc(line);
}

/* ---------- command output (radare2 iI / iz / afl): addresses and numbers only ---------- */
const LOG_RULES = [
  [/\b0x[0-9a-fA-F]{6,}\b/y, "addr"],
  [/\b(?:0x[0-9a-fA-F]+|\d+)\b/y, "num"],
];
export const hlLog = (text) => scan(text, LOG_RULES);

/* Highlight an element's text in place; existing child markup (<b>, <span class="hl">) is kept. */
export function highlightDOM(el, lang) {
  const state = { mn: false };
  const nodes = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.nodeValue.trim()) continue;
    if (lang === "log" && n.parentElement.closest(".k, .p")) continue; // prompts and call-outs keep their own style
    nodes.push(n);
  }
  for (const n of nodes) {
    const tpl = document.createElement("template");
    tpl.innerHTML = lang === "asm" ? hlAsm(n.nodeValue, state) : lang === "log" ? hlLog(n.nodeValue) : hlC(n.nodeValue);
    n.replaceWith(tpl.content);
  }
}
