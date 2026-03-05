#!/bin/bash
# 启动脚本：使用 Docker Compose 启动 Bun 服务
# 需要本地安装 Docker 28.x
# 请在 repo_backend 目录下运行
#
# 用法:
#   ./start.sh        - 构建并启动所有服务
#   ./start.sh stop   - 停止所有服务
#   ./start.sh logs   - 查看实时日志
#   ./start.sh debug  - 前台启动（可看到错误输出，Ctrl+C 退出）
#
# 环境变量（可选，在运行前 export 覆盖默认值）:
#   LOG_DIR         - 容器内日志目录，默认 /var/log/galleryrepo
#   HOST_LOG_DIR    - 宿主机日志目录（挂载卷），默认 ./logs/galleryrepo
#   FRONTEND_DIST   - 前端打包产物目录（手动 pnpm run build 后上传 dist 内容），默认 ../frontend-dist（后端目录外，避免 git 操作误删）

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 日志目录：容器内与宿主机映射，未设置时使用默认值
export LOG_DIR="${LOG_DIR:-/var/log/galleryrepo}"
export HOST_LOG_DIR="${HOST_LOG_DIR:-${SCRIPT_DIR}/logs/galleryrepo}"

# 前端静态文件目录：默认置于后端目录外（../frontend-dist），避免 git reset 等操作误删
export FRONTEND_DIST="${FRONTEND_DIST:-$(cd "$SCRIPT_DIR/.." && pwd)/frontend-dist}"
if [ ! -f "${FRONTEND_DIST}/index.html" ]; then
  echo "⚠️  前端目录无 index.html: $FRONTEND_DIST"
  echo "   请本地执行 pnpm run build 后，将 dist/ 内容上传到该目录（置于后端目录外，不受 git 影响）"
  mkdir -p "${FRONTEND_DIST}"
  echo '<!DOCTYPE html><html><body><h1>前端未部署</h1><p>请本地 pnpm run build，将 dist/ 内容上传到 frontend-dist/ 后重启</p></body></html>' > "${FRONTEND_DIST}/index.html"
  echo "   已创建占位页，可先启动服务（目录在后端外，git 操作不影响）"
fi

case "${1:-}" in
  stop)
    echo "🛑 停止 Docker 服务..."
    docker compose down
    echo "✅ 服务已停止"
    ;;
  logs)
    docker compose logs -f
    ;;
  debug)
    echo "🐛 前台启动（查看实时日志，Ctrl+C 退出）..."
    for c in fullstack-mysql fullstack-redis fullstack-bun fullstack-nginx; do
      docker rm -f "$c" 2>/dev/null || true
    done
    docker compose up --build
    ;;
  *)
    echo "🐳 启动 Docker 服务..."
    echo "   - MySQL:    localhost:3307"
    echo "   - Redis:    localhost:6379"
    echo "   - Nginx:    http://localhost:80 (前端 + API 入口)"
    echo "   - Bun:      http://localhost:3000 (直连调试用)"
    echo ""

    # 确保宿主机日志目录存在且可写，避免容器内 EACCES
    mkdir -p "${HOST_LOG_DIR}" && chmod 777 "${HOST_LOG_DIR}" 2>/dev/null || true

    # 启动前移除可能存在的旧容器，避免名称冲突
    for c in fullstack-mysql fullstack-redis fullstack-bun fullstack-nginx; do
      docker rm -f "$c" 2>/dev/null || true
    done

    # 若 80/3000 被占用，尝试释放（兼容 Ubuntu，timeout 1s 防 lsof/fuser 卡住）
    for port in 80 3000; do
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
    docker compose build
    echo "🚀 启动容器..."
    docker compose up -d

    echo ""
    echo "等待容器就绪..."
    sleep 3
    echo ""
    echo "当前容器状态:"
    docker ps -a --filter "name=fullstack-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || docker ps -a | grep fullstack || true
    echo ""
    if docker ps -q --filter "name=fullstack-" 2>/dev/null | grep -q .; then
      echo "✅ 服务已启动"
    else
      echo "⚠️ 容器可能未成功运行，请执行以下命令排查:"
      echo "   查看日志: ./start.sh logs"
      echo "   查看退出原因: docker compose ps -a"
    fi
    echo ""
    echo "前端部署：本地 cd repo_frontend && pnpm run build，将 dist/ 内容上传到 ${FRONTEND_DIST}"
    echo "查看日志: ./start.sh logs"
    echo "停止服务: ./start.sh stop"
    ;;
esac
