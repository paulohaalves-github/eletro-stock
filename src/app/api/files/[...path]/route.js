import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { resolveUploadPath } from "@/lib/services/images";
import { notFound } from "@/lib/errors";

const MIME = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export const GET = apiHandler(
  async (_request, { params }) => {
    const { path: segments } = await params;
    const relative = (segments || []).join("/");
    const full = resolveUploadPath(relative);
    try {
      await stat(full);
    } catch {
      throw notFound("Arquivo não encontrado.");
    }
    const bytes = await readFile(full);
    return new Response(bytes, {
      headers: {
        "Content-Type": MIME[path.extname(full).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  },
  { permission: PERMISSIONS.PRODUCT_VIEW },
);
