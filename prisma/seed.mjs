import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.stockMovement.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.productFile.deleteMany();
  await prisma.product.deleteMany();
  await prisma.catalogModel.deleteMany();
  await prisma.category.deleteMany();
  await prisma.line.deleteMany();
  await prisma.user.deleteMany();

  const password = await bcrypt.hash("Admin@123", 12);
  const stockPassword = await bcrypt.hash("Estoque@123", 12);
  const viewPassword = await bcrypt.hash("Consulta@123", 12);

  await prisma.user.create({
    data: {
      name: "Ana Administradora",
      email: "admin@eletromall.com",
      passwordHash: password,
      role: "ADMINISTRADOR",
    },
  });
  await prisma.user.create({
    data: {
      name: "Carlos Estoque",
      email: "estoque@eletromall.com",
      passwordHash: stockPassword,
      role: "ESTOQUE",
    },
  });
  await prisma.user.create({
    data: {
      name: "Marina Consulta",
      email: "consulta@eletromall.com",
      passwordHash: viewPassword,
      role: "CONSULTA",
    },
  });

  console.log("Seed concluído: banco zerado, somente usuários padrão.");
  console.log("  admin@eletromall.com / Admin@123");
  console.log("  estoque@eletromall.com / Estoque@123");
  console.log("  consulta@eletromall.com / Consulta@123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
