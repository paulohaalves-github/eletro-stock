import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { getCustomer, updateCustomer } from "@/lib/services/customers";
import { parseId } from "@/lib/validations";

export const GET = apiHandler(
  async (_request, { params, session }) => {
    const { id } = await params;
    const customer = await getCustomer(parseId(id), session);
    return { customer };
  },
  { permission: PERMISSIONS.CUSTOMER_VIEW },
);

export const PATCH = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await readJson(request);
    const customer = await updateCustomer(parseId(id), body, session);
    return { customer, message: "Cliente atualizado." };
  },
  { permission: PERMISSIONS.CUSTOMER_MANAGE },
);
