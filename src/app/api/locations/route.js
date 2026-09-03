import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { createLocation, listLocations } from "@/lib/services/locations";

export const GET = apiHandler(
  async (request) => {
    const { searchParams } = new URL(request.url);
    const items = await listLocations({
      locationTypeId: searchParams.get("locationTypeId") || searchParams.get("typeId"),
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
    const item = await createLocation(body, session);
    return { item, message: "Localização cadastrada." };
  },
  { permission: PERMISSIONS.LOCATION_MANAGE },
);
