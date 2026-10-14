#!/bin/bash
# 服务器上执行：只加载 server 镜像并启动 server + worker。
# 后端发版最常用路径：nginx 不动，只换后端。
#
# 用法:
#   ./up_server.sh                         # 默认：只 up server + worker
#   WITH_NGINX=true ./up_server.sh         # 同时 up nginx（需 repo-nginx.tar.gz）
#
# 注意：repo-nginx.tar.gz 可选，不存在时跳过 nginx 镜像加载，沿用服务器已有镜像。
# 想同时 up nginx 也可以直接用原有 ./up.sh（一起 load + up 三个服务）。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

COMPOSE_FILE="docker-compose.yml"
SERVER_TAR="repo-backend.tar.gz"
NGINX_TAR="repo-nginx.tar.gz"
WITH_NGINX="${WITH_NGINX:-false}"

if [ ! -f "$COMPOSE_FILE" ]; then echo "错误: $COMPOSE_FILE 不存在"; exit 1; fi
if [ ! -f "$SERVER_TAR" ];    then echo "错误: $SERVER_TAR 不存在";    exit 1; fi

echo "==> [1/3] 加载 server 镜像..."
docker load -i "$SERVER_TAR"

if [ "$WITH_NGINX" = "true" ]; then
  if [ ! -f "$NGINX_TAR" ]; then echo "错误: WITH_NGINX=true 但 $NGINX_TAR 不存在"; exit 1; fi
  echo "  (WITH_NGINX=true) 同时加载 nginx 镜像..."
  docker load -i "$NGINX_TAR"
fi

echo "==> [2/3] 启动服务..."
if [ "$WITH_NGINX" = "true" ]; then
  echo "  - server + worker + nginx"
  docker compose -p repo-prod up -d server nginx worker
else
  echo "  - server + worker（nginx 保持原状）"
  docker compose -p repo-prod up -d server worker
fi

echo ""
echo "==> [3/3] 服务状态:"
docker compose -p repo-prod ps
