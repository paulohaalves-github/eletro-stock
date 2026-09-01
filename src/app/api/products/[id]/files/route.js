import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { addProductFile, deleteProductFile } from "@/lib/services/images";
import { parseId } from "@/lib/validations";
import { validationError } from "@/lib/errors";

export const POST = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
      throw validationError("Selecione um anexo.");
    }
    const created = await addProductFile(parseId(id), file, session);
    return { file: created, message: "Anexo adicionado." };
  },
  { permission: PERMISSIONS.PHOTO_UPLOAD },
);

export const DELETE = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    await deleteProductFile(parseId(id), parseId(searchParams.get("fileId")), session);
    return { message: "Anexo removido." };
  },
  { permission: PERMISSIONS.PHOTO_DELETE },
);
