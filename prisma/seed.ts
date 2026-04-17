import prisma from "../src/utils/prisma";

const ANONYMOUS_EMAIL = process.env.ANONYMOUS_EMAIL;
const ANONYMOUS_USERNAME = process.env.ANONYMOUS_USERNAME;
const ANONYMOUS_PASSWORD = process.env.ANONYMOUS_PASSWORD;
const ANONYMOUS_SALT = process.env.ANONYMOUS_SALT;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_SALT = process.env.ADMIN_SALT;

async function upsertAdminUser(data: {
  email: string;
  username: string;
  password: string;
  salt: string;
}) {
  return prisma.adminUser.upsert({
    where: { email: data.email },
    create: {
      email: data.email,
      username: data.username,
      password: data.password,
      salt: data.salt,
    },
    update: {
      username: data.username,
      password: data.password,
      salt: data.salt,
    },
  });
}

async function main() {
  await prisma.$connect();
  // 顺序执行，避免两个 upsert 同时抢连接池导致 @prisma/adapter-mariadb 在刚建连时超时
  await upsertAdminUser({
    email: ANONYMOUS_EMAIL!,
    username: ANONYMOUS_USERNAME!,
    password: ANONYMOUS_PASSWORD!,
    salt: ANONYMOUS_SALT!,
  });
  await upsertAdminUser({
    email: ADMIN_EMAIL!,
    username: ADMIN_USERNAME!,
    password: ADMIN_PASSWORD!,
    salt: ADMIN_SALT!,
  });
}

async function run() {
  try {
    await main();
    await prisma.$disconnect();
    process.exit(0);
  } catch {
    await prisma.$disconnect();
    process.exit(1);
  }
}

run();
