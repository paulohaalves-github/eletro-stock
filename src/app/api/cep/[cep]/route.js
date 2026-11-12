import { apiHandler } from "@/lib/api";
import { formatAddressFromCep, lookupCep } from "@/lib/cep";

export const GET = apiHandler(async (_request, { params }) => {
  const { cep } = await params;
  const address = await lookupCep(cep);
  return {
    address,
    formatted: formatAddressFromCep(address),
  };
});
