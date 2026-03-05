# 使用官方 Bun 镜像
FROM oven/bun:1.2-alpine

WORKDIR /app

# 复制依赖文件
COPY package.json bun.lock* ./

# 安装依赖（排除 devDependencies 中的 prisma 等，生产用 @prisma/client）
RUN bun install --frozen-lockfile

# 复制 Prisma schema 并生成 client
COPY prisma ./prisma
RUN bunx prisma generate

# 复制源码
COPY . .

# 启动脚本：先同步数据库 schema，再启动服务
RUN echo '#!/bin/sh' > /app/docker-entrypoint.sh && \
    echo 'set -e' >> /app/docker-entrypoint.sh && \
    echo 'bunx prisma db push' >> /app/docker-entrypoint.sh && \
    echo 'exec bun run src/index.ts' >> /app/docker-entrypoint.sh && \
    chmod +x /app/docker-entrypoint.sh

EXPOSE 3000

# 使用生产模式运行
ENV NODE_ENV=production
CMD ["/app/docker-entrypoint.sh"]
