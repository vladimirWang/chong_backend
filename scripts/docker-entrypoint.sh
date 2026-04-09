#!/bin/sh
set -e
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
