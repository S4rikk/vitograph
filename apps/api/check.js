const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const data = await prisma.$queryRawUnsafe(`SELECT * FROM net.http_response ORDER BY created DESC LIMIT 5`);
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.log(e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
