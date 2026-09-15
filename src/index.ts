import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import prisma from './utils/prisma'
import { getClickhouse, initClickhouse, ACCESS_LOG_TABLE } from './utils/clickhouse'
import { connectRedis } from './utils/redis'
import { apiRouter } from './router'
import { HttpError } from './models/HttpError'
import { errorCode } from './models/Response'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
const app = new Hono()

// 全局异常：业务可预期的 HttpError → 对应状态码 + ErrorResponse；其余 500
app.onError((err, c) => {
  if (err instanceof HttpError) {
    return c.json(
      { code: err.code, message: err.message, data: err.data },
      err.status as ContentfulStatusCode,
    )
  }
  console.error('[onError]', err)
  return c.json({ code: errorCode.INTERNAL_ERROR, message: '服务器内部错误', data: null }, 500)
})

app.use('*', async (c, next) => {
  // ========= 请求进来：前置拦截逻辑（路由执行之前） =========
  console.log('收到请求', c.req.method, c.req.path)
  // 可以在这里做：鉴权、traceId、日志、注入上下文、设置用户信息（对应你GORM的tx.Set）

  await next() // 放行，进入后续中间件/路由

  // ========= 响应返回：后置拦截逻辑（路由执行完之后） =========
  console.log('响应状态码', c.res.status)
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
await initClickhouse()

Bun.serve({
  port: 4000,
  fetch: app.fetch,
})
console.log("server: http://localhost:4000")
