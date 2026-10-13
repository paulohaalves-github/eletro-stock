import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { importCommercialFromIcecat, saveCommercialSheet } from "@/lib/services/commercial";
import { parseId } from "@/lib/validations";

export const PUT = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await readJson(request);
    const product = await saveCommercialSheet(parseId(id), body, session);
    return { product, message: "Ficha comercial salva." };
  },
  { permission: PERMISSIONS.PRODUCT_EDIT },
);

export const POST = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await readJson(request);
    return importCommercialFromIcecat(parseId(id), session, body);
  },
  { permission: PERMISSIONS.PRODUCT_EDIT },
);
