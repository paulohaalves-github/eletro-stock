import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { sendConversationMessage } from "@/lib/services/inbox-conversations";
import { parseId } from "@/lib/validations";

function parseFormLocation(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

export const POST = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const contentType = request.headers.get("content-type") || "";
    let payload;
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      payload = {
        body: form.get("body") || "",
        internal: form.get("internal") === "1" || form.get("internal") === "true",
        quotedMessageId: form.get("quotedMessageId") || null,
        file: form.get("file"),
        location: parseFormLocation(form.get("location")),
      };
    } else {
      payload = await readJson(request);
    }
    const conversation = await sendConversationMessage(parseId(id), payload, session);
    return { conversation, message: payload.internal ? "Nota interna registrada." : payload.templateName ? "Modelo enviado." : "Mensagem enviada." };
  },
  { permission: PERMISSIONS.INBOX_REPLY },
);
