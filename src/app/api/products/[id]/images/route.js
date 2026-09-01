import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { addProductImages } from "@/lib/services/images";
import { parseId } from "@/lib/validations";
import { validationError } from "@/lib/errors";

export const POST = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const form = await request.formData();
    const files = form.getAll("files").filter((item) => item && typeof item === "object" && "arrayBuffer" in item);
    if (!files.length) throw validationError("Selecione ao menos uma imagem.");
    const images = await addProductImages(parseId(id), files, session);
    return { images, message: "Imagem adicionada." };
  },
  { permission: PERMISSIONS.PHOTO_UPLOAD },
);
