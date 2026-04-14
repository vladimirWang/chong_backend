import nodemailer from "nodemailer";

// Create a transporter using Ethereal test credentials.
// For prod, replace with your actual SMTP server details.
const mailer = nodemailer.createTransport({
  host: "smtp.qq.com",
  port: 465,
  secure: true, // Use true for port 465, false for port 587
  auth: {
    user: "413114463@qq.com",
    pass: process.env.QQ_EMAIL_PASSWORD,
  },
});

const mailFrom = '"仓库系统" <413114463@qq.com>';

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
