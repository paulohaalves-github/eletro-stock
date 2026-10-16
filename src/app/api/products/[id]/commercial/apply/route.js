import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { applyCommercialLookup } from "@/lib/services/commercial-lookup";
import { parseId } from "@/lib/validations";

export const maxDuration = 60;

export const POST = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await readJson(request);
    return applyCommercialLookup(parseId(id), session, body);
  },
  { permission: PERMISSIONS.PRODUCT_EDIT },
);
