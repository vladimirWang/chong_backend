#!/bin/sh
set -e

echo "Running prisma migrate deploy..."
# bunx dotenv -e "$ENV_FILE" -- prisma migrate deploy
bunx prisma migrate deploy

echo "Running prisma db seed..."
# bunx dotenv -e "$ENV_FILE" -- prisma db seed
bunx prisma db seed

exec "$@"
