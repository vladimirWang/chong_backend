#!/bin/bash
# Mac 本地执行：原生 bun install + prisma generate → docker build linux/amd64 → save + 打包
# 服务器零 build，只 docker load + compose up（见 deploy/up.sh）。
#
# 背景：服务器 Alpine 容器内 RUN prisma generate 要 457s+（Prisma CLI 下载引擎卡网络），
# RUN bun install 也慢。Mac 原生环境下这两步加起来 ~1s + ~30s。
#
# 用法:
#   cd deploy && ./build_server.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}/.."  # repo_backend 根目录

SERVER_IMAGE="repo-backend:latest"
NGINX_IMAGE="repo-nginx:latest"
STAGE_DIR="${SCRIPT_DIR}/.deploy-stage"
PKG_DIR="${SCRIPT_DIR}/dist"

echo "==> [1/5] Mac 原生 bun install（走国内网络，~30s）..."
bun install --frozen-lockfile

echo "==> [2/5] Mac 原生 prisma generate（~1s，零网络等待）..."
bunx prisma generate

echo "==> [3/5] 组装 server 镜像构建上下文（${STAGE_DIR}）..."
rm -rf "${STAGE_DIR}" && mkdir -p "${STAGE_DIR}"
# 注意：不复制 node_modules——Dockerfile.deploy 里会 bun install --production（快得多）
# 先复制 deploy 目录（内含 Dockerfile.deploy 和 docker-entrypoint.sh），
# 再从 repo_backend 根复制 prisma / src（deploy 下没有这些子目录，互不覆盖）
cp -R deploy                    "${STAGE_DIR}/"
cp package.json                 "${STAGE_DIR}/"
cp bun.lock                     "${STAGE_DIR}/"
cp -R prisma                    "${STAGE_DIR}/"
cp -R src                       "${STAGE_DIR}/"
cp prisma.config.ts             "${STAGE_DIR}/"
cp deploy/Dockerfile.deploy     "${STAGE_DIR}/Dockerfile"

echo "==> [4/5] 构建 linux/amd64 镜像..."
echo "  - server (仅一条 production-only bun install RUN，快于服务器全量 install+generate)"
docker build --platform linux/amd64 -t "${SERVER_IMAGE}" "${STAGE_DIR}"
echo "    架构: $(docker image inspect "${SERVER_IMAGE}" --format '{{.Architecture}}')"

echo "  - nginx (保持原 Dockerfile，仅一条轻量 RUN)"
docker build --platform linux/amd64 -f "${SCRIPT_DIR}/../nginx/Dockerfile" \
  --build-arg NGINX_SITE=prod \
  -t "${NGINX_IMAGE}" "${SCRIPT_DIR}/../nginx"
echo "    架构: $(docker image inspect "${NGINX_IMAGE}" --format '{{.Architecture}}')"

echo "==> [5/5] 导出镜像 + 组装部署包（${PKG_DIR}）..."
rm -rf "${PKG_DIR}" && mkdir -p "${PKG_DIR}"

docker save "${SERVER_IMAGE}" | gzip > "${PKG_DIR}/repo-backend.tar.gz"
docker save "${NGINX_IMAGE}"  | gzip > "${PKG_DIR}/repo-nginx.tar.gz"

cp "${SCRIPT_DIR}/docker-compose.yml"  "${PKG_DIR}/"
cp "${SCRIPT_DIR}/up.sh"                "${PKG_DIR}/"
cp "${SCRIPT_DIR}/up_server.sh"         "${PKG_DIR}/"
# .env.prod 是服务器专属文件（开发机上一般不存在），可选拷入
if [ -f "../.env.prod" ]; then
  cp ../.env.prod "${PKG_DIR}/"
else
  echo "  (跳过 .env.prod，需手动放到部署包目录)"
fi
chmod +x "${PKG_DIR}/up.sh" "${PKG_DIR}/up_server.sh"

rm -rf "${STAGE_DIR}"

echo ""
echo "==> 完成！部署包:"
ls -lh "${PKG_DIR}/"
echo ""
echo "服务器部署:"
echo "  scp -r ${PKG_DIR}/ user@server:~/repo_backend/"
echo "  ssh user@server && cd ~/repo_backend && ./up.sh"
