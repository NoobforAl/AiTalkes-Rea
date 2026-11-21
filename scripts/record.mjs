// Records REAL runs of radare2 and REA against sample/weakcrypt.exe and writes deck/casts/*.json.
// Usage: node scripts/record.mjs   (needs r2 on PATH, npx, and llvm-objdump for REA)
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sample = join(root, "sample");
const outDir = join(root, "deck", "casts");
mkdirSync(outDir, { recursive: true });

const R2 = [
  "-q",
  "-e",
  "scr.color=0",
  "-e",
  "bin.relocs.apply=true",
  "-e",
  "asm.bytes=false",
  "-e",
  "asm.xrefs=false",
  "-e",
  "asm.cmt.right=false",
];
const sh = process.platform === "win32";

function run(cmd, args, env = {}) {
  const t0 = performance.now();
  const r = spawnSync(cmd, args, {
    cwd: sample,
    encoding: "utf8",
    shell: sh && cmd === "npx",
    env: { ...process.env, ...env },
    maxBuffer: 64 << 20,
  });
  return { out: r.stdout ?? "", ms: Math.round(performance.now() - t0), code: r.status };
}
const lines = (s) =>
  s
    .replace(/\r/g, "")
    .split("\n")
    .filter((l, i, a) => !(i === a.length - 1 && l === ""));

/* ---------- Radare2 (manual) ---------- */
const r2 = (label, phase, script) => {
  const r = run("r2", [...R2, "-c", script, "weakcrypt.exe"]);
  return { label, phase, cmd: `r2 weakcrypt.exe  ›  ${script}`, ms: r.ms, lines: lines(r.out), trimmed: false };
};
const version = run("r2", ["-v"]).out.split("\n")[0].trim();
const manual = {
  tool: version,
  recordedAt: new Date().toISOString(),
  target: "sample/weakcrypt.exe",
  steps: [
    r2("Recon", 1, "iI~arch,bits,os,canary,stripped"),
    r2("Strings", 2, "iz~S3cr3t,secret,encrypted"),
    r2("Functions", 3, "aaa; afl~main,fcn.140001130"),
    r2("Disassemble", 4, "aaa; pdf @ 0x140001130"),
  ],
};
{
  // the full listing is ~38 lines; keep the cipher core for the slide and say so
  const st = manual.steps[3],
    L = st.lines;
  const a = L.findIndex((l) => l.includes("div qword")),
    b = L.findIndex((l) => l.includes("add eax, 7"));
  st.total = L.length;
  st.lines = L.slice(a, b + 1)
    .filter((l) => !l.startsWith("; section") && !l.startsWith("; 0x"))
    .map((l) => l.replace(/^[|\/ `.:,=<>-]+/, ""));
  st.trimmed = true;
}

/* ---------- REA (what the agent calls) ---------- */
const rea = (args, env) => run("npx", ["-y", "rea-agents@latest", ...args], env);
const objdump = { REA_OBJDUMP_COMMAND: "llvm-objdump" };
const reaSteps = [];
{
  const r = rea(["inspect-with-objdump", "./weakcrypt.exe", "disassemble", "--json"], objdump);
  const ev = JSON.parse(r.out);
  const all = lines(ev.normalized_result.stdout);
  const a = all.findIndex((l) => l.startsWith("140001177")),
    b = all.findIndex((l) => l.startsWith("14000118d"));
  reaSteps.push({
    label: "Disassemble",
    phase: 4,
    cmd: "rea inspect-with-objdump ./weakcrypt.exe disassemble",
    ms: r.ms,
    lines: [
      `evidence_id: ${ev.evidence_id.slice(0, 19)}…`,
      `provider:    ${ev.provider.id}`,
      `sha256:      ${ev.subject.digest.sha256.slice(0, 8)}…${ev.subject.digest.sha256.slice(-6)}`,
      `lines:       ${all.length} (showing ${b - a + 1})`,
      ...all.slice(a, b + 1).map((l) => l.replace(/\t+/g, "  ")),
    ],
    trimmed: true,
  });
}
const reaDoc = {
  tool: "rea-agents (npx, latest)",
  provider: "llvm-objdump",
  recordedAt: new Date().toISOString(),
  target: "sample/weakcrypt.exe",
  steps: reaSteps,
};

/* ---------- control-flow graph of weak_encrypt (what `VV` shows in radare2) ---------- */
{
  const fn = 0x140001130;
  const hex = (n) => "0x" + n.toString(16);
  const r2out = (script) => run("r2", [...R2, "-c", script, "weakcrypt.exe"]).out;
  const json = (s) => JSON.parse(s.slice(s.indexOf("[")));
  const blocks = json(r2out(`aaa; afbj @ ${hex(fn)}`)).sort((a, b) => a.addr - b.addr);
  // `pdf` prints variable names ([var_10h]) where `pdbj` prints [rsp + 0x10], so read the instructions from the listing
  const listing = lines(r2out(`aaa; pdf @ ${hex(fn)}`))
    .map((l) => l.match(/(0x[0-9a-f]+)\s{2,}(\S.*)$/))
    .filter(Boolean)
    .map((m) => ({ n: parseInt(m[1], 16), addr: m[1], text: m[2].trim() }));
  const graph = {
    function: "weak_encrypt",
    address: hex(fn),
    recordedAt: new Date().toISOString(),
    blocks: blocks.map((b) => ({
      addr: hex(b.addr),
      jump: b.jump ? hex(b.jump) : null,
      fail: b.fail ? hex(b.fail) : null,
      ins: listing
        .filter((i) => i.n >= b.addr && i.n < b.addr + b.size)
        // the two instructions that implement the cipher get highlighted on the slide
        .map((i) => ({ addr: i.addr, text: i.text, hot: /^(xor eax, ecx|add eax, 7)$/.test(i.text) })),
    })),
  };
  writeFileSync(join(outDir, "graph.json"), JSON.stringify(graph, null, 1));
  console.log("graph", graph.blocks.map((b) => `${b.addr}:${b.ins.length}`).join("  "));
}

writeFileSync(join(outDir, "manual.json"), JSON.stringify(manual, null, 1));
writeFileSync(join(outDir, "agent.json"), JSON.stringify(reaDoc, null, 1));
for (const [n, d] of [
  ["manual", manual],
  ["agent", reaDoc],
]) {
  console.log(n, d.steps.map((s) => `${s.label}:${s.lines.length}L/${s.ms}ms`).join("  "));
}
