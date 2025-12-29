import { PrismaClient } from "@prisma/client";

const { DATABASE_URL } = process.env;

// console.log(result.parsed, '---parsed');
const prisma = new PrismaClient({
  log: ["info", "error"],
  datasources: {
    db: {
      url: DATABASE_URL,
    },
  },
});

prisma
  .$connect()
  // .then(() => {console.log('connected')})
  .catch((err) => {
    console.log("disconnected, because: ", err.message);
  });
export default prisma;