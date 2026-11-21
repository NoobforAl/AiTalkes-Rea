PORT ?= 8080

# On Windows, don't let make pick up bash (it can resolve to the WSL launcher); use cmd.exe.
ifeq ($(OS),Windows_NT)
SHELL := cmd.exe
.SHELLFLAGS := /C
RM_MODULES = if exist deck\node_modules rmdir /s /q deck\node_modules
else
RM_MODULES = rm -rf deck/node_modules
endif

.PHONY: dev install sample record clean help lab-build lab lab-test hard hard-go hard-rust hard-all triage test-prompts test-prompts-dry test-prompt

help:
	@echo make dev      - serve the slides and open them in your browser (PORT=$(PORT))
	@echo make install  - install deck dependencies
	@echo make sample   - rebuild sample/weakcrypt.exe
	@echo make record   - re-record radare2 and REA sessions into deck/casts
	@echo make lab-build - build the Docker lab (radare2, Rizin, capa, YARA, REA)
	@echo make lab       - zsh + oh-my-zsh shell inside the lab (targets under /work/targets, read-only, no network)
	@echo make hard      - rebuild the hard sample (sample/hard/vault, vault.upx, secret.enc)
	@echo make hard-go   - rebuild the Go sample (sample/hard-go/vault-go, secret.enc)
	@echo make hard-rust - rebuild the Rust sample (sample/hard-rust/vault-rs, secret.enc)
	@echo make hard-all  - rebuild every hard sample
	@echo make triage T=targets/hard/vault - file, YARA and capa on one target
	@echo make lab-test - self-test of the lab image (tools, r2 plugins, zsh, sandbox, targets)
	@echo make test-prompts-dry - check every prompt in prompts/ against targets, mounts and answer keys (free)
	@echo make test-prompts - run EVERY prompt through Claude Code + REA and grade the answers (costs tokens; BUDGET=5 TIMEOUT=30 ONLY=easy,hard-go)
	@echo make test-prompt P=hard-go - run one prompt
	@echo make clean    - remove deck/node_modules

dev: deck/node_modules
	cd deck && npx -y http-server -p $(PORT) -c-1 -o /index.html .

install deck/node_modules: deck/package.json
	cd deck && npm install --no-audit --no-fund

sample:
	cd sample && clang -O0 -D_CRT_SECURE_NO_WARNINGS -fms-runtime-lib=dll -o weakcrypt.exe weakcrypt.c

record:
	node scripts/record.mjs

lab-build:
	docker compose build re

lab:
	docker compose run --rm re zsh

hard:
	docker compose --profile build run --rm builder

hard-go:
	docker compose --profile build run --rm builder-go

hard-rust:
	docker compose --profile build run --rm builder-rust

hard-all: hard hard-go hard-rust

T ?= targets/hard/vault
triage:
	docker compose run --rm -T re sh -c "file $(T); yara /opt/rules/crypto.yar $(T); capa -q $(T)"

clean:
	$(RM_MODULES)

lab-test:
	docker compose run --rm -T re sh /opt/selftest.sh

test-prompts-dry:
	node scripts/test-prompts.mjs --dry

test-prompts:
	node scripts/test-prompts.mjs $(if $(ONLY),--only $(ONLY)) $(if $(BUDGET),--budget $(BUDGET)) $(if $(TIMEOUT),--timeout $(TIMEOUT))

test-prompt:
	node scripts/test-prompts.mjs --only $(P) $(if $(BUDGET),--budget $(BUDGET)) $(if $(TIMEOUT),--timeout $(TIMEOUT))
