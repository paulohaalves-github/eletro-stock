import { NextResponse } from "next/server";
import { apiHandler, readJson } from "@/lib/api";
import { processDialog360Webhook } from "@/lib/whatsapp/process-dialog360";

export const dynamic = "force-dynamic";

export const GET = apiHandler(
  async (request) => {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");
    const expected = process.env.DIALOG360_VERIFY_TOKEN || "";
    if (mode === "subscribe" && expected && token === expected && challenge) {
      return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return NextResponse.json({ ok: true });
  },
  { public: true },
);

export const POST = apiHandler(
  async (request, { params }) => {
    const { channelId } = await params;
    const body = await readJson(request);
    const result = await processDialog360Webhook(body, channelId);
    return { ok: true, ...result };
  },
  { public: true },
);
