#!/usr/bin/env bash
# 在仓库根启动/停止指定栈（分目录部署：prod / test）
#
# 用法:
#   ./start.sh                    # 默认生产栈（等同 ./start.sh production）
#   ./start.sh production         # 生产栈：MySQL + Redis + Nginx + 后端 3000
#   ./start.sh prod               # 同上（别名）
#   ./start.sh test               # 测试栈：仅后端 3001（需先有生产栈创建 gallery_internal）
#   ./start.sh production stop    ./start.sh test stop
#   ./start.sh production logs    ./start.sh test logs
#   ./start.sh production debug   ./start.sh test debug
#
# 兼容旧写法（未写 production/test 时视为生产栈）:
#   ./start.sh stop | logs | debug
set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

STACK="prod"
if [[ "${1:-}" == "prod" || "${1:-}" == "production" ]]; then
  STACK="prod"
  shift
elif [[ "${1:-}" == "test" ]]; then
  STACK="test"
  shift
fi

exec bash "deploy/${STACK}/start.sh" "$@"
