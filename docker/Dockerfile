# syntax=docker/dockerfile:1
# Reverse-engineering lab: radare2 (latest, with r2pm plugins) + Rizin + binutils + detection tools + REA (MCP server),
# in a zsh + oh-my-zsh shell.
#   target "builder"   -> gcc/UPX, builds sample/hard (not shipped in the lab)
#   target "r2plugins" -> compiles the r2pm plugins; only their files are copied into the lab (no compilers shipped)
#   target "lab"       -> analysis image (default)
ARG UBUNTU=ubuntu:24.04
ARG NODE=node:22-slim

FROM ${NODE} AS node

# ---------------------------------------------------------------- oh-my-zsh (cloned here so the lab needs no git)
FROM ${UBUNTU} AS omz
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 https://github.com/ohmyzsh/ohmyzsh.git /opt/oh-my-zsh \
    && rm -rf /opt/oh-my-zsh/.git

# ---------------------------------------------------------------- r2pm plugins
# Built system-wide (r2pm -gi) because the lab runs with a read-only root and an empty tmpfs as $HOME,
# so anything installed under ~/.local would be invisible there.
FROM ${UBUNTU} AS r2plugins
ARG R2_VERSION=6.2.4
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl git sudo build-essential cmake meson ninja-build pkg-config python3 \
        unzip xz-utils libyara-dev \
    && rm -rf /var/lib/apt/lists/*
RUN for p in radare2 radare2-dev; do \
        curl -fsSL -o /tmp/$p.deb "https://github.com/radareorg/radare2/releases/download/${R2_VERSION}/${p}_${R2_VERSION}_amd64.deb"; \
    done \
    && apt-get update && apt-get install -y /tmp/radare2.deb /tmp/radare2-dev.deb \
    && rm -rf /var/lib/apt/lists/* /tmp/*.deb \
    && r2 -v && r2pm -U
# everything installed after this point is what gets shipped
RUN touch /tmp/marker && sleep 1
RUN r2pm -gi r2ghidra
RUN r2pm -gi r2dec
RUN r2pm -gi r2frida-precompiled
RUN r2pm -gi r2yara
# the Ghidra decompiler (pdg) needs its processor specs too, or it prints "Cannot find the sleigh home"
RUN r2pm -gi r2ghidra-sleigh || (sleep 20 && r2pm -gi r2ghidra-sleigh)
# "newer than the marker" misses the sleigh data: unzip keeps the archive's old file dates, so that directory is added explicitly
RUN SLEIGH="$(r2 -HR2_LIBR_PLUGINS)/r2ghidra_sleigh" \
    && test -d "$SLEIGH" \
    && find /usr /opt \( -type f -o -type l \) -newer /tmp/marker \
        -not -path '/usr/include/*' -not -path '/usr/share/doc/*' -not -path '/usr/share/man/*' \
        -not -path '*/__pycache__/*' \
    | tar -czf /r2plugins.tgz -T - "$SLEIGH" \
    && tar -tzf /r2plugins.tgz | grep -c sleigh \
    && ls -l /r2plugins.tgz

# ---------------------------------------------------------------- builder
FROM ${UBUNTU} AS builder
RUN apt-get update && apt-get install -y --no-install-recommends gcc libc6-dev upx-ucl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /work/sample/hard

# ---------------------------------------------------------------- lab
FROM ${UBUNTU} AS lab
ARG RIZIN_VERSION=0.9.1
ARG FLOSS_VERSION=3.2.0
ARG CAPA_VERSION=10.0.0
ARG REA_VERSION=6.8.0
ARG R2_VERSION=6.2.4

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl unzip xz-utils file binutils \
        binwalk yara upx-ucl \
        procps less python3 python3-pip \
        zsh zsh-autosuggestions zsh-syntax-highlighting \
    && rm -rf /var/lib/apt/lists/*

# radare2: latest official release (Ubuntu's own package is far older), then the r2pm plugins built above
RUN curl -fsSL --retry 5 --retry-all-errors --retry-delay 3 -o /tmp/radare2.deb "https://github.com/radareorg/radare2/releases/download/${R2_VERSION}/radare2_${R2_VERSION}_amd64.deb" \
    && apt-get update && apt-get install -y /tmp/radare2.deb \
    && rm -rf /var/lib/apt/lists/* /tmp/radare2.deb \
    && r2 -v
COPY --from=r2plugins /r2plugins.tgz /tmp/r2plugins.tgz
RUN tar -xzf /tmp/r2plugins.tgz -C / && rm /tmp/r2plugins.tgz && ldconfig \
    && pip3 install --no-cache-dir --break-system-packages r2pipe

# Node 22 (REA needs >= 22.23.4); ubuntu's own nodejs is too old
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

# Rizin (REA's native provider) - official static build
# (downloaded to a file first: a retry cannot resume a stream that is piped into tar)
RUN mkdir -p /opt/rizin \
    && curl -fsSL --retry 5 --retry-all-errors --retry-delay 3 -o /tmp/rizin.tar.xz "https://github.com/rizinorg/rizin/releases/download/v${RIZIN_VERSION}/rizin-v${RIZIN_VERSION}-static-x86_64.tar.xz" \
    && tar -xJf /tmp/rizin.tar.xz -C /opt/rizin && rm /tmp/rizin.tar.xz \
    && for b in $(find /opt/rizin -type f -path '*/bin/*' -perm -u+x); do ln -sf "$b" /usr/local/bin/$(basename "$b"); done \
    && rizin -v

# FLOSS (decodes obfuscated / stack strings) and capa (capability detection) - standalone builds
RUN curl -fsSL --retry 5 --retry-all-errors --retry-delay 3 -o /tmp/floss.zip "https://github.com/mandiant/flare-floss/releases/download/v${FLOSS_VERSION}/floss-v${FLOSS_VERSION}-linux.zip" \
    && unzip -q /tmp/floss.zip -d /usr/local/bin && chmod +x /usr/local/bin/floss \
    && curl -fsSL --retry 5 --retry-all-errors --retry-delay 3 -o /tmp/capa.zip "https://github.com/mandiant/capa/releases/download/v${CAPA_VERSION}/capa-v${CAPA_VERSION}-linux.zip" \
    && unzip -q /tmp/capa.zip -d /usr/local/bin && chmod +x /usr/local/bin/capa \
    && rm /tmp/*.zip

# REA: MCP server for agents; finds rizin/objdump on PATH
RUN npm install --global --no-audit --no-fund "rea-agents@${REA_VERSION}" && rea --version

COPY docker/rules /opt/rules
COPY docker/selftest.sh /opt/selftest.sh

# zsh + oh-my-zsh. They live under /opt because /home/re is replaced by a tmpfs at run time; ZDOTDIR points zsh
# at the config below (and keeps it from starting the first-run wizard). bash is still available.
COPY --from=omz /opt/oh-my-zsh /opt/oh-my-zsh
COPY docker/zshrc /opt/lab-shell/.zshrc
ENV ZDOTDIR=/opt/lab-shell
RUN useradd --create-home --uid 10001 --shell /usr/bin/zsh re
USER re
ENV HOME=/home/re
WORKDIR /work
CMD ["zsh"]
