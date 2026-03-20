#!/usr/bin/env bash
# 测试栈：仅启动后端 3001，依赖生产栈已创建网络 gallery_internal
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

ENV_FILE="${ENV_FILE:-.env.test}"
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ 错误: 未找到 $ENV_FILE（相对仓库根），请先创建测试环境变量文件"
  exit 1
fi

if ! docker network inspect gallery_internal >/dev/null 2>&1; then
  echo "❌ 未找到 Docker 网络 gallery_internal。"
  echo "   请先在「生产目录」执行: ./deploy/prod/start.sh"
  exit 1
fi

COMPOSE=(docker compose -f deploy/test/docker-compose.yml --env-file "$ENV_FILE")

export LOG_DIR="${LOG_DIR:-/var/log/galleryrepo}"
export HOST_LOG_DIR="${HOST_LOG_DIR:-${REPO_ROOT}/logs/galleryrepo}"

case "${1:-}" in
  stop)
    echo "🛑 停止测试栈..."
    "${COMPOSE[@]}" down
    echo "✅ 已停止"
    ;;
  logs)
    "${COMPOSE[@]}" logs -f
    ;;
  debug)
    echo "🐛 前台启动测试栈（Ctrl+C 退出）..."
    docker rm -f fullstack-bun-test 2>/dev/null || true
    export DOCKER_BUILDKIT=1
    "${COMPOSE[@]}" up --build
    ;;
  *)
    echo "🐳 启动测试栈（后端 3001，加入 gallery_internal）..."
    mkdir -p "${HOST_LOG_DIR}" && chmod 777 "${HOST_LOG_DIR}" 2>/dev/null || true
    docker rm -f fullstack-bun-test 2>/dev/null || true

    pid=""
    run_with_timeout() { command -v timeout >/dev/null 2>&1 && timeout 1 "$@" || "$@"; }
    if command -v fuser >/dev/null 2>&1; then
      pid=$(run_with_timeout fuser 3001/tcp 2>&1 | cut -d: -f2 | tr -d ' \n' || true)
    fi
    [ -z "$pid" ] && pid=$(run_with_timeout lsof -ti :3001 2>/dev/null || true)
    if [ -n "$pid" ]; then
      echo "   端口 3001 被占用 (PID $pid)，正在释放..."
      kill -9 $pid 2>/dev/null || true
      sleep 1
    fi

    export DOCKER_BUILDKIT=1
    "${COMPOSE[@]}" build
    "${COMPOSE[@]}" up -d --remove-orphans

    echo ""
    sleep 2
    docker ps -a --filter "name=fullstack-bun-test" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || true
    echo ""
    echo "查看日志: ./deploy/test/start.sh logs"
    echo "停止: ./deploy/test/start.sh stop"
    ;;
esac
