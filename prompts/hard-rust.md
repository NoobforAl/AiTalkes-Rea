# Prompt: Hard target, Rust (`vault-rs`, stripped + LTO + inlined)

Paste into Claude Code from the repo root. Needs the REA MCP server from `.mcp.json` and the lab image (`make lab-build`).
Detection tools also run directly in the lab: `docker compose run --rm -T re <command>`.

```text
You are a reverse engineer. The target is a Rust program built for size and speed; the compiler removed most structure.
Use REA (MCP) and the lab tools.

TARGET
  /work/targets/rust/vault-rs     stripped, statically linked Rust ELF x86-64 (LTO, panic=abort)
  /work/targets/rust/secret.enc   ciphertext produced by vault-rs (format: "RSV1" | u32 length | data)

RULES
  - Binary only. Do NOT open any .rs, .toml, .txt or solution/ file on the host, and do NOT run the target.
  - Do NOT start debug sessions. The lab has no ptrace, and the program may behave differently when it detects a debugger.
  - Every claim needs evidence (REA evidence_id or exact command output). Mark guesses as "hypothesis".
  - Tool verdicts are hints, not facts. If a tool and the disassembly disagree, the disassembly wins; say so.
  - Name which tool or plugin produced each piece of evidence (rizin, radare2, r2ghidra pdg, r2dec pdd, objdump).

PHASE 1 - TRIAGE (one line of conclusion for each)
  a. file / readelf / strings -> format, linking, stripped? Which strings come from the Rust standard library?
  b. yara -s /opt/rules/crypto.yar <file> and capa -q <file> -> what do they report? Verify EACH hit in the disassembly.
  c. How many functions are there, and which one is the program's real entry logic?

PHASE 2 - FIND THE CODE
  1. Find main without symbols: `_start` calls __libc_start_main; its first argument is a shim that calls
     std::rt::lang_start, whose first argument is the user's main. Follow it.
  2. Rust strings are (pointer, length) pairs: the file names are not NUL-terminated literals. Find the two file
     operations (open/read/write syscalls or libc calls) and the buffers that connect them.
  3. Decompile the user's main with the decompiler plugins (pdg and pdd) and compare them with the disassembly.
     Which one is more readable? Which one hides something?
  4. Anti-analysis: is there a check that changes behaviour when traced? What does it read, and what does it change?

PHASE 3 - RECOVER THE ALGORITHM
  - Where does the key come from? It is not a string, and there is no key-derivation code to find at run time.
    Explain why, and reconstruct the key words.
  - The inner loop looks like a well-known stream cipher. Which one? List EVERY difference from the standard algorithm
    (constants, rotation amounts, number of rounds, state layout, nonce, counter) and prove each from the disassembly.
  - How is the keystream combined with the data, and what happens with a partial last block?
  - Which parts are decoys (strings, constants that look like something else)? Prove each decoy is unused.

PHASE 4 - DECRYPT
  - Re-implement the inverse in Python (analysis/hard_rust_decrypt.py) and decrypt /work/targets/rust/secret.enc.
  - Sanity-check: the output must be readable text. If it is not, your model of the cipher is wrong; go back.

DELIVERABLES
  - Triage table: tool | result | what it told us | was it misleading?
  - The algorithm as pseudo-code plus the recovered key material.
  - The decrypted plaintext.
  - Evidence table: claim | evidence_id | confidence, and a list of decoys with the proof they are unused.
  - Two Rust-specific obstacles an analyst meets that a C analyst does not, and one thing that would make Rust harder still.
```

Expected shape of the answer (spoiler-free): a stream cipher that resembles a famous one but is not it, with a key the
compiler computed ahead of time; standard-algorithm detections will fire and be wrong.
