import { NextRequest, NextResponse } from "next/server";

import { handleTelegramWebhook } from "@/lib/telegram";

function isAuthorized(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    return true;
  }

  return request.headers.get("x-telegram-bot-api-secret-token") === secret;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = await handleTelegramWebhook(body);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[telegram-webhook] error:", message);
    // Always return 200 to Telegram so it does not retry indefinitely
    return NextResponse.json({ ok: false, error: message }, { status: 200 });
  }
}
