import prisma from "../src/utils/prisma";

const ANONYMOUS_EMAIL = "anonymous@qq.com";

async function main() {
  await prisma.adminUser.upsert({
    where: { email: ANONYMOUS_EMAIL },
    create: {
      email: ANONYMOUS_EMAIL,
      username: "admin",
      password:
        "61d591f1e485b0b7dd2165b7a25c160ea9a6a475532306c693d9f7abe456a590",
      salt: "19c38f179287f151dba6e7ce37fa3cf8",
    },
    update: {
      username: "admin",
      password:
        "61d591f1e485b0b7dd2165b7a25c160ea9a6a475532306c693d9f7abe456a590",
      salt: "19c38f179287f151dba6e7ce37fa3cf8",
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
