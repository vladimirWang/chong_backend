#!/bin/sh
set -e

echo "Running prisma migrate deploy..."
# bunx dotenv -e "$ENV_FILE" -- prisma migrate deploy
bunx prisma migrate deploy

# seed 只在显式要求时执行（RUN_SEED=true），避免每次容器重启都走一遍种子逻辑
if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "RUN_SEED=true, running prisma db seed..."
  # bunx dotenv -e "$ENV_FILE" -- prisma db seed
  bunx prisma db seed
else
  echo "Skipping prisma db seed (set RUN_SEED=true to run it manually)."
fi

exec "$@"
