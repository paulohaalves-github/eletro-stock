import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { addWorkOrderImages } from "@/lib/services/repair";
import { parseId } from "@/lib/validations";
import { validationError } from "@/lib/errors";

export const POST = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const form = await request.formData();
    const files = form.getAll("files").filter((item) => item && typeof item === "object" && "arrayBuffer" in item);
    if (!files.length) throw validationError("Selecione ao menos uma imagem.");
    const workOrder = await addWorkOrderImages(parseId(id), files, session, {
      eventId: form.get("eventId") || undefined,
      message: form.get("message") || undefined,
    });
    return { workOrder, message: "Evidência anexada." };
  },
  { permission: PERMISSIONS.REPAIR_UPDATE },
);
