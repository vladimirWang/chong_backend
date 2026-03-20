#!/usr/bin/env bash
# 生产栈启动：MySQL + Redis + Nginx + 后端 3000
# 请在仓库根目录执行，或任意路径: bash deploy/prod/start.sh
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

ENV_FILE="${ENV_FILE:-.env.production}"
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ 错误: 未找到 $ENV_FILE（相对仓库根），请创建并配置 DATABASE_PASSWORD、JWT_SECRET 等"
  exit 1
fi
COMPOSE=(docker compose -f deploy/prod/docker-compose.yml --env-file "$ENV_FILE")

export LOG_DIR="${LOG_DIR:-/var/log/galleryrepo}"
export HOST_LOG_DIR="${HOST_LOG_DIR:-${REPO_ROOT}/logs/galleryrepo}"
export FRONTEND_DIST_PROD="${FRONTEND_DIST_PROD:-$(cd "$REPO_ROOT/.." && pwd)/frontend-dist-prod}"
export FRONTEND_DIST_TEST="${FRONTEND_DIST_TEST:-$(cd "$REPO_ROOT/.." && pwd)/frontend-dist-test}"

ensure_frontend_dist() {
  local target_dir="$1"
  local domain_hint="$2"
  if [ ! -f "${target_dir}/index.html" ]; then
    echo "⚠️  前端目录无 index.html: $target_dir"
    echo "   请将构建后的 dist 内容放到该目录（${domain_hint}）"
    mkdir -p "${target_dir}"
    echo "<!DOCTYPE html><html><body><h1>前端未部署</h1><p>${domain_hint} 对应目录未上传 dist 内容</p></body></html>" > "${target_dir}/index.html"
    echo "   已创建占位页"
  fi
}

ensure_frontend_dist "${FRONTEND_DIST_PROD}" "www.hetou.vip"
ensure_frontend_dist "${FRONTEND_DIST_TEST}" "test.hetou.vip"

case "${1:-}" in
  stop)
    echo "🛑 停止生产栈..."
    "${COMPOSE[@]}" down
    echo "✅ 已停止"
    ;;
  logs)
    "${COMPOSE[@]}" logs -f
    ;;
  debug)
    echo "🐛 前台启动生产栈（Ctrl+C 退出）..."
    for c in fullstack-mysql fullstack-redis fullstack-bun fullstack-bun-prod fullstack-nginx; do
      docker rm -f "$c" 2>/dev/null || true
    done
    export DOCKER_BUILDKIT=1
    "${COMPOSE[@]}" up --build
    ;;
  *)
    echo "🐳 启动生产栈（含 Nginx 443 + 后端 3000）..."
    echo "   - MySQL:  localhost:3307"
    echo "   - Redis:  localhost:6379"
    echo "   - Nginx:  80/443"
    echo "   - Bun 生产: localhost:3000"
    echo ""

    mkdir -p "${HOST_LOG_DIR}" && chmod 777 "${HOST_LOG_DIR}" 2>/dev/null || true

    # 不删除 fullstack-bun-test，避免重启生产栈时误杀测试目录起的后端
    for c in fullstack-mysql fullstack-redis fullstack-bun fullstack-bun-prod fullstack-nginx; do
      docker rm -f "$c" 2>/dev/null || true
    done

    for port in 80 443 3000; do
      pid=""
      run_with_timeout() { command -v timeout >/dev/null 2>&1 && timeout 1 "$@" || "$@"; }
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

    echo "📦 构建镜像..."
    export DOCKER_BUILDKIT=1
    "${COMPOSE[@]}" build
    echo "🚀 启动容器..."
    "${COMPOSE[@]}" up -d --remove-orphans

    echo ""
    sleep 3
    echo "当前容器状态:"
    docker ps -a --filter "name=fullstack-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || true
    echo ""
    echo "测试栈请在「测试目录」执行: ./start.sh test（或 ./deploy/test/start.sh）"
    echo "查看日志: ./start.sh production logs"
    echo "停止: ./stop.sh production"
    ;;
esac
