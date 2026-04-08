import { randomUUID } from "node:crypto";

import { getUserByTelegramLinkToken, readAlerts, readUsers, updateUserById, writeAlerts } from "./db";
import type { AlertRecord, ListingRecord, UserRecord } from "./types";

type TelegramGetMeResponse = {
  ok: boolean;
  result?: {
    id: number;
    is_bot: boolean;
    username?: string;
    first_name: string;
  };
};

type TelegramWebhookUpdate = {
  message?: {
    chat: {
      id: number;
    };
    text?: string;
  };
};

function botToken() {
  return process.env.TELEGRAM_BOT_TOKEN ?? "";
}

function api(method: string) {
  return `https://api.telegram.org/bot${botToken()}/${method}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function getTelegramBotProfile() {
  if (!botToken()) {
    return null;
  }

  const response = await fetch(api("getMe"), {
    method: "GET",
    cache: "no-store"
  });

  if (!response.ok) {
    return null;
  }

  const json = (await response.json()) as TelegramGetMeResponse;
  return json.ok ? json.result ?? null : null;
}

export async function sendTelegramMessage(chatId: string, text: string, extra?: Record<string, unknown>) {
  if (!botToken()) {
    return { ok: false, skipped: true };
  }

  const response = await fetch(api("sendMessage"), {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      ...extra
    })
  });

  if (!response.ok) {
    throw new Error(`Telegram sendMessage failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

export async function buildTelegramDeepLink(user: UserRecord) {
  const profile = await getTelegramBotProfile();
  if (!profile?.username) {
    return null;
  }

  return `https://t.me/${profile.username}?start=${user.telegramLinkToken}`;
}

export async function sendTelegramAlert(user: UserRecord, listing: ListingRecord) {
  if (!user.telegramEnabled || !user.telegramChatId || !botToken()) {
    return false;
  }

  const lines = [
    `<b>${escapeHtml(listing.title)}</b>`,
    `Price: <b>${(listing.priceCents / 100).toFixed(2)} ${escapeHtml(listing.currency)}</b>`,
    `Seller: ${escapeHtml(listing.sellerName)}`,
    `Score: ${listing.score}/100`,
    `Match: ${escapeHtml(listing.matchedKeywords.join(", "))}`
  ];

  await sendTelegramMessage(user.telegramChatId, lines.join("\n"), {
    disable_web_page_preview: false,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Open on Vinted",
            url: listing.url
          }
        ]
      ]
    }
  });

  const alerts = await readAlerts();
  const alert: AlertRecord = {
    id: randomUUID(),
    userId: user.id,
    listingId: listing.id,
    channel: "telegram",
    sentAt: new Date().toISOString(),
    openedAt: null,
    clickedAt: null
  };
  await writeAlerts([alert, ...alerts]);

  return true;
}

export async function handleTelegramWebhook(update: TelegramWebhookUpdate) {
  const chatId = update.message?.chat.id;
  const text = update.message?.text?.trim();

  if (!chatId || !text) {
    return { ok: true, action: "ignored" as const };
  }

  if (text === "/help") {
    await sendTelegramMessage(String(chatId), "Use the private deep link from your dashboard to connect this Telegram chat.");
    return { ok: true, action: "help" as const };
  }

  const payload = text.startsWith("/start ") ? text.replace("/start ", "").trim() : "";
  if (!payload) {
    await sendTelegramMessage(String(chatId), "Missing start token. Open the Telegram link directly from your dashboard.");
    return { ok: true, action: "missing-token" as const };
  }

  const user = await getUserByTelegramLinkToken(payload);
  if (!user) {
    await sendTelegramMessage(String(chatId), "Unknown or expired connection token.");
    return { ok: true, action: "unknown-token" as const };
  }

  await updateUserById(user.id, (current) => ({
    ...current,
    telegramChatId: String(chatId)
  }));

  await sendTelegramMessage(
    String(chatId),
    `Telegram connected to <b>${escapeHtml(user.name)}</b>. Future alerts will land here with a manual-open button.`
  );

  return { ok: true, action: "linked" as const, userId: user.id };
}
