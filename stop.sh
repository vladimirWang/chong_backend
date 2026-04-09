#!/usr/bin/env bash
# 停止 Docker 服务（在仓库根运行）
#
# 用法:
#   ./stop.sh                  # 停止生产栈 + 测试栈（等同 ./stop.sh all）
#   ./stop.sh production       # 仅停止生产栈（MySQL / Redis / Nginx / 后端 3000）
#   ./stop.sh prod             # 同上（别名）
#   ./stop.sh test             # 仅停止测试栈（后端 3001）
#   ./stop.sh all              # 显式：全部停止
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

MODE="all"
if [[ "${1:-}" == "prod" || "${1:-}" == "production" ]]; then
  MODE="production"
  shift
elif [[ "${1:-}" == "test" ]]; then
  MODE="test"
  shift
elif [[ "${1:-}" == "all" ]]; then
  MODE="all"
  shift
fi

rm_container_if_exists() {
  local c="$1"
  if docker ps -a -q -f "name=^${c}$" 2>/dev/null | grep -q .; then
    echo "   移除 $c..."
    docker rm -f "$c" 2>/dev/null || true
  fi
}

case "$MODE" in
  production)
    echo "🛑 停止生产栈..."
    docker compose -f deploy/prod/docker-compose.yml --env-file .env.production down 2>/dev/null || true
    docker compose -f docker-compose.yml --env-file .env.production down 2>/dev/null || true
    for c in fullstack-mysql fullstack-redis fullstack-bun fullstack-bun-prod fullstack-nginx; do
      rm_container_if_exists "$c"
    done
    echo "✅ 生产栈已停止（测试栈 fullstack-bun-test 未动）"
    ;;
  test)
    echo "🛑 停止测试栈..."
    docker compose -f deploy/test/docker-compose.yml --env-file .env.test down 2>/dev/null || true
    rm_container_if_exists fullstack-bun-test
    echo "✅ 测试栈已停止"
    ;;
  all)
    echo "🛑 停止生产栈与测试栈..."
    CONTAINERS="fullstack-mysql fullstack-redis fullstack-bun fullstack-bun-prod fullstack-nginx fullstack-mysql-test fullstack-redis-test fullstack-bun-test fullstack-nginx-test"
    docker compose -f deploy/prod/docker-compose.yml --env-file .env.production down 2>/dev/null || true
    docker compose -f deploy/test/docker-compose.yml --env-file .env.test down 2>/dev/null || true
    docker compose -f docker-compose.yml --env-file .env.production down 2>/dev/null || true
    for c in $CONTAINERS; do
      rm_container_if_exists "$c"
    done
    echo "✅ 已全部停止"
    ;;
esac
