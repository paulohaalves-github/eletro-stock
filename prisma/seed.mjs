import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.stockMovement.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.productFile.deleteMany();
  await prisma.product.deleteMany();
  await prisma.location.deleteMany();
  await prisma.locationType.deleteMany();
  await prisma.catalogModel.deleteMany();
  await prisma.category.deleteMany();
  await prisma.line.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.create({
    data: {
      name: "TI",
      email: "ti@multifix.com.br",
      passwordHash: await bcrypt.hash("GrupoTi2019@", 12),
      role: "ADMINISTRADOR",
    },
  });

  console.log("Seed concluído: banco zerado, somente o administrador.");
  console.log("  ti@multifix.com.br");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
