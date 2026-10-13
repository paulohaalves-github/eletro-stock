import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { listManufacturers, registerManufacturer } from "@/lib/services/manufacturers";

export const GET = apiHandler(async () => listManufacturers(), { permission: PERMISSIONS.PRODUCT_VIEW });

export const POST = apiHandler(
  async (request, { session }) => {
    const body = await readJson(request);
    const { manufacturer, created } = await registerManufacturer(body.name, session);
    return {
      manufacturer,
      message: created ? "Fabricante cadastrado." : "Este fabricante já está cadastrado.",
    };
  },
  { permission: PERMISSIONS.PRODUCT_EDIT },
);
