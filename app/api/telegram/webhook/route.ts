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

  const body = await request.json();
  const result = await handleTelegramWebhook(body);
  return NextResponse.json(result);
}
