#!/bin/sh
# Lab self-test: run inside the lab with `make lab-test` (docker compose run --rm -T re sh /opt/selftest.sh).
# Checks the toolchain, the radare2 plugins, the shell, the sandbox settings and that no answers leaked into the lab.
fail=0
ok()  { printf 'PASS  %s\n' "$1"; }
bad() { printf 'FAIL  %s\n' "$1"; fail=$((fail + 1)); }
check() { # check "<name>" <command...>
  name=$1; shift
  if "$@" >/dev/null 2>&1; then ok "$name"; else bad "$name"; fi
}
has() { # has "<name>" "<pattern>" <command...>   (the command's output must match the pattern)
  name=$1; pat=$2; shift 2
  if "$@" 2>&1 | grep -q -i -E "$pat"; then ok "$name"; else bad "$name"; fi
}

echo "== tools"
has "radare2 6.x"        '^radare2 6\.'            r2 -v
check "rizin"            rizin -v
check "yara"             yara --version
check "capa"             capa --version
check "floss"            floss --version
check "upx"              upx -V
check "REA"              rea --version
check "node 22+"         sh -c 'node -v | grep -q "^v2[2-9]"'
check "r2pipe (python)"  python3 -c 'import r2pipe'

echo "== radare2 plugins (r2pm)"
has "r2ghidra (core plugin)" 'ghidra'  r2 -qc 'Lc' -
has "r2dec (core plugin)"    'r2dec'   r2 -qc 'Lc' -
has "r2yara (core plugin)"   'yara'    r2 -qc 'Lc' -
has "r2frida (io plugin)"    'frida'   r2 -L
EASY=/work/targets/easy/weakcrypt.exe
if [ -f "$EASY" ]; then
  # a decompiler must print code AND no error (r2ghidra prints "ERROR: Cannot find the sleigh home" when its data is missing)
  decompiles() { # decompiles "<name>" <r2 command>
    name=$1; out=$(r2 -q -e bin.relocs.apply=true -c "aaa; $2 @ main" "$EASY" 2>&1)
    if printf '%s\n' "$out" | grep -q -E '^(ERROR|WARN):|Cannot find'; then bad "$name (prints an error)"
    elif printf '%s' "$out" | grep -q -E 'return|main'; then ok "$name"
    else bad "$name (no code in the output)"; fi
  }
  decompiles "pdg (r2ghidra) decompiles main" pdg
  decompiles "pdd (r2dec) decompiles main" pdd
else
  bad "easy target is not mounted ($EASY)"
fi

echo "== shell"
check "zsh"              zsh --version
check "oh-my-zsh files"  test -f /opt/oh-my-zsh/oh-my-zsh.sh
has "oh-my-zsh loads"    'robbyrussell'  zsh -ic 'echo $ZSH_THEME'

echo "== sandbox"
[ "$(id -u)" = 10001 ] && ok "runs as uid 10001 (not root)" || bad "runs as uid $(id -u)"
check "root filesystem is read-only"  sh -c '! touch /usr/selftest 2>/dev/null'
check "capabilities dropped"          sh -c 'grep -q "^CapEff:.0000000000000000" /proc/self/status'
check "no network"                    sh -c '! curl -sS -m 3 -o /dev/null https://github.com 2>/dev/null'

echo "== targets (only binaries and ciphertext may be visible)"
for f in easy/weakcrypt.exe easy/secret.enc hard/vault hard/vault.upx hard/secret.enc go/vault-go go/secret.enc rust/vault-rs rust/secret.enc; do
  check "target $f" test -s "/work/targets/$f"
done
check "no sources or plaintext in the lab" sh -c '[ -z "$(find /work -name "*.c" -o -name "*.go" -o -name "*.rs" -o -name "secret.txt" 2>/dev/null)" ]'

echo
if [ "$fail" -eq 0 ]; then echo "lab self-test: all checks passed"; else echo "lab self-test: $fail check(s) failed"; fi
exit "$fail"
