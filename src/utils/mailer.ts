import nodemailer from "nodemailer";

// Create a transporter using Ethereal test credentials.
// For production, replace with your actual SMTP server details.
export const mailer = nodemailer.createTransport({
  host: "smtp.qq.com",
  port: 465,
  secure: true, // Use true for port 465, false for port 587
  auth: {
    user: "413114463@qq.com",
    pass: "jfnwonfcwxvfbhjd",
  },
});

export const mailFrom = '"仓库系统" <413114463@qq.com>'