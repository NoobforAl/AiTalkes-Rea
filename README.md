# Reverse Engineering with AI — Slides

```
DESIGN.md        Design system
PRESENTATION.md  Talk outline (sample/draft) and notes for the code
scripts/         record.mjs  (records real radare2 and REA sessions)
sample/          weakcrypt.c  simple sample (XOR + 7, fixed key, fixed file names)
sample/hard/     vault.c      hard sample, C (stripped, static, encrypted key, anti-debug, decoys, UPX build)
sample/hard-go/  main.go      hard sample, Go (Go runtime, pclntab, goroutines, SHA-256 KDF + Feistel, decoys, anti-debug)
sample/hard-rust/ src/main.rs hard sample, Rust (LTO, compile-time key, modified ChaCha, decoys, anti-debug)
docker/          Dockerfile + zshrc + rules/crypto.yar  (lab: radare2 + plugins, Rizin, capa, YARA, REA, zsh)
docker-compose.yml  re and builder services
.mcp.json        REA setup for Claude Code (runs inside Docker)
prompts/         easy.md, hard.md, hard-go.md, hard-rust.md  (prompts for Claude)
solution/        answers to the hard samples (spoilers; not mounted in the lab)
scripts/         test-prompts.mjs  (runs every prompt through Claude Code and grades the answer)
deck/            the slides (reveal.js + GSAP, left-to-right)
```

## Run

```bash
cd deck
npm install        # first time only
npm start          # http://localhost:8080
```

- `?print-pdf` → PDF export (use the browser's Print; no animations)
- `?static` → no animations
- `?end` → every animation at its final frame (for debugging)
- Arrow keys / `Esc` (overview) / `F` (fullscreen)

## Add a new slide

In `deck/index.html`, add a `<section class="frame" data-anim="stagger" data-phase="3">`.
`data-phase` (1 to 6) highlights that step on the reverse-engineering progress bar; `data-anim` is one of the
keys of `anims` in `deck/js/app.js`. Colors and fonts live in `deck/css/theme.css` (the DESIGN.md tokens).

## Recorded sessions

```bash
make record        # node scripts/record.mjs → deck/casts/manual.json and agent.json
```

The "Recording" slides play these files back: the output and run times are real, and the typing is replayed.
REA used `llvm-objdump` as its provider (Rizin could not be installed on this machine).

## Rebuild the sample

```bash
cd sample
clang -O0 -D_CRT_SECURE_NO_WARNINGS -fms-runtime-lib=dll -o weakcrypt.exe weakcrypt.c
./weakcrypt.exe                                   # no arguments: reads secret.txt, writes secret.enc
r2 -e bin.relocs.apply=true -c 'aaa; pdf @ 0x140001130' weakcrypt.exe
npx rea-agents inspect-with-objdump ./weakcrypt.exe disassemble   # REA_OBJDUMP_COMMAND=llvm-objdump
```

The function address (`0x140001130`) depends on the compiler.

## Docker lab and REA in Claude Code

```bash
make lab-build        # once: build the image (radare2, Rizin 0.9.1, capa, FLOSS, YARA, REA 6.8.0)
make hard             # build the hard C sample: sample/hard/vault, vault.upx, secret.enc
make hard-go          # build the Go sample:   sample/hard-go/vault-go, secret.enc   (golang:1-alpine)
make hard-rust        # build the Rust sample: sample/hard-rust/vault-rs, secret.enc (rust:1-alpine)
make hard-all         # all three
make lab-test         # self-test of the image: tools, r2 plugins, zsh, sandbox, visible targets
make lab              # zsh + oh-my-zsh inside the lab (no network, read-only root, no capabilities)
make triage T=targets/hard/vault
```

- Only compiled binaries and ciphertext under `/work/targets/{easy,hard}` are visible; source, plaintext and the answer are not in the lab.
- File names in `vault.c` are fixed (`secret.txt` → `secret.enc`); the program takes no arguments, so a wrong name is impossible.
- `.mcp.json` runs the REA server inside the container (`docker compose run --rm -T re rea-agents mcp`); Claude Code finds it in the project root and asks for approval. REA reaches `rizin` and `objdump` inside the same image, so paths match.
- Manual user-level registration: `claude mcp add rea -- docker compose --project-directory B:/Projects/AiTalksSlides --progress quiet run --rm -T re rea-agents mcp`
- Prompts: `prompts/easy.md`, `prompts/hard.md`, `prompts/hard-go.md`, `prompts/hard-rust.md`.
- radare2 in the lab is the latest official release (6.2.4) with `r2ghidra` (`pdg`), `r2dec` (`pdd`), `r2frida` and `r2yara`, installed system-wide with `r2pm -gi` (the lab's `$HOME` is an empty tmpfs). `iaito` is a Qt GUI and needs a display, so it is not in the headless lab; install it on the host and open the files from `sample/`. `r2pipe` is available for Python scripting.
- The shell is zsh with oh-my-zsh (config in `docker/zshrc`; bash is still there). Both live under `/opt`, so they work with the read-only root.
- Answers (spoilers): `python solution/hard/solve.py`, `python solution/hard-go/solve.py`, `python solution/hard-rust/solve.py`.

## Testing the prompts

```bash
make test-prompts-dry              # free: every prompt has existing, mounted targets and an answer key
make test-prompts                  # runs EVERY prompt through Claude Code + REA and grades the answers
make test-prompt P=hard-go         # one prompt
make test-prompts ONLY=easy,hard BUDGET=3 TIMEOUT=20
```

Each prompt is sent to `claude -p` with only the REA MCP server (`.mcp.json`), write access for the agent's own scripts,
and no read access to `sample/` or `solution/`. A prompt passes when the answer contains the exact plaintext (read from
`sample/**/secret.txt` by the grader) and names the algorithm (see `SPECS` in `scripts/test-prompts.mjs`). Results go to
`test-results/<prompt>.md` and `test-results/summary.md`. Every prompt is a full agent session, so a complete run costs
tokens (default cap $5 per prompt). Needs the lab image (`make lab-build`) and the built samples (`make hard-all`).

For `analyze/decompile`, REA only knows Ghidra, Hopper, IDA and Kuna; Rizin and objdump are available through
`execute_rizin_command` and `inspect_with_objdump`. Ghidra is not installed in this image.
