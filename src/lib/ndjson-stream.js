import { AppError } from "./errors";

const FLUSH_PAD = `${" ".repeat(8192)}\n`;

export function ndjsonStream(run, { fallback }) {
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n${FLUSH_PAD}`));
        } catch {
          closed = true;
        }
      };
      const heartbeat = setInterval(() => send({ type: "ping" }), 15000);
      try {
        await run(send);
      } catch (error) {
        if (!(error instanceof AppError)) console.error(error);
        const message = error instanceof AppError ? error.message : fallback;
        send({ type: "error", message });
      } finally {
        clearInterval(heartbeat);
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            /* a conexão já foi encerrada */
          }
        }
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
