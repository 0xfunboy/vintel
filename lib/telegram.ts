import { randomUUID } from "node:crypto";

import {
  getUserByTelegramChatId,
  getUserByTelegramLinkToken,
  readAlerts,
  readListings,
  updateUserById,
  writeAlerts
} from "./db";
import type { AlertRecord, ListingRecord, Locale, UserRecord } from "./types";

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
  message?: TelegramWebhookMessage;
  edited_message?: TelegramWebhookMessage;
};

type TelegramWebhookMessage = {
  chat: {
    id: number;
  };
  from?: {
    first_name?: string;
  };
  text?: string;
};

const telegramCopy = {
  en: {
    welcomeTitle: "Vintel sniper bot",
    welcomeBody:
      "Link this chat to Vintel, save tracked hunts, receive live matches here, and open every listing manually only when it is worth acting on.",
    helpTitle: "What you can do here",
    helpBody:
      "/status checks your linked account and hunts. /link <token> links this chat from your dashboard. /id shows the chat id for manual linking in Vintel.",
    notLinked:
      "This chat is not linked yet. Open Vintel and use the automatic Telegram button, or paste your chat id in the dashboard after running /id here.",
    linked: "Telegram is now linked to <b>{name}</b>. Alerts for your tracked searches will land in this chat.",
    missingToken: "Missing start token. Open the Telegram link directly from your Vintel dashboard to bind this chat.",
    unknownToken: "Unknown or expired link token. Rotate the Telegram token from your dashboard and try again.",
    linkUsage: "Use /link <token> with the command shown in your dashboard, or paste the chat id from /id into Vintel.",
    chatIdTitle: "Manual Telegram link",
    chatIdBody: "Your chat id is <b>{chatId}</b>. Paste it into the Vintel dashboard if you want to link this chat manually.",
    statusTitle: "Chat status",
    statusLinked: "Linked account: <b>{name}</b>",
    statusSearches: "Tracked searches: <b>{count}</b>",
    statusKeywords: "Keywords: <b>{count}</b>",
    statusListings: "Stored matches: <b>{count}</b>",
    statusAlerts: "Delivered alerts: <b>{count}</b>",
    statusDelivery: "Telegram delivery: <b>{value}</b>",
    enabled: "enabled",
    disabled: "disabled",
    openApp: "Open Vintel",
    openDashboard: "Open dashboard",
    signIn: "Sign in",
    openListing: "Open on Vinted",
    linkCommand: "Manual link command",
    menu: "Quick actions restored below.",
    greeting: "Hi {name},",
    fallbackName: "there",
    trackSavedTitle: "Tracking saved",
    trackSavedSearch: "Search: <b>{label}</b>",
    trackSavedCategory: "Category: <b>{value}</b>",
    trackSavedBudget: "Budget cap: <b>{value}</b>",
    trackSavedKeywords: "Keywords: <b>{value}</b>",
    trackSavedBody: "Vintel will now watch this hunt and send fresh matches here."
  },
  it: {
    welcomeTitle: "Bot sniper Vintel",
    welcomeBody:
      "Collega questa chat a Vintel, salva cacce tracciate, ricevi qui i match live e apri ogni listing manualmente solo quando vale la pena agire.",
    helpTitle: "Cosa puoi fare qui",
    helpBody:
      "/status controlla account e cacce attive. /link <token> collega questa chat dalla dashboard. /id mostra il chat id per il collegamento manuale in Vintel.",
    notLinked:
      "Questa chat non e' ancora collegata. Apri Vintel e usa il bottone Telegram automatico, oppure incolla il chat id mostrato da /id nella dashboard.",
    linked: "Telegram e' ora collegato a <b>{name}</b>. Gli alert delle ricerche tracciate arriveranno in questa chat.",
    missingToken: "Token /start mancante. Apri direttamente il link Telegram dalla dashboard Vintel per collegare questa chat.",
    unknownToken: "Token di collegamento sconosciuto o scaduto. Rigenera il token dalla dashboard e riprova.",
    linkUsage: "Usa /link <token> con il comando mostrato nella dashboard, oppure incolla in Vintel il chat id ottenuto da /id.",
    chatIdTitle: "Collegamento Telegram manuale",
    chatIdBody: "Il tuo chat id e' <b>{chatId}</b>. Incollalo nella dashboard Vintel se vuoi collegare questa chat manualmente.",
    statusTitle: "Stato chat",
    statusLinked: "Account collegato: <b>{name}</b>",
    statusSearches: "Ricerche tracciate: <b>{count}</b>",
    statusKeywords: "Keyword: <b>{count}</b>",
    statusListings: "Match salvati: <b>{count}</b>",
    statusAlerts: "Alert consegnati: <b>{count}</b>",
    statusDelivery: "Consegna Telegram: <b>{value}</b>",
    enabled: "attiva",
    disabled: "disattiva",
    openApp: "Apri Vintel",
    openDashboard: "Apri dashboard",
    signIn: "Accedi",
    openListing: "Apri su Vinted",
    linkCommand: "Comando link manuale",
    menu: "Azioni rapide riaperte qui sotto.",
    greeting: "Ciao {name},",
    fallbackName: "li'",
    trackSavedTitle: "Tracking salvato",
    trackSavedSearch: "Ricerca: <b>{label}</b>",
    trackSavedCategory: "Categoria: <b>{value}</b>",
    trackSavedBudget: "Cap prezzo: <b>{value}</b>",
    trackSavedKeywords: "Keyword: <b>{value}</b>",
    trackSavedBody: "Vintel monitorera' ora questa caccia e inviera' qui i match freschi."
  }
} as const;

let metadataSyncPromise: Promise<void> | null = null;

function botToken() {
  return process.env.TELEGRAM_BOT_TOKEN ?? "";
}

function appUrl() {
  return (process.env.AUTH_URL ?? process.env.APP_URL ?? "https://app.eeess.cyou").replace(/\/$/, "");
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

function applyTemplate(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
}

function getLocale(user: UserRecord | null) {
  return user?.locale ?? "it";
}

function getReplyKeyboard(locale: Locale, user: UserRecord | null) {
  const t = telegramCopy[locale];

  return {
    keyboard: [
      [{ text: "/menu" }, { text: "/status" }, { text: "/id" }],
      [{ text: "/help" }, { text: "/link" }, { text: user ? "/dashboard" : "/start" }]
    ],
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: t.helpTitle
  };
}

function getInlineActions(locale: Locale, user: UserRecord | null) {
  const t = telegramCopy[locale];

  return {
    inline_keyboard: [
      [
        {
          text: t.openApp,
          url: appUrl()
        },
        {
          text: user ? t.openDashboard : t.signIn,
          url: `${appUrl()}${user ? "/dashboard" : "/signin"}`
        }
      ]
    ]
  };
}

async function telegramRequest(method: string, body: Record<string, unknown>) {
  const response = await fetch(api(method), {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Telegram ${method} failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function ensureTelegramBotMetadata() {
  if (!botToken()) {
    return;
  }

  if (!metadataSyncPromise) {
    metadataSyncPromise = Promise.allSettled([
      telegramRequest("setMyDescription", {
        description: "Link Vintel tracked hunts, receive Telegram alerts, and manual-open each listing."
      }),
      telegramRequest("setMyShortDescription", {
        short_description: "Tracked hunts, Telegram alerts, manual-open flow."
      }),
      telegramRequest("setMyCommands", {
        commands: [
          { command: "start", description: "Open welcome or link this chat" },
          { command: "link", description: "Link this chat with a dashboard token" },
          { command: "id", description: "Show this Telegram chat id" },
          { command: "menu", description: "Show quick actions" },
          { command: "status", description: "Show linked account status" },
          { command: "help", description: "Show help and setup steps" },
          { command: "dashboard", description: "Open Vintel dashboard" }
        ]
      })
    ]).then(() => undefined);
  }

  await metadataSyncPromise;
}

async function getLinkedUser(chatId: string) {
  return getUserByTelegramChatId(chatId);
}

async function sendBotMenu(chatId: string, user: UserRecord | null) {
  const locale = getLocale(user);
  const t = telegramCopy[locale];

  await sendTelegramMessage(String(chatId), t.menu, {
    reply_markup: getReplyKeyboard(locale, user)
  });

  await sendTelegramMessage(String(chatId), `<b>${t.welcomeTitle}</b>\n${t.welcomeBody}\n\n${t.linkUsage}`, {
    reply_markup: getInlineActions(locale, user),
    disable_web_page_preview: true
  });
}

async function sendAppLinks(chatId: string, user: UserRecord | null) {
  const locale = getLocale(user);
  const t = telegramCopy[locale];

  await sendTelegramMessage(String(chatId), `<b>${t.openApp}</b>`, {
    reply_markup: getInlineActions(locale, user),
    disable_web_page_preview: true
  });
}

async function sendBotHelp(chatId: string, user: UserRecord | null) {
  const locale = getLocale(user);
  const t = telegramCopy[locale];

  await sendTelegramMessage(String(chatId), `<b>${t.helpTitle}</b>\n${t.helpBody}`, {
    reply_markup: getReplyKeyboard(locale, user)
  });

  await sendAppLinks(chatId, user);
}

async function sendTelegramChatId(chatId: string, user: UserRecord | null) {
  const locale = getLocale(user);
  const t = telegramCopy[locale];

  await sendTelegramMessage(String(chatId), `<b>${t.chatIdTitle}</b>\n${applyTemplate(t.chatIdBody, { chatId })}`, {
    reply_markup: getReplyKeyboard(locale, user)
  });
}

async function sendBotStatus(chatId: string, user: UserRecord | null) {
  const locale = getLocale(user);
  const t = telegramCopy[locale];

  if (!user) {
    await sendTelegramMessage(String(chatId), t.notLinked, {
      reply_markup: getReplyKeyboard(locale, user)
    });
    await sendAppLinks(chatId, user);
    return;
  }

  const [alerts, listings] = await Promise.all([readAlerts(), readListings()]);
  const deliveredAlerts = alerts.filter((entry) => entry.userId === user.id).length;
  const matchedListings = listings.filter((entry) => entry.matchedUserIds.includes(user.id)).length;
  const lines = [
    `<b>${t.statusTitle}</b>`,
    applyTemplate(t.statusLinked, { name: escapeHtml(user.name) }),
    applyTemplate(t.statusSearches, { count: user.filters.trackedSearches.length || user.filters.searchUrls.length }),
    applyTemplate(t.statusKeywords, { count: user.filters.includeKeywords.length }),
    applyTemplate(t.statusListings, { count: matchedListings }),
    applyTemplate(t.statusAlerts, { count: deliveredAlerts }),
    applyTemplate(t.statusDelivery, { value: user.telegramEnabled ? t.enabled : t.disabled })
  ];

  await sendTelegramMessage(String(chatId), lines.join("\n"), {
    reply_markup: getReplyKeyboard(locale, user),
    disable_web_page_preview: true
  });

  await sendAppLinks(chatId, user);
}

export async function getTelegramBotProfile() {
  if (!botToken()) {
    return null;
  }

  await ensureTelegramBotMetadata();

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

  await ensureTelegramBotMetadata();

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

export function buildTelegramLinkCommand(user: Pick<UserRecord, "telegramLinkToken">) {
  return `/link ${user.telegramLinkToken}`;
}

export async function sendTelegramAlert(user: UserRecord, listing: ListingRecord) {
  if (!user.telegramEnabled || !user.telegramChatId || !botToken()) {
    return false;
  }

  const locale = getLocale(user);
  const t = telegramCopy[locale];
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
            text: t.openListing,
            url: listing.url
          },
          {
            text: t.openDashboard,
            url: `${appUrl()}/dashboard`
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

export async function sendTelegramTrackingConfirmation(
  user: UserRecord,
  trackedSearch: {
    label: string;
    categoryTitle: string | null;
    maxPriceCents: number | null;
    includeKeywords: string[];
  }
) {
  if (!user.telegramEnabled || !user.telegramChatId || !botToken()) {
    return false;
  }

  const locale = getLocale(user);
  const t = telegramCopy[locale];
  const lines = [
    `<b>${t.trackSavedTitle}</b>`,
    applyTemplate(t.trackSavedSearch, { label: escapeHtml(trackedSearch.label) })
  ];

  if (trackedSearch.categoryTitle) {
    lines.push(applyTemplate(t.trackSavedCategory, { value: escapeHtml(trackedSearch.categoryTitle) }));
  }

  if (trackedSearch.maxPriceCents !== null) {
    lines.push(
      applyTemplate(t.trackSavedBudget, {
        value: escapeHtml(`${(trackedSearch.maxPriceCents / 100).toFixed(2)} EUR`)
      })
    );
  }

  if (trackedSearch.includeKeywords.length > 0) {
    lines.push(applyTemplate(t.trackSavedKeywords, { value: escapeHtml(trackedSearch.includeKeywords.join(", ")) }));
  }

  lines.push(t.trackSavedBody);

  await sendTelegramMessage(user.telegramChatId, lines.join("\n"), {
    reply_markup: getInlineActions(locale, user),
    disable_web_page_preview: true
  });

  return true;
}

function normalizeCommand(text: string) {
  return text.split(/\s+/)[0]?.split("@")[0]?.toLowerCase() ?? "";
}

async function linkTelegramChat(chatId: string, token: string) {
  const linkedUser = await getLinkedUser(chatId);
  const locale = getLocale(linkedUser);
  const t = telegramCopy[locale];
  const user = await getUserByTelegramLinkToken(token);

  if (!user) {
    await sendTelegramMessage(chatId, t.unknownToken, {
      reply_markup: getReplyKeyboard(locale, linkedUser)
    });
    await sendAppLinks(chatId, linkedUser);
    return { ok: true, action: "unknown-token" as const };
  }

  await updateUserById(user.id, (current) => ({
    ...current,
    telegramChatId: String(chatId),
    telegramEnabled: true
  }));

  const refreshedUser = await getLinkedUser(String(chatId));
  await sendTelegramMessage(
    String(chatId),
    applyTemplate(telegramCopy[getLocale(refreshedUser)].linked, { name: escapeHtml(user.name) }),
    {
      reply_markup: getReplyKeyboard(getLocale(refreshedUser), refreshedUser)
    }
  );

  await sendAppLinks(String(chatId), refreshedUser);
  await sendBotStatus(String(chatId), refreshedUser);
  return { ok: true, action: "linked" as const, userId: user.id };
}

export async function handleTelegramWebhook(update: TelegramWebhookUpdate) {
  await ensureTelegramBotMetadata();

  const message = update.message ?? update.edited_message;
  const chatId = message?.chat.id;
  const text = message?.text?.trim();

  if (!chatId) {
    return { ok: true, action: "ignored" as const };
  }

  const linkedUser = await getLinkedUser(String(chatId));
  const locale = getLocale(linkedUser);
  const t = telegramCopy[locale];

  if (!text) {
    await sendBotMenu(String(chatId), linkedUser);
    return { ok: true, action: "menu" as const };
  }

  const command = normalizeCommand(text);

  if (command === "/help") {
    await sendBotHelp(String(chatId), linkedUser);
    return { ok: true, action: "help" as const };
  }

  if (command === "/menu") {
    await sendBotMenu(String(chatId), linkedUser);
    return { ok: true, action: "menu" as const };
  }

  if (command === "/status") {
    await sendBotStatus(String(chatId), linkedUser);
    return { ok: true, action: "status" as const };
  }

  if (command === "/id") {
    await sendTelegramChatId(String(chatId), linkedUser);
    return { ok: true, action: "chat-id" as const };
  }

  if (command === "/link") {
    const payload = text.replace(/^\/link(@\w+)?/, "").trim();
    if (!payload) {
      await sendTelegramMessage(String(chatId), t.linkUsage, {
        reply_markup: getReplyKeyboard(locale, linkedUser)
      });
      await sendTelegramChatId(String(chatId), linkedUser);
      return { ok: true, action: "link-usage" as const };
    }

    return linkTelegramChat(String(chatId), payload);
  }

  if (command === "/dashboard") {
    await sendTelegramMessage(String(chatId), `<b>${t.welcomeTitle}</b>\n${t.welcomeBody}`, {
      reply_markup: getReplyKeyboard(locale, linkedUser),
      disable_web_page_preview: true
    });
    await sendAppLinks(String(chatId), linkedUser);
    return { ok: true, action: "dashboard" as const };
  }

  if (command !== "/start") {
    await sendBotMenu(String(chatId), linkedUser);
    return { ok: true, action: "fallback-menu" as const };
  }

  const payload = text.replace(/^\/start(@\w+)?/, "").trim();
  if (!payload) {
    const firstName = message?.from?.first_name?.trim() || t.fallbackName;
    await sendTelegramMessage(
      String(chatId),
      `<b>${t.welcomeTitle}</b>\n${applyTemplate(t.greeting, { name: escapeHtml(firstName) })}\n${t.welcomeBody}\n\n${t.linkUsage}`,
      {
        reply_markup: getReplyKeyboard(locale, linkedUser),
        disable_web_page_preview: true
      }
    );
    await sendAppLinks(String(chatId), linkedUser);
    await sendTelegramChatId(String(chatId), linkedUser);
    return { ok: true, action: "welcome" as const };
  }

  return linkTelegramChat(String(chatId), payload);
}
