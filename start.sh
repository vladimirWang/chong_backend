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

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 日志目录：容器内与宿主机映射，未设置时使用默认值
# HOST_LOG_DIR 默认用项目下 ./logs/galleryrepo，避免 /var/log 需 root 权限
export LOG_DIR="${LOG_DIR:-/var/log/galleryrepo}"
export HOST_LOG_DIR="${HOST_LOG_DIR:-${SCRIPT_DIR}/logs/galleryrepo}"

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

    # 若 80/3000 被占用，尝试释放（可能是残留进程）
    for port in 80 3000; do
      pid=$(lsof -ti :"$port" 2>/dev/null || true)
      if [ -n "$pid" ]; then
        echo "   端口 $port 被占用 (PID $pid)，正在释放..."
        kill -9 $pid 2>/dev/null || true
        sleep 1
      fi
    done

    docker compose up -d --build

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
    echo "查看日志: ./start.sh logs"
    echo "停止服务: ./start.sh stop"
    ;;
esac
