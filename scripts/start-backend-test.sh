#!/usr/bin/env bash
# 启动 Hono 后端（测试环境，用 .env.test）
# 支持在任何目录执行，自动切到 repo_backend
set -euo pipefail

# 脚本在 repo_backend/scripts/ 下，父级是 repo_backend
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIR="${1:-$(cd "$SCRIPT_DIR/.." && pwd)}"
cd "$DIR"

# 杀旧进程
pkill -f "bun run src/index.ts" 2>/dev/null || true
sleep 1

echo "Starting Hono server on :4000..."
nohup bunx dotenv -e .env.test -- bun run src/index.ts > /tmp/backend.log 2>&1 &
echo $! > /tmp/backend.pid

# 等待健康检查
for i in $(seq 1 30); do
	if curl -sf http://localhost:4000/ping >/dev/null 2>&1; then
		echo "OK: backend ready on :4000 (PID=$(cat /tmp/backend.pid))"
		exit 0
	fi
	sleep 1
done
echo "FAIL: backend did not become ready within 30s" >&2
	tail -20 /tmp/backend.log >&2
	exit 1
