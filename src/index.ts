import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import cron from 'node-cron'
import prisma from './utils/prisma'
import { getClickhouse, initClickhouse, ACCESS_LOG_TABLE } from './utils/clickhouse'
import { connectRedis } from './utils/redis'
import { apiRouter } from './router'
import { HttpError } from './models/HttpError'
import { errorCode } from './models/Response'
import { createModuleLogger } from './utils/logger'
import { autoApprovePendingApplications } from './modules/applicant/applicantService'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
const isProd = process.env.NODE_ENV === 'production'
const logger = createModuleLogger('http')
const app = new Hono()

// 全局异常：业务可预期的 HttpError → 对应状态码 + ErrorResponse；其余 500
app.onError((err, c) => {
  if (err instanceof HttpError) {
    return c.json(
      { code: err.code, message: err.message, data: err.data },
      err.status as ContentfulStatusCode,
    )
  }
  logger.error(`未捕获异常: ${err instanceof Error ? err.stack ?? err.message : String(err)}`)
  return c.json({ code: errorCode.INTERNAL_ERROR, message: '服务器内部错误', data: null }, 500)
})

app.use('*', async (c, next) => {
  // ========= 请求进来：前置拦截逻辑（路由执行之前） =========
  logger.debug('收到请求', { method: c.req.method, path: c.req.path })
  const start = performance.now()
  await next() // 放行，进入后续中间件/路由

  const duration = Math.round(performance.now() - start)
  // ========= 响应返回：后置拦截逻辑（路由执行完之后） =========
  logger.info('响应状态码', { status: c.res.status, method: c.req.method, duration: `${duration}ms`, path: c.req.path })
})

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

// 静态资源：上传的文件存于 public/uploads（商品图、租户 logo 等），通过 /uploads/* 直接访问
app.use('/uploads/*', serveStatic({ root: './public' }))

app.route('/nodejs_api', apiRouter)

app.post("/test-clickhouse", async (c) => {
  const ch = getClickhouse()
  if (!ch) {
    return c.json({ ok: false, error: "CLICKHOUSE_URL 未配置" })
  }
  const start = performance.now()
  // ClickHouse DateTime（默认 basic 输入格式）不认 ISO8601 的毫秒/Z 后缀，需格式化为 'YYYY-MM-DD HH:MM:SS'
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  // 行结构参考 accessLogPlugin.onAfterHandle：ts/path/method/status/duration/userId/tenantId
  const row = {
    ts,
    path: c.req.path,
    method: c.req.method,
    status: 200,
    duration: Math.round(performance.now() - start),
    userId: 1,
    tenantId: 2,
  }
  try {
    await ch.insert({ table: ACCESS_LOG_TABLE, values: [row], format: "JSONEachRow" })
    return c.json({ ok: true, inserted: row })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return c.json({ ok: false, error: message })
  }
})

// 健康检查：返回 prisma 客户端是否成功连接数据库
app.get("/ping", async (c) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    return c.json({ connected: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return c.json({ connected: false, error: message })
  }
})

await connectRedis()
// await initClickhouse()

Bun.serve({
  port: 4000,
  fetch: app.fetch,
})
logger.info('server: http://localhost:4000')

// 每30分钟自动审核 PENDING 状态的用户账户申请
// 每30分钟执行一次 */30 * * * *
// 每分钟执行一次  * * * * *
cron.schedule(false ? '*/30 * * * *' : '* * * * *', async () => {
  try {
    logger.info('自动审核任务启动', {currentTime: new Date().toISOString()})
    await autoApprovePendingApplications()
  } catch (error) {
    logger.error(`自动审核任务异常: ${error instanceof Error ? error.stack ?? error.message : String(error)}`)
  }
})
logger.info('定时任务已注册：每30分钟自动审核用户申请')
