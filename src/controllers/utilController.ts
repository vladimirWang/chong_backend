import { mailer, mailFrom } from "../utils/mailer";
import { SuccessResponse, ErrorResponse, errorCode } from "../models/Response";
import {redisClient} from '../utils/redis'
import {SendVerification, CheckEmailValidation} from '../validators/utilValidator'

const emailVerificationTag = 'register:emailVerification'
export const sendEmailVerificationCode = async ({body}: {body: SendVerification}) => {
  const redisKey = `${emailVerificationTag}:${body.email}`
  // 如果有还未过期的验证码，先删除
  await redisClient.del(redisKey)
  const rnd = Math.random()
  const verificationCode = (rnd+'').slice(2, 6)
  const info = await mailer.sendMail({
    from: mailFrom,
    to: body.email,
    subject: "仓库系统邮箱验证",
    text: `仓库系统邮箱验证码: ${verificationCode}`, // Plain-text version of the message
    html: `<b>验证码是： ${verificationCode}</b>`, // HTML version of the message
  });
  await redisClient.setEx(redisKey, 10*60, verificationCode)

  return JSON.stringify(new SuccessResponse(null, "邮件发送成功"));
};

// 校验邮箱是否有效
export const checkEmailValidation = async ({body}: {body: CheckEmailValidation}) => {
  const {verifyCode, email} = body
  
  const redisKey = `${emailVerificationTag}:${email}`
  const storedVerifyCode = await redisClient.get(redisKey)
  if (storedVerifyCode !== verifyCode) {
    return JSON.stringify(new ErrorResponse(errorCode.EMAIL_VALIDATION_FAIL, "邮箱验证失败"))
  }
  await redisClient.del(redisKey)

  return JSON.stringify(new SuccessResponse(null, "邮件验证通过"));
};


