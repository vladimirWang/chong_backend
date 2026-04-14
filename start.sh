#!/usr/bin/env bash
# set -euo pipefail

# cd "$(dirname "$0")"
# --env-file 必须跟在 docker compose 后面，用于 compose 里 ${DATABASE_*} 等变量替换
docker compose -p repo-prod -f ../server/docker-compose.yml --env-file ./server/.env.prod up -d --build
