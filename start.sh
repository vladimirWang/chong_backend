#!/usr/bin/env bash
# 在仓库根启动/停止指定栈（分目录部署：prod / test）
# 请用 bash 执行：./start.sh test（勿用 sh start.sh，避免 [[ ]] 等行为不一致）
#
# 用法:
#   ./start.sh                    # 默认生产栈（等同 ./start.sh production）
#   ./start.sh production         # 生产栈：MySQL + Redis + Nginx + 后端 3000
#   ./start.sh prod               # 同上（别名）
#   ./start.sh test               # 测试栈：独立网络与数据卷（与生产栈并行互不影响）
#   ./start.sh production stop    ./start.sh test stop
#   ./start.sh production logs    ./start.sh test logs
#   ./start.sh production debug   ./start.sh test debug
#
# 兼容旧写法（未写 production/test 时视为生产栈）:
#   ./start.sh stop | logs | debug
set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

# 去掉 Windows 换行 \r，避免因 CRLF 导致无法识别 test，误走生产栈去要 .env.production
FIRST_RAW="${1:-}"
FIRST="${FIRST_RAW//$'\r'/}"
FIRST_LC=$(printf '%s' "$FIRST" | tr '[:upper:]' '[:lower:]')

STACK="prod"
case "$FIRST_LC" in
  prod|production)
    STACK="prod"
    shift
    ;;
  test)
    STACK="test"
    shift
    ;;
esac

exec bash "deploy/${STACK}/start.sh" "$@"
