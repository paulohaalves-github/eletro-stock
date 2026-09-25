import { apiHandler, readJson } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/permissions";
import { fetchCareCustomer } from "@/lib/services/care";

export const maxDuration = 60;

export const POST = apiHandler(
  async (request) => {
    const body = await readJson(request);
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
        };
        try {
          const customer = await fetchCareCustomer(body.ov, (message) => {
            send({ type: "step", message });
          });
          send({ type: "customer", customer });
        } catch (error) {
          if (!(error instanceof AppError)) console.error(error);
          const message = error instanceof AppError
            ? error.message
            : "Não foi possível concluir a busca no Care.";
          send({ type: "error", message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  },
  { permission: PERMISSIONS.CUSTOMER_MANAGE },
);
