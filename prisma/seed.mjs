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
  await prisma.userUnit.deleteMany();
  await prisma.user.deleteMany();
  await prisma.unit.deleteMany();

  await prisma.unit.createMany({
    data: [
      { name: "Onyx Outlet", slug: "onyx", type: "MATRIZ", active: true },
      { name: "Eletromall Outlet", slug: "eletromall", type: "FILIAL", active: true },
    ],
  });

  await prisma.user.create({
    data: {
      name: "TI",
      email: "ti@multifix.com.br",
      passwordHash: await bcrypt.hash("GrupoTi2019@", 12),
      role: "ADMINISTRADOR",
    },
  });

  console.log("Seed concluído: banco zerado, unidades e administrador.");
  console.log("  Unidades: Onyx Outlet (Matriz), Eletromall Outlet (Filial)");
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
