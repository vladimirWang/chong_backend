/** RabbitMQ 拓扑常量（移植自 repo_backend config/rabbitmq） */
export const applicantExchange = "repo.applicant";
export const applicationApproveQueue = "application.approve";
export const applicationApproveRoutingKey = "application.approve";

/**
 * 死信拓扑：业务队列中「不可重试」或「超过最大重试次数」的消息，
 * 经 channel.nack(msg, false, false) 由 broker 自动转发到死信交换机，
 * 最终落入死信队列隔离保存，供人工排查 / 修复后重新投递。
 */
export const applicationApproveDlx = "application.approve.dlx";
export const applicationApproveDlq = "application.approve.dlq";

/**
 * 可重试错误（SMTP 暂时不可用、DB 短暂超时等）的最大失败次数。
 * 本次失败后 failCount 达到该值即进死信队列，不再 requeue。
 */
export const MAX_RETRY = 5;
