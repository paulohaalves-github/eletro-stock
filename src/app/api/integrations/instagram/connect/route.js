import { NextResponse } from "next/server";
import { beginInstagramConnect } from "@/lib/instagram/accounts";
import { getSession } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function back(request, message) {
  const url = new URL("/contact-center/canais", request.url);
  url.searchParams.set("instagramError", message);
  return NextResponse.redirect(url);
}

export async function GET(request) {
  const session = await getSession();
  if (!session || !can(session, PERMISSIONS.INBOX_CHANNEL_MANAGE)) {
    return back(request, "Você não tem permissão para conectar o Instagram.");
  }
  const channelId = Number(new URL(request.url).searchParams.get("channelId"));
  try {
    const target = await beginInstagramConnect(channelId);
    return NextResponse.redirect(target);
  } catch (error) {
    return back(request, error.message || "Não foi possível conectar o Instagram.");
  }
}
