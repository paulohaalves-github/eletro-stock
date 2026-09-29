import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { deleteCustomer, getCustomer, updateCustomer } from "@/lib/services/customers";
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
    const result = await updateCustomer(parseId(id), body, session);
    return { customer: result.customer, warning: result.warning, message: "Cliente atualizado." };
  },
  { permission: PERMISSIONS.CUSTOMER_MANAGE },
);

export const DELETE = apiHandler(
  async (_request, { params, session }) => {
    const { id } = await params;
    await deleteCustomer(parseId(id), session);
    return { message: "Cliente excluído." };
  },
  { permission: PERMISSIONS.CUSTOMER_MANAGE },
);
