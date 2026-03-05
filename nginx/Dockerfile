# 阶段 1：构建前端，通过 build-arg 传入前后端目录名以适配不同部署
ARG FRONTEND_DIR=repo_frontend
ARG BACKEND_DIR=repo_backend
FROM node:20-alpine AS frontend-builder
ARG FRONTEND_DIR
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY ${FRONTEND_DIR}/ ./
RUN pnpm install --frozen-lockfile && pnpm run build

# 阶段 2：Nginx 镜像（内含前端构建产物）
FROM nginx:alpine
ARG BACKEND_DIR
COPY --from=frontend-builder /app/dist /usr/share/nginx/html
COPY ${BACKEND_DIR}/nginx/nginx.conf /etc/nginx/nginx.conf
