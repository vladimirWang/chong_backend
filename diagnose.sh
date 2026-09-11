#!/bin/bash
# 诊断脚本：排查 Docker 服务无法启动的原因
# 在 repo_backend 目录运行

set -e
cd "$(dirname "$0")"

echo "=== 1. 检查 Docker 是否运行 ==="
docker info >/dev/null 2>&1 || { echo "❌ Docker 未运行，请先启动 Docker Desktop"; exit 1; }
echo "✅ Docker 正常"
echo ""

echo "=== 2. 当前容器状态 ==="
docker ps -a --filter "name=fullstack-" --format "table {{.Names}}\t{{.Status}}\t{{.CreatedAt}}" 2>/dev/null
echo ""

echo "=== 3. 尝试前台启动（可看到实时日志，Ctrl+C 退出）==="
echo "运行: docker compose up --build"
echo "若容器启动后立即退出，错误会显示在上方"
echo ""
read -p "按回车开始前台启动..." _ 

docker compose up --build
