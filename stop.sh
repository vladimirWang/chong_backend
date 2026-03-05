#!/bin/bash
# 停止 Docker Compose 服务
# 请在 repo_backend 目录下运行

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

CONTAINERS="fullstack-mysql fullstack-redis fullstack-bun fullstack-golang"

echo "🛑 停止 Docker 服务..."
docker compose down 2>/dev/null || true

# 若 compose down 未移除，则按容器名强制停止并删除
for c in $CONTAINERS; do
  if docker ps -a -q -f "name=^${c}$" 2>/dev/null | grep -q .; then
    echo "   移除 $c..."
    docker rm -f "$c" 2>/dev/null || true
  fi
done
echo "✅ 服务已停止"
