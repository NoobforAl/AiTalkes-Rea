# Prompt: Hard target, Go (`vault-go`, stripped + static Go runtime)

Paste into Claude Code from the repo root. Needs the REA MCP server from `.mcp.json` and the lab image (`make lab-build`).
Detection tools also run directly in the lab: `docker compose run --rm -T re <command>`.

```text
You are a reverse engineer. The target is a Go program; Go binaries are hard in their own way. Use REA (MCP) and the lab tools.

TARGET
  /work/targets/go/vault-go       stripped, statically linked Go ELF x86-64 (no symbols, no DWARF, -trimpath)
  /work/targets/go/secret.enc     ciphertext produced by vault-go (format: "GOV1" | u32 length | data)

RULES
  - Binary only. Do NOT open any .go, .txt or solution/ file on the host, and do NOT run the target.
  - Do NOT start debug sessions. The lab has no ptrace, and the program may behave differently when it detects a debugger.
  - Every claim needs evidence (REA evidence_id or exact command output). Mark guesses as "hypothesis".
  - Tool verdicts are hints, not facts. If a tool and the disassembly disagree, the disassembly wins; say so.
  - FLOSS and capa can be very slow on a Go runtime; give each a strict timeout and say what you skipped.

PHASE 1 - TRIAGE (one line of conclusion for each)
  a. file / readelf / strings -> format, linking, stripped? Why is `strings` output one huge blob in Go binaries?
  b. yara -s /opt/rules/crypto.yar <file> and capa -q <file> -> what do they report? Verify EACH hit in the disassembly.
  c. How many functions are there, and how many of them are ours? What fraction is the Go runtime?

PHASE 2 - FIND THE CODE (Rizin / radare2 through execute_rizin_command, or the r2 plugins in the lab)
  1. Recover function names: a stripped Go binary still has a pclntab. Locate it (look for the magic number) and use it
     to name functions. Which names are `main.*`? Which closures does `main.main` create?
  2. Go calling convention: arguments travel in registers (rax, rbx, rcx, rdi, rsi, r8, r9, r10, r11). Strings are
     (pointer, length) pairs, not NUL-terminated. Use this to read call sites.
  3. Concurrency: find runtime.newproc / chansend / chanrecv / closechan. What does each goroutine do?
  4. Anti-analysis: is there a check that changes behaviour when traced? What does it read, and what does it change?

PHASE 3 - RECOVER THE ALGORITHM
  - Where does the key material come from? It is not a plain string. How is it stored, decoded and stretched?
  - Which standard primitive is used only as a building block (and which library function is it)?
  - How are round keys produced? What is the block size, the structure of the cipher, the number of rounds?
  - An interface method is called in the round loop: how many implementations exist and how is one selected?
  - How is each block tied to its position, so that blocks can be processed out of order?
  - Which parts are decoys (strings, constants)? Prove each decoy is unused (no xrefs).

PHASE 4 - DECRYPT
  - Re-implement the inverse in Python (analysis/hard_go_decrypt.py) and decrypt /work/targets/go/secret.enc.
  - Sanity-check: the output must be readable text. If it is not, your model of the cipher is wrong; go back.

DELIVERABLES
  - Triage table: tool | result | what it told us | was it misleading?
  - The algorithm as pseudo-code plus the recovered key material.
  - The decrypted plaintext.
  - Evidence table: claim | evidence_id | confidence, and a list of decoys with the proof they are unused.
  - Two Go-specific tricks an analyst needs that a C analyst does not, and one thing that would make Go harder still.
```

Expected shape of the answer (spoiler-free): a block cipher built on a standard hash used as a key-stretching step,
run by parallel goroutines; the key is never a plain string and a decoy string names the wrong algorithm.
