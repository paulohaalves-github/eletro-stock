import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { listPartTransfers, sendPartTransfer } from "@/lib/services/parts";

export const GET = apiHandler(
  async (_request, { session }) => {
    const items = await listPartTransfers(session);
    return { items };
  },
  { permission: PERMISSIONS.PART_VIEW },
);

export const POST = apiHandler(
  async (request, { session }) => {
    const body = await readJson(request);
    const transfer = await sendPartTransfer(body, session);
    return { transfer, message: "Peças enviadas. Aguarde o recebimento no destino." };
  },
  { permission: PERMISSIONS.PART_STOCK },
);
