import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { createLocationType, listLocationTypes } from "@/lib/services/locations";

export const GET = apiHandler(
  async (request) => {
    const { searchParams } = new URL(request.url);
    const items = await listLocationTypes({
      active: searchParams.get("active"),
      includeCounts: searchParams.get("includeCounts") === "true",
    });
    return { items };
  },
  { permission: PERMISSIONS.PRODUCT_VIEW },
);

export const POST = apiHandler(
  async (request, { session }) => {
    const body = await readJson(request);
    const item = await createLocationType(body, session);
    return { item, message: "Tipo de localização cadastrado." };
  },
  { permission: PERMISSIONS.LOCATION_MANAGE },
);
