# =================================================================
# Stage 1: Build Stage - 用于编译和安装所有依赖
# =================================================================
FROM node:20-alpine AS build

# 设置工作目录
WORKDIR /usr/src/app

# 安装所有运行时和编译时依赖
RUN apk add --no-cache \
  tzdata \
  python3 \
  py3-pip \
  build-base \
  gfortran \
  musl-dev \
  lapack-dev \
  openblas-dev \
  jpeg-dev \
  zlib-dev \
  freetype-dev \
  python3-dev \
  linux-headers \
  libffi-dev \
  openssl-dev \
  ffmpeg \
  curl

# 通过 rustup 安装 Rust 工具链（Alpine 3.20+ 已移除 rust/cargo 包）
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable --profile minimal
ENV PATH="/root/.cargo/bin:${PATH}"

# 在 npm install 之前设置环境变量，跳过 puppeteer 的 chromium 下载
ARG PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=${PUPPETEER_SKIP_DOWNLOAD}

# 复制 Node.js 依赖定义文件并安装依赖 (包含 pm2)
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# 复制 Python 依赖定义文件并安装
COPY requirements.txt ./
COPY Plugin/ArtistMatcher/requirements.txt ./Plugin/ArtistMatcher/requirements.txt
COPY Plugin/SciCalculator/requirements.txt ./Plugin/SciCalculator/requirements.txt
COPY Plugin/SkillBridge/SKILL/gif-sticker-maker/references/requirements.txt ./Plugin/SkillBridge/SKILL/gif-sticker-maker/references/requirements.txt
COPY Plugin/VideoGenerator/requirements.txt ./Plugin/VideoGenerator/requirements.txt
COPY Plugin/DigitalOracle/requirements.txt ./Plugin/DigitalOracle/requirements.txt
RUN python3 -m pip install --no-cache-dir --break-system-packages -U pip setuptools wheel
RUN pip3 install --no-cache-dir --break-system-packages --target=/usr/src/app/pydeps \
    -r requirements.txt \
    -r Plugin/ArtistMatcher/requirements.txt \
    -r Plugin/SciCalculator/requirements.txt \
    -r Plugin/SkillBridge/SKILL/gif-sticker-maker/references/requirements.txt \
    -r Plugin/VideoGenerator/requirements.txt \
    -r Plugin/DigitalOracle/requirements.txt

# =================================================================
# 编译 Rust N-API 向量引擎 (vexus-lite)
# 关键：把 Rust 子项目单独 COPY 并提前编译，让 Docker layer cache 能复用编译产物。
# 这样 README、插件、图片、普通 JS 文件变更时，不会触发 Rust 全量重编；
# 只有 rust-vexus-lite/package.json、Cargo.toml、build.rs、src/** 变化才会失效。
# 仓库内 commit 的预编译 .node 仅作为 node 直跑用户的兜底，镜像必须以源码现编产物为准。
# =================================================================
COPY rust-vexus-lite/package.json ./rust-vexus-lite/package.json
COPY rust-vexus-lite/Cargo.toml ./rust-vexus-lite/Cargo.toml
COPY rust-vexus-lite/build.rs ./rust-vexus-lite/build.rs
COPY rust-vexus-lite/src ./rust-vexus-lite/src

RUN echo ">>> Building rust-vexus-lite native addon..." && \
    cd rust-vexus-lite && \
    npm install && \
    npm run build && \
    mkdir -p /tmp/rust-vexus-lite-built && \
    cp ./*.node /tmp/rust-vexus-lite-built/ && \
    cd .. && \
    echo ">>> rust-vexus-lite build complete."

# DailyNoteSearcher ships as a native sidecar. Build it on Alpine instead of
# copying the host's glibc binary, otherwise spawn() reports ENOENT when musl's
# dynamic loader cannot load it.
COPY Plugin/DailyNoteSearcher/src/Cargo.toml ./Plugin/DailyNoteSearcher/src/Cargo.toml
COPY Plugin/DailyNoteSearcher/src/Cargo.lock ./Plugin/DailyNoteSearcher/src/Cargo.lock
COPY Plugin/DailyNoteSearcher/src/src ./Plugin/DailyNoteSearcher/src/src
RUN echo ">>> Building DailyNoteSearcher musl sidecar..." && \
    cd Plugin/DailyNoteSearcher/src && \
    CARGO_TARGET_DIR=/tmp/daily-note-searcher-target cargo build --locked --release && \
    mkdir -p /tmp/daily-note-searcher-built && \
    cp /tmp/daily-note-searcher-target/release/DailyNoteSearcher \
      /tmp/daily-note-searcher-built/DailyNoteSearcher && \
    strip /tmp/daily-note-searcher-built/DailyNoteSearcher && \
    echo ">>> DailyNoteSearcher build complete."

# 复制所有源代码
COPY . .

# COPY . . 会把仓库中可能滞后的预编译 .node 合并进 rust-vexus-lite。
# 将上一步容器内现编产物覆盖回去，确保镜像运行时加载的是当前源码对应的 native addon。
RUN cp /tmp/rust-vexus-lite-built/*.node ./rust-vexus-lite/ && \
    cp /tmp/daily-note-searcher-built/DailyNoteSearcher \
      ./Plugin/DailyNoteSearcher/DailyNoteSearcher && \
    chmod 0755 ./Plugin/DailyNoteSearcher/DailyNoteSearcher

# 构建 AdminPanel-Vue 前端
RUN set -eu; \
    if [ -f AdminPanel-Vue/package.json ]; then \
      echo ">>> Building AdminPanel-Vue frontend..."; \
      cd AdminPanel-Vue; \
      npm ci --no-audit --no-fund; \
      npm run build:no-type-check; \
      cd ..; \
      echo ">>> AdminPanel-Vue build complete."; \
    fi

# 查找所有插件目录下的 package.json 并安装 npm 依赖
# 使用 find 命令查找所有名为 package.json 的文件
# 然后使用 for 循环遍历这些文件，并在其所在目录运行 npm install
RUN find Plugin -mindepth 2 -maxdepth 2 -name package.json -exec sh -c ' \
    for pkg_file do \
        plugin_dir=$(dirname "$pkg_file"); \
        echo ">>> Installing Node.js dependencies in $plugin_dir"; \
        if [ -f "$plugin_dir/package-lock.json" ]; then \
            install_command="npm ci --legacy-peer-deps --no-audit --no-fund"; \
        else \
            install_command="npm install --legacy-peer-deps --no-audit --no-fund"; \
        fi; \
        (cd "$plugin_dir" && $install_command) || \
            { echo "!!! Failed to install Node.js dependencies in $plugin_dir"; exit 1; }; \
    done' sh {} +

# =================================================================
# Stage 2: Production Stage - 最终的轻量运行环境
# =================================================================
FROM node:20-alpine

# 设置工作目录
WORKDIR /usr/src/app

# 仅安装运行时的系统依赖
# 添加 chromium 及其所需依赖，以供 UrlFetch (Puppeteer) 工具使用
RUN apk add --no-cache \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ttf-freefont \
  tzdata \
  python3 \
  openblas \
  jpeg-dev \
  zlib-dev \
  freetype-dev \
  libffi \
  ffmpeg
# 设置 PYTHONPATH 环境变量，让 Python 能找到我们安装的依赖
ENV PYTHONPATH=/usr/src/app/pydeps
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# 设置时区：依赖于运行时传入的 TZ 环境变量（例如 docker-compose.yml 中的配置）。
# 基础镜像 node:20-alpine 已安装 tzdata，运行时设置 TZ 即可生效。

# 从构建阶段复制应用代码和 node_modules
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/package*.json ./
COPY --from=build /usr/src/app/pydeps ./pydeps
COPY --from=build /usr/src/app/*.js ./
COPY --from=build /usr/src/app/Plugin ./Plugin
COPY --from=build /usr/src/app/Agent ./Agent
COPY --from=build /usr/src/app/routes ./routes
COPY --from=build /usr/src/app/modules ./modules
COPY --from=build /usr/src/app/requirements.txt ./
# 只复制 Rust N-API 的运行时加载器和 musl 产物。Cargo target、源码和
# @napi-rs/cli 都是构建期内容，不应进入最终镜像。
RUN mkdir -p ./rust-vexus-lite
COPY --from=build /usr/src/app/rust-vexus-lite/index.js ./rust-vexus-lite/index.js
COPY --from=build /usr/src/app/rust-vexus-lite/package.json ./rust-vexus-lite/package.json
COPY --from=build /usr/src/app/rust-vexus-lite/vexus-lite.linux-*-musl.node ./rust-vexus-lite/
# 复制 AdminPanel-Vue 构建产物（管理面板前端）
COPY --from=build /usr/src/app/AdminPanel-Vue/dist ./AdminPanel-Vue/dist
# 严格预处理顺序、agent/toolbox/RAG 等根运行时配置。
COPY --from=build /usr/src/app/*.json ./

# 创建所有应用可能需要写入的持久化目录，以增强镜像的健壮性
# 这样即使用户的宿主机目录不完整，容器也能正常启动。
# 卷挂载会覆盖这些空目录。
RUN mkdir -p /usr/src/app/VCPTimedContacts \
             /usr/src/app/dailynote \
             /usr/src/app/image \
             /usr/src/app/file \
             /usr/src/app/TVStxt \
             /usr/src/app/VCPAsyncResults \
             /usr/src/app/Plugin/VCPLog/log \
             /usr/src/app/Plugin/EmojiListGenerator/generated_lists


# --- 安全性说明：关于以 root 用户运行 ---
#
# 【!! 警告 !!】
# 以下创建并切换到低权限用户 appuser 的操作已被注释掉。
# 当前容器将以 root 用户身份运行。
#
# 原因: 应用需要写入通过 Docker Volume 挂载到容器内的数据目录（如日志、缓存、图片等）。
#       当使用低权限用户(appuser)时，如果主机上的对应目录所有者是 root，会导致容器内出现 "Permission Denied" 错误。
#
# 风险: 以 root 身份运行容器存在安全风险。如果应用本身存在漏洞被攻击者利用，
#       攻击者将获得容器内的最高权限，可能导致更严重的安全问题。
#
# 长期推荐方案:
# 1. 重新启用下面的三行命令，构建使用 appuser 的镜像。
# 2. 在部署应用的主机上，找到所有挂载给容器的数据目录。
# 3. 执行 `chown -R <UID>:<GID> /path/to/host/dir` 命令，
#    将这些目录的所有权变更为容器内 appuser 的 UID 和 GID (通常是 1000:1000 或 1001:1001)。
#    这样，低权限用户也能安全地读写数据。
#
# RUN addgroup -S appuser && adduser -S appuser -G appuser
# RUN chown -R appuser:appuser /usr/src/app
# USER appuser


# 暴露端口（主服务 + 管理面板，默认 6005 + 6006）
EXPOSE 6005 6006

# 定义容器启动命令
# 使用 PM2 ecosystem 配置同时启动主服务和管理面板
CMD [ "node_modules/.bin/pm2-runtime", "start", "ecosystem.config.js" ]
