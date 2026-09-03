import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS, assertCan } from "@/lib/permissions";
import { getProduct, updateProduct } from "@/lib/services/products";
import { parseId } from "@/lib/validations";

export const GET = apiHandler(
  async (_request, { params }) => {
    const { id } = await params;
    return { product: await getProduct(parseId(id)) };
  },
  { permission: PERMISSIONS.PRODUCT_VIEW },
);

export const PATCH = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await readJson(request);
    const current = await getProduct(parseId(id));
    if (body.condition && body.condition !== current.condition) {
      assertCan(session.role, PERMISSIONS.CONDITION_CHANGE);
    }
    const keys = Object.keys(body || {});
    const locationOnly = keys.length > 0 && keys.every((key) => key === "locationId" || key === "locationTypeId");
    assertCan(session.role, locationOnly ? PERMISSIONS.LOCATION_ASSIGN : PERMISSIONS.PRODUCT_EDIT);
    const product = await updateProduct(current.id, body, session);
    return { product, message: "Produto atualizado com sucesso." };
  },
  { permission: PERMISSIONS.PRODUCT_VIEW },
);
