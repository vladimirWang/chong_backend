#!/bin/sh
set -e
ENV_FILE="${ENV_FILE:-.env.prod}"
WAIT_TIMEOUT_SEC="${WAIT_TIMEOUT_SEC:-60}"
WAIT_INTERVAL_SEC="${WAIT_INTERVAL_SEC:-2}"

echo "---------------------------------- entrypoint args: $@ ----------------------------------"
echo "Using env file: ${ENV_FILE}"

wait_for_mysql() {
  echo "Waiting for MySQL to be ready..."
  start_ts="$(date +%s)"
  while true; do
    if bunx dotenv -e "$ENV_FILE" -- sh -lc 'echo "SELECT 1;" | prisma db execute --stdin --schema prisma/schema.prisma >/dev/null 2>&1'; then
      echo "MySQL is ready."
      return 0
    fi

    now_ts="$(date +%s)"
    elapsed="$((now_ts - start_ts))"
    if [ "$elapsed" -ge "$WAIT_TIMEOUT_SEC" ]; then
      echo "Timed out waiting for MySQL after ${WAIT_TIMEOUT_SEC}s."
      return 1
    fi
    sleep "$WAIT_INTERVAL_SEC"
  done
}

wait_for_redis() {
  echo "Waiting for Redis to be ready..."
  start_ts="$(date +%s)"
  while true; do
    if bunx dotenv -e "$ENV_FILE" -- bun -e "import { createClient } from '@redis/client'; const c=createClient({ url: process.env.REDIS_URL }); await c.connect(); const pong=await c.ping(); await c.quit(); if(pong!=='PONG') process.exit(1);" >/dev/null 2>&1; then
      echo "Redis is ready."
      return 0
    fi

    now_ts="$(date +%s)"
    elapsed="$((now_ts - start_ts))"
    if [ "$elapsed" -ge "$WAIT_TIMEOUT_SEC" ]; then
      echo "Timed out waiting for Redis after ${WAIT_TIMEOUT_SEC}s."
      return 1
    fi
    sleep "$WAIT_INTERVAL_SEC"
  done
}

wait_for_mysql
wait_for_redis

echo "Running prisma migrate deploy..."
# bunx dotenv -e "$ENV_FILE" -- prisma migrate deploy
bunx prisma migrate deploy

echo "Running prisma db seed..."
# bunx dotenv -e "$ENV_FILE" -- prisma db seed
bunx prisma db seed

exec "$@"
