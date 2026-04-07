# 双目录部署说明（prod / test）

## 服务器目录建议

| 分支 | 服务器路径（示例） | 作用 |
|------|-------------------|------|
| `main` / `master` | `/root/galleryrepo_server/chong_backend_prod` | 生产代码 + **全套** Docker（MySQL、Redis、Nginx、后端 **3000**） |
| `test` | `/root/galleryrepo_server/chong_backend_test` | 测试代码 + **仅**测试后端 Docker（**3001**） |

## 网络与接口

- 生产栈创建固定 Docker 网络 **`gallery_internal`**，Nginx 与 `bun-backend-prod` 在此网络内。
- 测试栈的 `bun-backend-test` **加入同一网络**，Nginx（在生产栈里）通过 `bun-backend-test:3001` 转发 `test.hetou.vip` 的 API。
- 宿主机直连调试：`http://服务器IP:3000`（生产）、`http://服务器IP:3001`（测试）。

## 启动顺序

1. **先**在生产目录执行一次：

   ```bash
   cd /path/to/chong_backend_prod
   ./deploy/prod/start.sh
   # 或在仓库根（等价）:
   # ./start.sh production
   ```

2. **再**在测试目录执行：

   ```bash
   cd /path/to/chong_backend_test
   ./deploy/test/start.sh
   # 或: ./start.sh test
   ```

### 根目录统一入口（推荐本机/单目录习惯）

在仓库根目录可用：

| 命令 | 说明 |
|------|------|
| `./start.sh` / `./start.sh production`（或 `prod`） | 启动生产栈 |
| `./start.sh test` | 启动测试栈 |
| `./start.sh production stop` / `./start.sh test stop` | 停止对应栈 |
| `./start.sh production logs` / `./start.sh test logs` | 跟踪日志 |
| `./start.sh stop` | **兼容旧用法**：视为生产栈的 `stop` |

### 停止服务（`stop.sh`）

| 命令 | 说明 |
|------|------|
| `./stop.sh` / `./stop.sh all` | 停止生产栈 + 测试栈 |
| `./stop.sh production`（或 `prod`） | **仅**停止生产栈（不动 `fullstack-bun-test`） |
| `./stop.sh test` | **仅**停止测试栈 |

若未先起生产栈，测试栈会因找不到 `gallery_internal` 网络而失败。

## 环境文件

- 生产目录需：`/.env.production`（含 `DATABASE_PASSWORD` 等，供 compose 与容器使用）
- 测试目录需：`/.env.test`（`DATABASE_URL` 指向 `gallery_test`、`PORT=3001` 等）

### GitHub 登录（商户 OAuth）

- 后端在仓库 `.env.example` 中已写明生产用 **`GITHUB_REDIRECT_URI=https://hetou.vip/api/auth/github/callback`**（须与 GitHub OAuth App 里 **Authorization callback URL** 一致）。
- 在服务器上的 **`.env.production`** 填写 **`GITHUB_CLIENT_ID`**、**`GITHUB_CLIENT_SECRET`**（仅服务器/密钥管理，勿提交仓库），并设置 **`FRONTEND_URL`**（如 `https://hetou.vip`）。
- Nginx 需将 **`/api/`** 反代到 Bun 后端（仓库 `nginx/nginx.conf` 已包含）；改配置后需重载 Nginx。
- 前端构建若希望「开始授权」走 `/api/auth/github`，可设置 **`VITE_GITHUB_OAUTH_START_URL=https://hetou.vip/api/auth/github`**。

### 常见问题：`./start.sh test` 却提示缺少 `.env.production`

说明脚本**没有进入测试分支**，仍走了生产栈。请依次检查：

1. **服务器上的 `start.sh` 是否已更新**（需含「识别 `test` 再 `exec deploy/test/start.sh`」的逻辑）；重新 `git pull` / rsync 后再试。
2. **不要用 `sh ./start.sh test`**，请直接 **`./start.sh test`**（shebang 为 bash）。
3. 若文件是 **Windows 换行（CRLF）**，可能导致参数识别失败；可在服务器执行 `sed -i 's/\r$//' start.sh` 或重新拉取 LF 版本。

正确行为：`./start.sh test` **只会**检查 **`.env.test`**（由 `deploy/test/start.sh` 检查）。

## 前端静态资源

Nginx 仍从生产栈挂载 `FRONTEND_DIST_PROD`、`FRONTEND_DIST_TEST`（默认相对仓库根的 `frontend-dist-prod` / `frontend-dist-test`，可在启动前 `export` 覆盖）。

## CI

推送 `main`/`master` → rsync 到生产目录并执行 `./start.sh production`（或 `./deploy/prod/start.sh`）；  
推送 `test` → rsync 到测试目录并执行 `./start.sh test`（或 `./deploy/test/start.sh`）。

## 从旧单目录迁移

若你之前使用单一路径（例如 `/root/galleryrepo_server/chong_backend`）：

1. 在服务器创建 `chong_backend_prod`、`chong_backend_test` 两个目录（或沿用你在 CI 里配置的路径）。
2. 生产目录：`git checkout main`，放入 `.env.production`，执行 `./start.sh production`。
3. 测试目录：`git checkout test`，放入 `.env.test`，再执行 `./start.sh test`。
4. MySQL 数据卷在生产栈的 `mysql_data` 中；不要随意删卷，除非你愿意重建库。

## Redis 建议

生产、测试共用同一 Redis 容器时，建议在 `.env.production` / `.env.test` 中使用不同逻辑库，例如 `redis://redis:6379/0` 与 `redis://redis:6379/1`。
