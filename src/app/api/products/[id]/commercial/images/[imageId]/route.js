import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { deleteCommercialImage } from "@/lib/services/commercial";
import { parseId } from "@/lib/validations";

export const DELETE = apiHandler(
  async (_request, { params, session }) => {
    const { id, imageId } = await params;
    const product = await deleteCommercialImage(parseId(id), parseId(imageId), session);
    return { product, message: "Foto comercial removida." };
  },
  { permission: PERMISSIONS.PHOTO_DELETE },
);
