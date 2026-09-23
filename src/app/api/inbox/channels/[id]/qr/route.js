import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { connectInboxChannel, disconnectInboxChannel } from "@/lib/services/inbox-channels";
import { parseId } from "@/lib/validations";

export const POST = apiHandler(
  async (_request, { params }) => {
    const { id } = await params;
    const channel = await connectInboxChannel(parseId(id));
    return { channel, message: "Aguardando QR Code no worker." };
  },
  { permission: PERMISSIONS.INBOX_CHANNEL_MANAGE },
);

export const DELETE = apiHandler(
  async (_request, { params }) => {
    const { id } = await params;
    const channel = await disconnectInboxChannel(parseId(id));
    return { channel, message: "Canal desconectado." };
  },
  { permission: PERMISSIONS.INBOX_CHANNEL_MANAGE },
);
