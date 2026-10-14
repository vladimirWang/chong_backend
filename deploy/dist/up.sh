#!/bin/bash
# 服务器上执行：加载 Mac 端预构建镜像并启动生产服务。
# 服务器不 build 任何东西，只 docker load + compose up。
#
# 用法: ./up.sh  （需与 docker-compose.yml、repo-backend.tar.gz、repo-nginx.tar.gz、.env.prod 同目录）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

COMPOSE_FILE="docker-compose.yml"
SERVER_TAR="repo-backend.tar.gz"
NGINX_TAR="repo-nginx.tar.gz"

if [ ! -f "$COMPOSE_FILE" ]; then echo "错误: $COMPOSE_FILE 不存在"; exit 1; fi
if [ ! -f "$SERVER_TAR" ];    then echo "错误: $SERVER_TAR 不存在";    exit 1; fi
if [ ! -f "$NGINX_TAR" ];     then echo "错误: $NGINX_TAR 不存在";     exit 1; fi

echo "==> [1/3] 加载预构建镜像..."
docker load -i "$SERVER_TAR"
docker load -i "$NGINX_TAR"

echo "==> [2/3] 启动服务（server + worker + nginx）..."
docker compose -p repo-prod up -d server nginx worker

echo ""
echo "==> [3/3] 服务状态:"
docker compose -p repo-prod ps
