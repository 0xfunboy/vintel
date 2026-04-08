import { NextResponse } from "next/server";

import { isGoogleConfigured } from "@/auth";
import { getTelegramBotProfile } from "@/lib/telegram";

export async function GET() {
  const bot = await getTelegramBotProfile();

  return NextResponse.json({
    ok: true,
    appUrl: process.env.APP_URL ?? null,
    authConfigured: isGoogleConfigured(),
    telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    telegramBot: bot?.username ?? null,
    ingestConfigured: Boolean(process.env.INGEST_CRON_SECRET)
  });
}
