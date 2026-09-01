import { prisma } from "../db";
import { validationError } from "../errors";
import { emptyToNull } from "../validations";

export async function findCatalogModel(code) {
  const supplierModelCode = emptyToNull(code);
  if (!supplierModelCode) return null;
  return prisma.catalogModel.findUnique({
    where: { supplierModelCode },
  });
}

export async function resolveCatalogModel(supplierModelCode, commercialName) {
  const code = emptyToNull(supplierModelCode);
  if (!code) {
    return { catalogModelId: null, supplierModelCode: null };
  }

  const existing = await findCatalogModel(code);
  const name = emptyToNull(commercialName) || existing?.commercialName;
  if (!name) {
    throw validationError("Informe o nome comercial para este Model Code.");
  }

  const model = await prisma.catalogModel.upsert({
    where: { supplierModelCode: code },
    create: { supplierModelCode: code, commercialName: name },
    update: emptyToNull(commercialName) ? { commercialName: name } : {},
  });

  return {
    catalogModelId: model.id,
    supplierModelCode: model.supplierModelCode,
    commercialName: model.commercialName,
  };
}

export async function listCatalogModels(query) {
  const q = emptyToNull(query);
  return prisma.catalogModel.findMany({
    where: q
      ? {
          OR: [
            { supplierModelCode: { contains: q } },
            { commercialName: { contains: q } },
          ],
        }
      : {},
    orderBy: { commercialName: "asc" },
    take: 30,
  });
}
