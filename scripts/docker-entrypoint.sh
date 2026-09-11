#!/bin/sh
set -e
# 避免 compose healthcheck 刚通过但跨容器连接仍瞬时失败导致 Prisma P1001
bun run scripts/wait-for-mysql.ts
bunx prisma migrate deploy

# seed 在刚迁移后偶发连接池超时（并发 upsert + 适配器建连），失败则短暂退避重试
i=0
while [ "$i" -lt 5 ]; do
  if bunx prisma db seed; then
    break
  fi
  i=$((i + 1))
  if [ "$i" -eq 5 ]; then
    echo "db seed failed after 5 attempts"
    exit 1
  fi
  echo "db seed failed, retry $i/5 in 5s..."
  sleep 5
done

exec bun run src/index.ts
