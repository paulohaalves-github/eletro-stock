import { apiHandler } from "@/lib/api";
import { validationError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/permissions";
import { addCommercialImages } from "@/lib/services/commercial";
import { parseId } from "@/lib/validations";

export const POST = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const form = await request.formData();
    const files = form.getAll("files").filter((item) => item && typeof item === "object" && "arrayBuffer" in item);
    if (!files.length) throw validationError("Selecione ao menos uma imagem.");
    const product = await addCommercialImages(parseId(id), files, session);
    return { product, message: "Foto comercial adicionada." };
  },
  { permission: PERMISSIONS.PHOTO_UPLOAD },
);
