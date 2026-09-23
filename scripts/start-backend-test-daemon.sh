#!/bin/bash
# Playwright webServer 包装器：
# 让后端成为独立 session，Playwright 杀自己 fork 的进程组时不会连带杀掉后端。
# 用法：Playwright config 的 webServer.command 设为
#   "cd ../repo_backend && bash scripts/start-backend-test-daemon.sh"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

# 杀旧进程
pkill -f "bun run src/index.ts" 2>/dev/null || true
sleep 1

# 让后端脱离当前 shell：subshell + & + disown，再让 parent 立即退出
# macOS 没有 setsid/timeout，用 bash 原生方式
(
  cd "$DIR"
  nohup bunx dotenv -e .env.test -- bun run src/index.ts \
    > /tmp/repo-backend-test.out.log 2>/tmp/repo-backend-test.err.log \
    </dev/null &
) &
disown
sleep 2  # 让进程 fork 完成

# 等待健康检查（让 Playwright 的 webServer 能探测到 URL 就绪）
for i in $(seq 1 30); do
  if curl -sf http://localhost:4000/ping >/dev/null 2>&1; then
    echo "OK: backend ready on :4000"
    exit 0
  fi
  sleep 1
done
echo "FAIL: backend did not become ready within 30s" >&2
exit 1
