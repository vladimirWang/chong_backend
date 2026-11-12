#!/bin/bash
# Mac 本地执行：单独构建 nginx 镜像并导出到部署包目录。
#
# nginx 镜像是纯配置镜像（nginx.conf + conf.d），前端静态资源走 bind mount 不进镜像。
# nginx 配置变更很少，只在网关配置变更时跑一次本脚本；产物与 build_server.sh 共用 dist/ 目录。
#
# 前端发版不需要本脚本（在 repo_frontend 目录执行）:
#   pnpm build && rsync -avz --delete dist/ root@139.224.68.145:~/repo_backend/nginx/html/dist/
#
# 用法:
#   cd deploy && ./build_nginx.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

NGINX_IMAGE="repo-nginx:latest"
PKG_DIR="${SCRIPT_DIR}/dist"

echo "==> [1/2] 构建 linux/amd64 nginx 镜像..."
docker build --platform linux/amd64 \
  --build-arg NGINX_SITE=prod \
  -t "${NGINX_IMAGE}" "${SCRIPT_DIR}/../nginx"
echo "    架构: $(docker image inspect "${NGINX_IMAGE}" --format '{{.Architecture}}')"

echo "==> [2/2] 导出镜像到部署包（${PKG_DIR}）..."
mkdir -p "${PKG_DIR}"
docker save "${NGINX_IMAGE}" | gzip > "${PKG_DIR}/repo-nginx.tar.gz"

echo ""
echo "==> 完成！"
ls -lh "${PKG_DIR}/repo-nginx.tar.gz"
echo ""
echo "服务器更新 nginx:"
echo "  scp ${PKG_DIR}/repo-nginx.tar.gz root@139.224.68.145:~/repo_backend/deploy/"
echo "  ssh root@139.224.68.145 'cd ~/repo_backend/deploy && docker load -i repo-nginx.tar.gz && docker compose -p repo-prod up -d nginx'"
echo ""
echo "  前端发版无需本脚本: repo_frontend 下 pnpm build && rsync -avz --delete dist/ root@139.224.68.145:~/repo_backend/nginx/html/dist/"
