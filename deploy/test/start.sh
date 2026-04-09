#!/usr/bin/env bash
# 测试栈：独立运行（MySQL + Redis + Nginx(8080/8443) + 后端 3001）
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

ENV_FILE="${ENV_FILE:-.env.test}"
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ 错误: 未找到 $ENV_FILE（相对仓库根），请先创建测试环境变量文件"
  exit 1
fi

COMPOSE=(docker compose -f deploy/test/docker-compose.yml --env-file "$ENV_FILE")

# 与生产栈区分宿主机日志目录，避免 compose 插值与 env_file 混用同一路径
export LOG_DIR="${LOG_DIR:-/var/log/galleryrepo_test}"
export HOST_LOG_DIR="${HOST_LOG_DIR:-${REPO_ROOT}/logs/galleryrepo_test}"
export FRONTEND_DIST_TEST="${FRONTEND_DIST_TEST:-/root/gallery/test/frontend-dist}"

ensure_frontend_dist() {
  local target_dir="$1"
  local hint="$2"
  if [ ! -f "${target_dir}/index.html" ]; then
    echo "⚠️  前端目录无 index.html: $target_dir"
    echo "   请将构建后的 dist 内容放到该目录（${hint}）"
    mkdir -p "${target_dir}"
    echo "<!DOCTYPE html><html><body><h1>前端未部署</h1><p>${hint} 对应目录未上传 dist 内容</p></body></html>" > "${target_dir}/index.html"
    echo "   已创建占位页"
  fi
}

ensure_frontend_dist "${FRONTEND_DIST_TEST}" "test(8080/8443)"

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
    echo "🐳 启动测试栈（Nginx 8080/8443 + 后端 3001 + MySQL 3308 + Redis 6380）..."
    mkdir -p "${HOST_LOG_DIR}" && chmod 777 "${HOST_LOG_DIR}" 2>/dev/null || true
    for c in fullstack-mysql-test fullstack-redis-test fullstack-bun-test fullstack-nginx-test; do
      docker rm -f "$c" 2>/dev/null || true
    done

    pid=""
    run_with_timeout() { command -v timeout >/dev/null 2>&1 && timeout 1 "$@" || "$@"; }
    for port in 3001 8080 8443 3308 6380; do
      pid=""
      if command -v fuser >/dev/null 2>&1; then
        pid=$(run_with_timeout fuser "$port/tcp" 2>&1 | cut -d: -f2 | tr -d ' \n' || true)
      fi
      [ -z "$pid" ] && pid=$(run_with_timeout lsof -ti :"$port" 2>/dev/null || true)
      if [ -n "$pid" ]; then
        echo "   端口 $port 被占用 (PID $pid)，正在释放..."
        kill -9 $pid 2>/dev/null || true
        sleep 1
      fi
    done

    export DOCKER_BUILDKIT=1
    "${COMPOSE[@]}" build
    "${COMPOSE[@]}" up -d --remove-orphans

    echo ""
    sleep 2
    echo "当前测试栈容器:"
    "${COMPOSE[@]}" ps -a 2>/dev/null || true
    echo ""
    echo "查看日志: ./deploy/test/start.sh logs"
    echo "停止: ./deploy/test/start.sh stop"
    ;;
esac
