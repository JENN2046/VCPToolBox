# =================================================================
# Stage 1: Build Stage - 鐢ㄤ簬缂栬瘧鍜屽畨瑁呮墍鏈変緷璧?
# =================================================================
FROM node:20-alpine AS build

# 璁剧疆宸ヤ綔鐩綍
WORKDIR /usr/src/app

# 鏇存崲涓哄浗鍐呴暅鍍忔簮浠ュ姞閫?
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# 瀹夎鎵€鏈夎繍琛屾椂鍜岀紪璇戞椂渚濊禆
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
  rust \
  cargo

# 鍦?npm install 涔嬪墠璁剧疆鐜鍙橀噺锛岃烦杩?puppeteer 鐨?chromium 涓嬭浇
ARG PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=${PUPPETEER_SKIP_DOWNLOAD}

# 澶嶅埗 Node.js 渚濊禆瀹氫箟鏂囦欢骞跺畨瑁呬緷璧?(鍖呭惈 process manager)
COPY package*.json ./
# 濡傛灉閬囧埌 npm install 閫熷害杩囨參鐨勯棶棰橈紝鍙互灏濊瘯鏇存崲涓嬮潰鐨勯暅鍍忔簮銆?
# 鍥藉唴甯哥敤闀滃儚:
# --registry=https://registry.npm.taobao.org (娣樺疂鏃х増)
# --registry=https://registry.npmmirror.com (娣樺疂鏂扮増)
# --registry=https://mirrors.huaweicloud.com/repository/npm/ (鍗庝负浜?
# 鍥介檯閫氱敤 (濡傛灉鏈嶅姟鍣ㄥ湪娴峰):
# (榛樿锛屾棤闇€鎸囧畾)
RUN npm cache clean --force && npm install --registry=https://registry.npmmirror.com

# 澶嶅埗 Python 渚濊禆瀹氫箟鏂囦欢骞跺畨瑁?
COPY requirements.txt ./
# 鍦?Linux 鐜涓嬫瀯寤烘椂锛屾敞閲婃帀浠呴€傜敤浜?Windows 鐨?win10toast 鍖?
RUN sed -i '/^win10toast/s/^/#/' requirements.txt
RUN python3 -m pip install --no-cache-dir --break-system-packages -U pip setuptools wheel -i https://pypi.tuna.tsinghua.edu.cn/simple
RUN pip3 install --no-cache-dir --break-system-packages --target=/usr/src/app/pydeps -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt

# 澶嶅埗鎵€鏈夋簮浠ｇ爜
COPY . .

# 鏌ユ壘鎵€鏈夋彃浠剁洰褰曚笅鐨?requirements.txt 骞跺畨瑁呬緷璧?
# 浣跨敤 find 鍛戒护鏌ユ壘鎵€鏈夊悕涓?requirements.txt 鐨勬枃浠?
# 鐒跺悗浣跨敤 for 寰幆閬嶅巻杩欎簺鏂囦欢骞剁敤 pip 瀹夎
RUN find Plugin -name requirements.txt -exec sh -c ' \
    for req_file do \
        echo ">>> Installing Python dependencies from $req_file"; \
        pip3 install --no-cache-dir --break-system-packages --target=/usr/src/app/pydeps -i https://pypi.tuna.tsinghua.edu.cn/simple -r "$req_file" || \
            { echo "!!! Failed to install Python dependencies from $req_file"; exit 1; }; \
    done' sh {} +

# 鏌ユ壘鎵€鏈夋彃浠剁洰褰曚笅鐨?package.json 骞跺畨瑁?npm 渚濊禆
# 浣跨敤 find 鍛戒护鏌ユ壘鎵€鏈夊悕涓?package.json 鐨勬枃浠?
# 鐒跺悗浣跨敤 for 寰幆閬嶅巻杩欎簺鏂囦欢锛屽苟鍦ㄥ叾鎵€鍦ㄧ洰褰曡繍琛?npm install
RUN find Plugin -name package.json -exec sh -c ' \
    for pkg_file do \
        plugin_dir=$(dirname "$pkg_file"); \
        echo ">>> Installing Node.js dependencies in $plugin_dir"; \
        (cd "$plugin_dir" && npm install --registry=https://registry.npmmirror.com --legacy-peer-deps) || \
            { echo "!!! Failed to install Node.js dependencies in $plugin_dir"; exit 1; }; \
    done' sh {} +

# =================================================================
# Stage 2: Production Stage - 鏈€缁堢殑杞婚噺杩愯鐜
# =================================================================
FROM node:20-alpine

# 璁剧疆宸ヤ綔鐩綍
WORKDIR /usr/src/app

# 浠呭畨瑁呰繍琛屾椂鐨勭郴缁熶緷璧?
# 娣诲姞 chromium 鍙婂叾鎵€闇€渚濊禆锛屼互渚?UrlFetch (Puppeteer) 宸ュ叿浣跨敤
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories && \
  apk add --no-cache \
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
# 璁剧疆 PYTHONPATH 鐜鍙橀噺锛岃 Python 鑳芥壘鍒版垜浠畨瑁呯殑渚濊禆
ENV PYTHONPATH=/usr/src/app/pydeps
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# 璁剧疆鏃跺尯锛氫緷璧栦簬杩愯鏃朵紶鍏ョ殑 TZ 鐜鍙橀噺锛堜緥濡?docker-compose.yml 涓殑閰嶇疆锛夈€?
# 鍩虹闀滃儚 node:20-alpine 宸插畨瑁?tzdata锛岃繍琛屾椂璁剧疆 TZ 鍗冲彲鐢熸晥銆?

# 浠庢瀯寤洪樁娈靛鍒跺簲鐢ㄤ唬鐮佸拰 node_modules
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/package*.json ./
COPY --from=build /usr/src/app/pydeps ./pydeps
COPY --from=build /usr/src/app/*.js ./
COPY --from=build /usr/src/app/Plugin ./Plugin
COPY --from=build /usr/src/app/Agent ./Agent
COPY --from=build /usr/src/app/routes ./routes
COPY --from=build /usr/src/app/requirements.txt ./

# 鍒涘缓鎵€鏈夊簲鐢ㄥ彲鑳介渶瑕佸啓鍏ョ殑鎸佷箙鍖栫洰褰曪紝浠ュ寮洪暅鍍忕殑鍋ュ．鎬?
# 杩欐牱鍗充娇鐢ㄦ埛鐨勫涓绘満鐩綍涓嶅畬鏁达紝瀹瑰櫒涔熻兘姝ｅ父鍚姩銆?
# 鍗锋寕杞戒細瑕嗙洊杩欎簺绌虹洰褰曘€?
RUN mkdir -p /usr/src/app/VCPTimedContacts \
             /usr/src/app/dailynote \
             /usr/src/app/image \
             /usr/src/app/file \
             /usr/src/app/TVStxt \
             /usr/src/app/VCPAsyncResults \
             /usr/src/app/Plugin/VCPLog/log \
             /usr/src/app/Plugin/EmojiListGenerator/generated_lists


# --- 瀹夊叏鎬ц鏄庯細鍏充簬浠?root 鐢ㄦ埛杩愯 ---
#
# 銆?! 璀﹀憡 !!銆?
# 浠ヤ笅鍒涘缓骞跺垏鎹㈠埌浣庢潈闄愮敤鎴?appuser 鐨勬搷浣滃凡琚敞閲婃帀銆?
# 褰撳墠瀹瑰櫒灏嗕互 root 鐢ㄦ埛韬唤杩愯銆?
#
# 鍘熷洜: 搴旂敤闇€瑕佸啓鍏ラ€氳繃 Docker Volume 鎸傝浇鍒板鍣ㄥ唴鐨勬暟鎹洰褰曪紙濡傛棩蹇椼€佺紦瀛樸€佸浘鐗囩瓑锛夈€?
#       褰撲娇鐢ㄤ綆鏉冮檺鐢ㄦ埛(appuser)鏃讹紝濡傛灉涓绘満涓婄殑瀵瑰簲鐩綍鎵€鏈夎€呮槸 root锛屼細瀵艰嚧瀹瑰櫒鍐呭嚭鐜?"Permission Denied" 閿欒銆?
#
# 椋庨櫓: 浠?root 韬唤杩愯瀹瑰櫒瀛樺湪瀹夊叏椋庨櫓銆傚鏋滃簲鐢ㄦ湰韬瓨鍦ㄦ紡娲炶鏀诲嚮鑰呭埄鐢紝
#       鏀诲嚮鑰呭皢鑾峰緱瀹瑰櫒鍐呯殑鏈€楂樻潈闄愶紝鍙兘瀵艰嚧鏇翠弗閲嶇殑瀹夊叏闂銆?
#
# 闀挎湡鎺ㄨ崘鏂规:
# 1. 閲嶆柊鍚敤涓嬮潰鐨勪笁琛屽懡浠わ紝鏋勫缓浣跨敤 appuser 鐨勯暅鍍忋€?
# 2. 鍦ㄩ儴缃插簲鐢ㄧ殑涓绘満涓婏紝鎵惧埌鎵€鏈夋寕杞界粰瀹瑰櫒鐨勬暟鎹洰褰曘€?
# 3. 鎵ц `chown -R <UID>:<GID> /path/to/host/dir` 鍛戒护锛?
#    灏嗚繖浜涚洰褰曠殑鎵€鏈夋潈鍙樻洿涓哄鍣ㄥ唴 appuser 鐨?UID 鍜?GID (閫氬父鏄?1000:1000 鎴?1001:1001)銆?
#    杩欐牱锛屼綆鏉冮檺鐢ㄦ埛涔熻兘瀹夊叏鍦拌鍐欐暟鎹€?
#
# RUN addgroup -S appuser && adduser -S appuser -G appuser
# RUN chown -R appuser:appuser /usr/src/app
# USER appuser


# 鏆撮湶绔彛
EXPOSE 6005

# 瀹氫箟瀹瑰櫒鍚姩鍛戒护
CMD [ "node", "server.js" ]


