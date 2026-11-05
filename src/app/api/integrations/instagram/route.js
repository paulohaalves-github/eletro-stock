import { NextResponse } from "next/server";
import { verifyMetaSignature } from "@/lib/instagram/graph";
import { processInstagramWebhook } from "@/lib/instagram/process";
import { getInstagramSettings } from "@/lib/services/settings";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const settings = await getInstagramSettings();
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  if (mode === "subscribe" && settings.verifyToken && token === settings.verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return NextResponse.json({ error: "Verificação recusada." }, { status: 403 });
}

export async function POST(request) {
  const raw = await request.text();
  const settings = await getInstagramSettings();
  if (!verifyMetaSignature(raw, request.headers.get("x-hub-signature-256"), settings.appSecret)) {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 403 });
  }
  let body = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = {};
  }
  try {
    const result = await processInstagramWebhook(body);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[instagram-webhook]", error);
    return NextResponse.json({ ok: true });
  }
}
