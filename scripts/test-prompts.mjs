// Runs every reverse-engineering prompt in prompts/*.md through Claude Code (headless, with the REA MCP server)
// and grades the answer against the plaintext and the algorithm keywords we know.
//
//   node scripts/test-prompts.mjs                 run every prompt (costs tokens: one agent session per prompt)
//   node scripts/test-prompts.mjs --dry           no agent: check that prompts, targets and answer keys are consistent
//   node scripts/test-prompts.mjs --only easy,hard-go
//   options: --budget <usd per prompt, default 5>   --timeout <minutes per prompt, default 30>
//
// Results: test-results/<prompt>.md (agent answer) and test-results/summary.md. Exit code 1 if any prompt fails.
// The grader reads sample/**/secret.txt on the host; the agent is told not to and is denied Read access to sample/ and solution/.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const promptsDir = join(root, "prompts");
const outDir = join(root, "test-results");

/* ---------- answer keys: what a correct run must contain ---------- */
const SPECS = {
  easy: {
    plain: "sample/secret.txt",
    must: { "repeating-key XOR": /xor/i, "key S3cr3t!": /S3cr3t!/, "+7": /\+\s?7|add\s+7|0x7\b/i },
  },
  hard: { plain: "sample/hard/secret.txt", must: { "FNV-1a": /fnv/i, "xorshift64*": /xorshift/i } },
  "hard-go": { plain: "sample/hard-go/secret.txt", must: { "SHA-256 KDF": /sha-?256/i, Feistel: /feistel/i } },
  "hard-rust": {
    plain: "sample/hard-rust/secret.txt",
    must: { ChaCha: /chacha/i, "modified constants": /murmur|1b873593|0x1b87/i },
  },
};

/* ---------- args ---------- */
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d);
const dry = flag("dry");
const only = opt("only", "")
  ? opt("only")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : null;
const budget = Number(opt("budget", process.env.BUDGET || 5));
const timeoutMin = Number(opt("timeout", process.env.TIMEOUT || 30));

/* ---------- helpers ---------- */
const run = (cmd, args, o = {}) => spawnSync(cmd, args, { cwd: root, encoding: "utf8", maxBuffer: 256 << 20, ...o });
const norm = (s) => s.replace(/\s+/g, " ").trim();
const mounts = () => {
  // "./sample/x:/work/targets/y:ro"  ->  { "/work/targets/y": "sample/x" }
  const m = {};
  for (const l of readFileSync(join(root, "docker-compose.yml"), "utf8").split(/\r?\n/)) {
    const r = l.match(/-\s+\.\/(\S+?):(\/work\/targets\/\S+?):ro/);
    if (r) m[r[2]] = r[1];
  }
  return m;
};
const promptText = (md) => {
  const m = md.match(/```text\r?\n([\s\S]*?)\r?\n```/);
  return m ? m[1] : null;
};

/* ---------- discover ---------- */
const ids = readdirSync(promptsDir)
  .filter((f) => f.endsWith(".md"))
  .map((f) => f.slice(0, -3))
  .filter((id) => !only || only.includes(id))
  .sort();
if (!ids.length) {
  console.error("no prompts selected");
  process.exit(1);
}

/* ---------- checks that need no agent ---------- */
const problems = [];
const warn = [];
const mount = mounts();
const plans = ids.map((id) => {
  const md = readFileSync(join(promptsDir, `${id}.md`), "utf8");
  const text = promptText(md);
  const spec = SPECS[id];
  const paths = text
    ? [...new Set((text.match(/\/work\/targets\/[\w./-]+/g) || []).map((p) => p.replace(/[.,;:]+$/, "")))]
    : [];
  const bad = [];
  if (!text) bad.push("no ```text block with the prompt");
  if (!spec) bad.push("no answer key in SPECS (scripts/test-prompts.mjs)");
  for (const p of paths) {
    if (!mount[p]) bad.push(`${p} is not mounted in docker-compose.yml`);
    else if (!existsSync(join(root, mount[p]))) bad.push(`${mount[p]} does not exist (run make hard-all)`);
  }
  if (spec && !existsSync(join(root, spec.plain))) bad.push(`${spec.plain} (plaintext for grading) is missing`);
  for (const b of bad) problems.push(`${id}: ${b}`);
  return { id, text, spec, paths };
});

const claudeVersion = run("claude", ["--version"]);
if (claudeVersion.error || claudeVersion.status !== 0) warn.push("`claude` CLI not found on PATH");
const image = run("docker", ["image", "inspect", "aitalks-re-lab", "--format", "{{.Id}}"]);
if (image.error || image.status !== 0) warn.push("docker image aitalks-re-lab is missing (run make lab-build)");
if (!existsSync(join(root, ".mcp.json"))) problems.push(".mcp.json is missing (REA MCP server)");

console.log(`prompts: ${ids.join(", ")}`);
for (const w of warn) console.log(`warning: ${w}`);
for (const p of problems) console.log(`problem: ${p}`);

if (dry) {
  for (const p of plans) console.log(`  ${p.id.padEnd(10)} targets: ${p.paths.join(", ") || "-"}`);
  console.log(
    problems.length
      ? `\nDRY RUN FAILED (${problems.length} problem(s))`
      : "\nDRY RUN OK: every prompt has targets, mounts and an answer key",
  );
  process.exit(problems.length ? 1 : 0);
}
if (problems.length || warn.length) {
  console.error("\nfix the problems above first (or use --dry to only check consistency)");
  process.exit(1);
}

/* ---------- run every prompt headless ---------- */
mkdirSync(outDir, { recursive: true });
mkdirSync(join(root, "analysis"), { recursive: true }); // where the prompts ask the agent to save its scripts
const results = [];
for (const p of plans) {
  console.log(`\n=== ${p.id} (budget $${budget}, timeout ${timeoutMin} min) ===`);
  const t0 = Date.now();
  const r = run(
    "claude",
    [
      "-p",
      "--mcp-config",
      ".mcp.json",
      "--strict-mcp-config",
      "--permission-mode",
      "acceptEdits",
      "--allowedTools",
      "mcp__rea",
      "Write",
      "Edit",
      "Bash(python:*)",
      "Bash(python3:*)",
      "Bash(docker compose run --rm -T re:*)",
      "--disallowedTools",
      "Read(./sample/**)",
      "Read(./solution/**)",
      "Read(./prompts/**)",
      "--max-budget-usd",
      String(budget),
      "--output-format",
      "text",
    ],
    { input: p.text, timeout: timeoutMin * 60_000, killSignal: "SIGKILL" },
  );
  const secs = Math.round((Date.now() - t0) / 1000);
  const answer = (r.stdout || "").trim();
  writeFileSync(
    join(outDir, `${p.id}.md`),
    `# ${p.id} (${secs}s, exit ${r.status})\n\n${answer}\n${r.stderr ? `\n---\nstderr:\n${r.stderr}\n` : ""}`,
  );

  const fails = [];
  if (r.error)
    fails.push(
      `could not run claude: ${r.error.code === "ETIMEDOUT" ? `timed out after ${timeoutMin} min` : r.error.message}`,
    );
  else if (r.status !== 0) fails.push(`claude exited with ${r.status}`);
  const plain = norm(readFileSync(join(root, p.spec.plain), "utf8"));
  if (!norm(answer).includes(plain)) fails.push(`plaintext not recovered (expected: "${plain.slice(0, 40)}...")`);
  for (const [what, re] of Object.entries(p.spec.must))
    if (!re.test(answer)) fails.push(`answer does not mention ${what}`);
  results.push({ id: p.id, secs, ok: !fails.length, fails });
  console.log(fails.length ? `FAIL ${p.id}: ${fails.join("; ")}` : `PASS ${p.id} (${secs}s)`);
}

/* ---------- summary ---------- */
const lines = [
  "# Prompt test summary",
  "",
  `Run: ${new Date().toISOString()} | budget $${budget}/prompt`,
  "",
  "| prompt | result | time | notes |",
  "|---|---|---|---|",
];
for (const r of results)
  lines.push(
    `| ${r.id} | ${r.ok ? "PASS" : "FAIL"} | ${r.secs}s | ${r.fails.join("; ") || "plaintext and algorithm recovered"} |`,
  );
writeFileSync(join(outDir, "summary.md"), lines.join("\n") + "\n");
console.log(
  `\n${results.filter((r) => r.ok).length}/${results.length} prompts passed. Details: test-results/summary.md`,
);
process.exit(results.every((r) => r.ok) ? 0 : 1);
