import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { addWorkOrderInteraction } from "@/lib/services/repair";
import { parseId } from "@/lib/validations";

export const POST = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const form = await request.formData();
    const files = form.getAll("files").filter((item) => item && typeof item === "object" && "arrayBuffer" in item);
    const workOrder = await addWorkOrderInteraction(parseId(id), {
      type: form.get("type") || undefined,
      message: form.get("message") || "",
      status: form.get("status") || undefined,
      eventId: form.get("eventId") || undefined,
      files,
    }, session);
    return { workOrder, message: "Interação registrada." };
  },
  { permission: PERMISSIONS.REPAIR_UPDATE },
);
