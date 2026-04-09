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
  return Promise.all(
    [
      {
        email: ANONYMOUS_EMAIL!,
        username: ANONYMOUS_USERNAME!,
        password: ANONYMOUS_PASSWORD!,
        salt: ANONYMOUS_SALT!,
      },
      {
        email: ADMIN_EMAIL!,
        username: ADMIN_USERNAME!,
        password: ADMIN_PASSWORD!,
        salt: ADMIN_SALT!,
      },
    ].map(upsertAdminUser),
  );
}

main()
  .then(() => {
    console.log("Seed: anonymous user ok");
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
