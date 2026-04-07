import prisma from "../src/utils/prisma";

const ANONYMOUS_EMAIL = "anonymous@qq.com";

async function main() {
  await prisma.user.upsert({
    where: { email: ANONYMOUS_EMAIL },
    create: {
      email: ANONYMOUS_EMAIL,
      username: "anonymous",
      password: "password",
      salt: "salt",
    },
    update: {
      username: "anonymous",
      password: "password",
      salt: "salt",
    },
  });
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
