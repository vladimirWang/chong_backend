#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# --env-file 必须跟在 docker compose 后面，用于 compose 里 ${DATABASE_*} 等变量替换
COMPOSE="docker compose -p repo-prod --env-file ../.env.prod"

# 串行构建（而非 up --build 的并行构建），削平内存/磁盘峰值，
# 避免小内存机器上 BuildKit 同时构建多个镜像导致 OOM/swap 颠簸整机夯死
$COMPOSE build server
# $COMPOSE build image-service
$COMPOSE build nginx

$COMPOSE up -d
