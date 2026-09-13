import nodemailer from "nodemailer";

export const sendFrom = "413114463@qq.com";

// SMTP 客户端：生产环境替换为真实邮箱配置（移植自 repo_backend utils/mailer）
const mailer = nodemailer.createTransport({
  host: "smtp.qq.com",
  port: 465,
  secure: true, // 465 用 true，587 用 false
  auth: {
    user: sendFrom,
    pass: process.env.QQ_EMAIL_PASSWORD,
  },
});

export const mailFrom = `"仓库系统" <${sendFrom}>`;

export const sendEmail = async (
  to: string,
  subject: string,
  text: string,
  html?: string,
) => {
  return mailer.sendMail({
    from: mailFrom,
    to,
    subject,
    text,
    html: html ?? text,
  });
};
