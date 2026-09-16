# 使用官方 Bun 镜像
FROM oven/bun:1.4-alpine

WORKDIR /app

# 复制依赖文件
COPY package.json bun.lock* ./

# 安装依赖（排除 devDependencies 中的 prisma 等，生产用 @prisma/client）
RUN bun install --frozen-lockfile

# 复制 Prisma schema 并生成 client
COPY prisma ./prisma
RUN bunx prisma generate

# 复制入口脚本（位于 deploy/ 目录）
COPY deploy/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# 复制源码
COPY . .

# 日志输出目录（compose 会挂载宿主机目录覆盖）
RUN mkdir -p /var/log/galleryrepo_server /var/log/galleryrepo_worker
# 上传目录兜底（生产由 compose 挂载宿主机卷覆盖；未挂载时代码也会自行 mkdir）
RUN mkdir -p /app/public/uploads

# COPY scripts/docker-entrypoint.sh /app/docker-entrypoint.sh
# RUN chmod +x /app/docker-entrypoint.sh

# EXPOSE 3000

# # 使用生产模式运行
# ENV NODE_ENV=production
# CMD ["/app/docker-entrypoint.sh"]
ENTRYPOINT ["./docker-entrypoint.sh"]
# CMD ["bunx", "dotenv", "-e", ".env.prod", "--", "bun", "run", "src/index.ts"]
# CMD ['npm', 'run', 'start']
CMD ["bun", "run", "src/index.ts"]

