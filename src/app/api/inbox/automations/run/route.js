import { apiHandler } from "@/lib/api";
import { can, PERMISSIONS } from "@/lib/permissions";
import { forbidden, unauthorized } from "@/lib/errors";
import { processUnansweredAutomations } from "@/lib/services/inbox-automations";
import { assertWorkerSecret } from "@/lib/whatsapp/worker-auth";

export const dynamic = "force-dynamic";

export const POST = apiHandler(
  async (request, { session }) => {
    const workerHeader = request.headers.get("x-worker-secret");
    if (workerHeader) {
      assertWorkerSecret(request);
    } else if (!session) {
      throw unauthorized();
    } else if (!can(session.role, PERMISSIONS.INBOX_CHANNEL_MANAGE)) {
      throw forbidden();
    }
    const result = await processUnansweredAutomations();
    return { ok: true, ...result };
  },
  { public: true },
);
