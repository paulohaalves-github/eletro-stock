import { apiHandler, readJson } from "@/lib/api";
import { ndjsonStream } from "@/lib/ndjson-stream";
import { PERMISSIONS } from "@/lib/permissions";
import { fetchCareCustomer } from "@/lib/services/care";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = apiHandler(
  async (request) => {
    const body = await readJson(request);
    return ndjsonStream(async (send) => {
      send({ type: "step", message: "Conectando ao Care." });
      const customer = await fetchCareCustomer(body.ov, (message) => {
        send({ type: "step", message });
      });
      send({ type: "customer", customer });
    }, { fallback: "Não foi possível concluir a busca no Care." });
  },
  { permission: PERMISSIONS.CUSTOMER_MANAGE },
);
