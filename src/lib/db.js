import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;
const PRISMA_SCHEMA_ID = "product-trash";

if (globalForPrisma.prisma && globalForPrisma.prismaSchemaId !== PRISMA_SCHEMA_ID) {
  void globalForPrisma.prisma.$disconnect?.();
  globalForPrisma.prisma = undefined;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaId = PRISMA_SCHEMA_ID;
}
