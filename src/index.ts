import { Hono } from 'hono'
import prisma from './utils/prisma'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
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

Bun.serve({
  port: 4000,
  fetch: app.fetch,
})
console.log("server: http://localhost:4000")
