import { prisma } from "../db";
import { validationError } from "../errors";
import { writeAudit } from "../audit";

export function normalizeManufacturerName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 160);
}

export async function listManufacturers() {
  const items = await prisma.manufacturer.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return { items };
}

export async function findOrCreateManufacturer(name, actor) {
  const normalized = normalizeManufacturerName(name);
  if (!normalized) return null;
  const existing = await prisma.manufacturer.findFirst({ where: { name: normalized } });
  if (existing) return existing;
  try {
    const manufacturer = await prisma.manufacturer.create({ data: { name: normalized } });
    if (actor?.id) {
      await writeAudit({
        userId: actor.id,
        action: "MANUFACTURER_CREATED",
        entity: "manufacturer",
        entityId: manufacturer.id,
        newData: { name: manufacturer.name },
      });
    }
    return manufacturer;
  } catch (error) {
    if (error?.code !== "P2002") throw error;
    const again = await prisma.manufacturer.findFirst({ where: { name: normalized } });
    if (again) return again;
    throw error;
  }
}

export async function registerManufacturer(name, actor) {
  const normalized = normalizeManufacturerName(name);
  if (!normalized) throw validationError("Informe o nome do fabricante.");
  const existing = await prisma.manufacturer.findFirst({ where: { name: normalized } });
  const manufacturer = existing || await findOrCreateManufacturer(normalized, actor);
  return { manufacturer, created: !existing };
}

export async function resolveManufacturer(payload, actor) {
  const name = normalizeManufacturerName(payload?.manufacturerName);
  if (name) return findOrCreateManufacturer(name, actor);
  const id = Number(payload?.manufacturerId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const found = await prisma.manufacturer.findFirst({ where: { id, active: true } });
  if (!found) throw validationError("Fabricante inválido.");
  return found;
}
