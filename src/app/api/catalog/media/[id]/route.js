import path from "node:path";
import { readFile, stat } from "node:fs/promises";
import { apiHandler } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { readCatalogImage } from "@/lib/services/public-catalog";

const MIME = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

export const GET = apiHandler(
  async (_request, { params }) => {
    const { id } = await params;
    const full = await readCatalogImage(id);
    try {
      await stat(full);
    } catch {
      throw notFound("Imagem não encontrada.");
    }
    const bytes = await readFile(full);
    return new Response(bytes, {
      headers: {
        "Content-Type": MIME[path.extname(full).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
  { public: true },
);
