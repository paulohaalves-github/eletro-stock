import { NextResponse } from "next/server";
import { finishInstagramOauth } from "@/lib/instagram/accounts";
import { getSession } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";
import { publicAppUrl } from "@/lib/services/inbox-channels";

export const dynamic = "force-dynamic";

function destination(request) {
  const base = publicAppUrl() || new URL(request.url).origin;
  return new URL("/contact-center/canais", base);
}

export async function GET(request) {
  const session = await getSession();
  const back = destination(request);
  if (!session || !can(session, PERMISSIONS.INBOX_CHANNEL_MANAGE)) {
    back.searchParams.set("instagramError", "Entre novamente e conecte o Instagram.");
    return NextResponse.redirect(back);
  }

  const params = new URL(request.url).searchParams;
  const denied = params.get("error");
  if (denied) {
    back.searchParams.set(
      "instagramError",
      denied === "access_denied" ? "A autorização do Facebook foi cancelada." : params.get("error_description") || "A Meta recusou a autorização.",
    );
    return NextResponse.redirect(back);
  }

  try {
    const result = await finishInstagramOauth(params.get("state"), params.get("code"), session);
    if (result.connected) back.searchParams.set("instagram", "connected");
    else back.searchParams.set("instagramChannel", String(result.channelId));
  } catch (error) {
    back.searchParams.set("instagramError", error.message || "Não foi possível concluir a conexão.");
  }
  return NextResponse.redirect(back);
}
