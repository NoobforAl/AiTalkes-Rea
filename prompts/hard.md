# Prompt: Hard target (`vault`, stripped + static + obfuscated)

Paste into Claude Code from the repo root. Needs the REA MCP server from `.mcp.json` and the lab image (`make lab-build`).
Detection tools also run directly in the lab: `docker compose run --rm -T re <command>`.

```text
You are a reverse engineer. The target is intentionally hard to analyse. Use REA (MCP) and the lab tools.

TARGET
  /work/targets/hard/vault        stripped, statically linked ELF x86-64
  /work/targets/hard/vault.upx    the same program packed with UPX
  /work/targets/hard/secret.enc   ciphertext produced by vault (format: "VLT1" | u32 length | data)

RULES
  - Binary only. Do NOT open any .c, .txt or solution/ file on the host, and do NOT run the target.
  - Do NOT start debug sessions (start_gdb_session / start_rizin_debug_session). The lab has no ptrace,
    and the program may behave differently when it detects a debugger. Static analysis only.
  - Every claim needs evidence (REA evidence_id or exact command output). Mark guesses as "hypothesis".
  - Tool verdicts are hints, not facts. If a tool and the disassembly disagree, the disassembly wins; say so.
  - FLOSS is very slow on static binaries (it timed out after 7 min here); skip it or give it a strict timeout.

PHASE 1 - TRIAGE (detection tools, in this order; one line of conclusion for each)
  a. file                         -> format, linking, stripped?
  b. inspect_byte_entropy / entropy of vault vs vault.upx -> is it packed? (UPX: `upx -t`, `upx -d` into /tmp)
  c. strings | grep               -> do any strings look like a key? how many strings in total?
  d. yara -s /opt/rules/crypto.yar <file>  -> which constants match? Which hits might be decoys?
  e. capa -q <file>               -> which capabilities are reported? Verify EACH one in the disassembly.

PHASE 2 - FIND THE CODE (Rizin through execute_rizin_command)
  1. aaa; afl~?   (how many functions?) then find main (afl~main) and ignore libc / flirt.* functions.
  2. Find where the real work happens: follow main's calls; look for fopen/fread/fwrite, a loop, and
     8-byte immediates (hash/PRNG constants). Search bytes with /x and use axt for cross references.
  3. Anti-analysis: is there a check that changes behaviour when traced? What does it change?

PHASE 3 - RECOVER THE ALGORITHM
  - Where does the key material come from? It is not a plain string. How is it stored and decoded?
  - How is the key turned into state (KDF)? Which generator produces the keystream, and which bits of it are used?
  - What is the exact per-byte transform (operations, order, dependence on the byte index)?
  - Which parts are decoys (strings, tables, functions never called)? Prove each decoy is unused (no xrefs).

PHASE 4 - DECRYPT
  - Re-implement the inverse in Python (analysis/hard_decrypt.py) and decrypt /work/targets/hard/secret.enc.
  - Sanity-check: the output must be readable text. If it is not, your model of the cipher is wrong; go back.

DELIVERABLES
  - Triage table: tool | result | what it told us | was it misleading?
  - The algorithm as pseudo-code plus the recovered key material.
  - The decrypted plaintext.
  - Evidence table: claim | evidence_id | confidence, and a list of decoys with the proof they are unused.
  - Three ideas to make this even harder to analyse, and one detection that would still catch it.
```

Expected shape of the answer (spoiler-free): a custom stream cipher whose key is decoded at run time; two tools will name the wrong algorithm.
