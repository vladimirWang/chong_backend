import amqp from 'amqplib'
import prisma from './utils/prisma'
import {sendEmail, mailFrom} from './utils/mailer'
import {applicantExchange, applicationApproveQueue, applicationApproveRoutingKey} from './config/rabbitmq'


async function startWorker() {
    const url = process.env.RABBITMQ_URL!
    const conn = await amqp.connect(url)
    const channel = await conn.createChannel()
    await channel.assertExchange(applicantExchange, 'topic', {
      durable: true,
    })
    // 声明队列并绑定到 exchange 的 routing key，保证队列存在且能收到消息
    await channel.assertQueue(applicationApproveQueue, { durable: true })
    await channel.bindQueue(applicationApproveQueue, applicantExchange, applicationApproveRoutingKey)

    await channel.prefetch(1) // 一次只处理一条，处理完 ack 后再取
    await channel.consume(applicationApproveQueue, async msg => {
        if (!msg) return
        const deliveryTag = msg.fields.deliveryTag
        try {
            const value = msg.content.toString()
            console.log('[worker] Received message:', value)
            let parsed
            try {
                parsed = JSON.parse(value)
            } catch {
                throw new Error('消息格式错误：非 JSON')
            }
            if (!parsed?.mailId) throw new Error('消息缺少 mailId')

            const mail = await prisma.mail.findUnique({ where: { id: parsed.mailId } })
            if (!mail) throw new Error(`邮件记录不存在: ${parsed.mailId}`)
            if (!mail.to || !mail.from || !mail.content || !mail.title) {
                throw new Error(`邮件信息不完整: id=${mail.id}`)
            }

            await sendEmail(mail.to, mail.title, mail.content)
            await prisma.mail.update({
                where: { id: parsed.mailId },
                data: { sendAt: new Date() }
            })
            console.log(`[worker] 邮件发送成功: id=${mail.id}, to=${mail.to}`)
            channel.ack(msg) // 成功确认
        } catch (err: any) {
            if (typeof parsed.mailId === 'number' && !isNaN(parsed.mailId)) {
                prisma.mail.update({
                    where: { id: parsed.mailId },
                    data: { failCount: { increment: 1 } }
                })
            }

            console.error('[worker] 消费失败:', err?.message)
            // 失败后 requeue，让消息重新入队等待重试
            channel.nack(deliveryTag, false, true)
        }
    })
}

startWorker()