# Reverse Engineering: Live Presentation Outline

> **This is a sample outline (draft).** It is the plan for the talk, not final content. The deck in `deck/`
> implements part of it; the **Notes for the code** section at the end says what is done and what is still open.
> Text in `[AGENT: ...]` blocks is an instruction for the coding agent, not slide text.

## 1. Introduction

- Basic definitions: what reverse engineering (RE) is and is not
- Real-world use cases: who does RE and why
  - Malware analysis
  - Vulnerability research
  - Software interoperability
  - Legacy code recovery
  - CTF competitions
- **[AGENT: add 3 to 4 short real-world examples with concrete stories, suitable for one slide each]**

## 2. Tools Used in This Presentation

- **Ghidra** (graph view of functions and cross-references)
- **radare2** (command-line analysis, scriptable)
- Many other tools exist (IDA, Binary Ninja, Cutter), but we focus on these two.

> **[AGENT: confirm the tool names in the original notes ("Rea", "Gidra", "Radar2") match Ghidra and radare2, and keep naming consistent in all slides.]**

## 3. Methodology

**General RE workflow:**

```
Recon -> Static Analysis -> Dynamic Analysis -> Analysis (iterate) -> Validation -> Reporting
```

**Simplified version commonly used in security work:**

```
Recon -> Analysis -> Validation -> Report
```

## 4. Example 1: Simple Cryptographic Program

- Walk through each stage of the workflow on a simple crypto binary (XOR plus a fixed shift).
- Explain the logic step by step.
- Show the **control-flow graph (CFG)** as it appears in Ghidra or radare2: basic blocks (hex addresses / assembly)
  connected by jump and branch edges.

> **[AGENT NOTE: The slides already contain a Ghidra-style graph showing relationships between code blocks (by
> address). Generate a matching CFG for this example (e.g., Graphviz/DOT or the radare2 `agf` output) and make sure
> the block addresses in the graph match the actual binary.]**

## 5. Audience Interaction (Q&A)

- Ask the audience questions about what we just analyzed.
- Invite the audience to ask questions.
- **[AGENT: prepare 5 to 6 discussion questions with short answers, e.g., "What operation does this loop perform?",
  "Where is the key stored?"]**

## 6. Example 2: Advanced Code

- Move to a more complex binary (more functions, obfuscation or anti-debugging, stronger crypto).
- Repeat the workflow and compare difficulty with Example 1.

> **[AGENT NOTE: Create a `Makefile` for the demo so each stage can be run live. Suggested targets:**
>
> - `make build`: compile all example binaries
> - `make stage1`: Stage 1 (Recon): `file`, `strings`, `checksec`, etc.
> - `make stage2`: Stage 2 (Static analysis): radare2 commands / Ghidra headless
> - `make stage3`: Stage 3 (Dynamic analysis): gdb or radare2 debugging
> - `make stage4`: Stage 4 (Validation): confirm the findings (e.g., recover the key or password)
> - `make graph`: generate and show the CFG
> - `make clean`
>
> **Each target should print a clear banner with the stage name before running, and all code comments must be in
> English.]**

---

## Notes for the code

Where this outline meets the repository:

| Outline item                  | Status in the repo                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| Example 1 (simple crypto)     | `sample/weakcrypt.c` (repeating-key XOR + 7, hard-coded file names: no CLI arguments); slides "Source 1/2", disassembly, decrypt demo            |
| Example 2 (advanced code)     | `sample/hard/vault.c` (C), `sample/hard-go/` (Go), `sample/hard-rust/` (Rust): stripped, static, hidden key, anti-debug, decoys |
| Tools                         | The deck uses **radare2** and **REA** (an MCP server, with Rizin/objdump). Ghidra is not installed here |
| Stage names on the stepper    | Recon, Strings, Functions, Disassemble, Algorithm, Key (`PHASES` in `deck/js/app.js`)                   |
| Demo `Makefile` stage targets | Not done yet. The current `Makefile` has `dev`, `install`, `sample`, `record`, `lab*`, `hard`, `triage` |
| CFG / `agf` graph slide       | Done: slide "Step 4: the control-flow graph", drawn from `deck/casts/graph.json` (`make record`)        |
| Real-world examples, Q&A set  | Not done yet                                                                                            |

Conventions to keep when changing the code:

- **Slides must match the sources.** The C on the "Source 1/2" slides is an excerpt of `sample/weakcrypt.c`. When
  that file changes, update the two `data-lang="c"` blocks in `deck/index.html` by hand and keep the `data-step`
  numbers in step with the bullets beside them.
- **Addresses depend on the build.** Disassembly addresses on the slides (`0x140001177`, `0x140001130`, ...) and the
  recordings in `deck/casts/` come from one particular `weakcrypt.exe`. After rebuilding the sample, run
  `make record` and re-check the slides that quote addresses.
- **Syntax highlighting is automatic.** Code is colored by `deck/js/highlight.js` (C, x86 asm, r2 output). Mark a
  block with `data-lang="c"` or `data-lang="asm"`; do not add color spans by hand.
- **Animated content must keep its space.** Use `autoAlpha` / `visibility` for reveals, never `display: none`, so the
  layout does not jump (this is why the recording terminals stack their steps in one grid cell).
- **Stepper and footer live in `#chrome`**, a 1920x1080 layer scaled with the slides by `fitChrome()`. Do not make
  them `position: fixed` against the window.
- **Language and layout:** English only, left-to-right. Code comments in English.
- **Formatting:** run `npx prettier --write .` (config in `.prettierrc.json`). `deck/index.html` is ignored because
  the code blocks are whitespace-sensitive.
- **Prompts are tested.** `make test-prompts-dry` checks every file in `prompts/` against the mounted targets and the
  answer keys (`SPECS` in `scripts/test-prompts.mjs`); `make test-prompts` runs them all through Claude Code. When you
  add a prompt or a sample, add its answer key to `SPECS`, mount its files in `docker-compose.yml`, and add it to
  `docker/selftest.sh`.
