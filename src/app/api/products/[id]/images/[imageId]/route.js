import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { deleteProductImage, setCatalogPublic, setPrimaryImage } from "@/lib/services/images";
import { parseId } from "@/lib/validations";

export const PATCH = apiHandler(
  async (request, { params, session }) => {
    const { id, imageId } = await params;
    const body = await readJson(request);
    const productId = parseId(id);
    const currentImageId = parseId(imageId);
    if (typeof body.catalogPublic === "boolean") {
      const product = await setCatalogPublic(productId, currentImageId, body.catalogPublic, session);
      if (!body.isPrimary) return { product, message: body.catalogPublic ? "Foto liberada no catálogo." : "Foto retirada do catálogo." };
    }
    if (body.isPrimary) {
      const product = await setPrimaryImage(productId, currentImageId, session);
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
