import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { createCustomer, listCustomers } from "@/lib/services/customers";

export const GET = apiHandler(
  async (request) => {
    const { searchParams } = new URL(request.url);
    return listCustomers({
      q: searchParams.get("q"),
      page: searchParams.get("page"),
      pageSize: searchParams.get("pageSize"),
    });
  },
  { permission: PERMISSIONS.CUSTOMER_VIEW },
);

export const POST = apiHandler(
  async (request, { session }) => {
    const body = await readJson(request);
    const customer = await createCustomer(body, session);
    return { customer, message: "Cliente cadastrado." };
  },
  { permission: PERMISSIONS.CUSTOMER_MANAGE },
);
