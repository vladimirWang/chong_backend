# 阶段 1：构建前端（需从 repo_backend 的父目录执行，保证 repo_frontend 与 repo_backend 同级）
FROM node:20-alpine AS frontend-builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY repo_frontend/ ./
RUN pnpm install --frozen-lockfile && pnpm run build

# 阶段 2：Nginx 镜像（内含前端构建产物）
FROM nginx:alpine
COPY --from=frontend-builder /app/dist /usr/share/nginx/html
COPY repo_backend/nginx/nginx.conf /etc/nginx/nginx.conf
