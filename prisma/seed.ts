import prisma from "../src/utils/prisma";

// const ANONYMOUS_EMAIL = process.env.ANONYMOUS_EMAIL;
// const ANONYMOUS_USERNAME = process.env.ANONYMOUS_USERNAME;
// const ANONYMOUS_PASSWORD = process.env.ANONYMOUS_PASSWORD;
// const ANONYMOUS_SALT = process.env.ANONYMOUS_SALT;

// 插入到AminUser
// insert into AdminUser (email, username, password, salt, createdAt, updatedAt) values ("fernandowang584@gmail.com", "admin", "61d591f1e485b0b7dd2165b7a25c160ea9a6a475532306c693d9f7abe456a590", "19c38f179287f151dba6e7ce37fa3cf8", now(), now());
// 插入到platform
// INSERT INTO Platform (id, name, updatedAt) VALUES (1, '实体店', NOW())
// INSERT INTO Platform (id, name, updatedAt) VALUES (2, '拼多多', NOW())
// INSERT INTO Platform (id, name, updatedAt) VALUES (3, '闲鱼', NOW())


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
async function upsertPlatform(data: { name: string }) {
  return prisma.platform.upsert({
    where: { name: data.name },
    create: { name: data.name },
    update: { name: data.name },
  });
}

async function main() {
  await prisma.$connect();
  // 顺序执行，避免多个查询同时抢连接池导致 @prisma/adapter-mariadb 在刚建连时超时/卡死
  await upsertAdminUser({
    email: ADMIN_EMAIL!,
    username: ADMIN_USERNAME!,
    password: ADMIN_PASSWORD!,
    salt: ADMIN_SALT!,
  });
  // 用原生 SQL 固定 id=1，绕过 Prisma upsert 对主键处理的兼容性问题
  await prisma.$executeRaw`
    INSERT INTO Platform (id, name, updatedAt) VALUES (1, '实体店', NOW())
    ON DUPLICATE KEY UPDATE name = '实体店'
  `;
  await upsertPlatform({ name: "拼多多" });
  await upsertPlatform({ name: "闲鱼" });
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
