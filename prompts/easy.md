# Prompt: Easy target (`weakcrypt.exe`)

Paste into Claude Code from the repo root. Needs the REA MCP server from `.mcp.json` (approve it when Claude Code asks) and the lab image (`make lab-build`).

```text
You are a reverse engineer. Use the REA MCP server (tools run inside a no-network Docker lab).

TARGET
  /work/targets/easy/weakcrypt.exe     (PE32+ x86-64, not stripped)
  /work/targets/easy/secret.enc        (its output on an unknown input file)

RULES
  - Binary only. Do NOT open any .c, .txt or solution/ file on the host, and do NOT run the target.
  - Every claim needs evidence: cite the REA evidence_id, or the exact command output, that supports it.
  - If something is only a guess, label it "hypothesis" and say what would confirm it.

STEPS (report each one briefly)
  1. Recon: file format, architecture, bitness, protections (inspect_with_objdump file_headers / execute_rizin_command "iI").
  2. Strings: list_strings / search_strings. Which strings look like a key, a file name, a status message?
  3. Functions: find main and the function that transforms the buffer (execute_rizin_command "aaa; afl").
  4. Disassemble that function (inspect_with_objdump disassemble --symbol, or rizin "pdf @ <addr>").
     Identify: the key bytes, the key length, the loop, the per-byte operations.
  5. Algorithm: write the encryption formula, then the inverse.
  6. Decrypt /work/targets/easy/secret.enc with a small Python script you save as analysis/easy_decrypt.py.

DELIVERABLES
  - Algorithm (one formula) and the recovered key.
  - The decrypted plaintext.
  - A table: claim | evidence_id | confidence.
  - One sentence: why is this cipher weak?
```

Expected shape of the answer (spoiler-free): repeating-key XOR plus a constant byte add, key hard-coded in the binary.
