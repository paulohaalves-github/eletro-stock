import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { deleteProductImage, setPrimaryImage } from "@/lib/services/images";
import { parseId } from "@/lib/validations";

export const PATCH = apiHandler(
  async (request, { params, session }) => {
    const { id, imageId } = await params;
    const body = await readJson(request);
    if (body.isPrimary) {
      const product = await setPrimaryImage(parseId(id), parseId(imageId), session);
      return { product, message: "Imagem principal atualizada." };
    }
    return { ok: true };
  },
  { permission: PERMISSIONS.PHOTO_UPLOAD },
);

export const DELETE = apiHandler(
  async (_request, { params, session }) => {
    const { id, imageId } = await params;
    const product = await deleteProductImage(parseId(id), parseId(imageId), session);
    return { product, message: "Imagem removida." };
  },
  { permission: PERMISSIONS.PHOTO_DELETE },
);
