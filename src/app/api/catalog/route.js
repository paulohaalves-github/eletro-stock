import { apiHandler } from "@/lib/api";
import { getPublicCatalog } from "@/lib/services/public-catalog";

export const GET = apiHandler(
  async (request) => {
    const { searchParams } = new URL(request.url);
    return getPublicCatalog({
      q: searchParams.get("q"),
      categoria: searchParams.get("categoria"),
      unidade: searchParams.get("unidade"),
    });
  },
  { public: true },
);
