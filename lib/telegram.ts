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
import { normalizeVintedCatalogUrl } from "./vinted";

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
      "/status — account &amp; hunts. /hunts — list tracked hunts. /remove N — remove hunt by number. /addurl URL — add Vinted search URL. /link TOKEN — link from dashboard. /id — show your chat id.",
    notLinked:
      "This chat is not linked yet. Open Vintel and use the automatic Telegram button, or paste your chat id in the dashboard after running /id here.",
    linked: "Telegram is now linked to <b>{name}</b>. Alerts for your tracked searches will land in this chat.",
    missingToken: "Missing start token. Open the Telegram link directly from your Vintel dashboard to bind this chat.",
    unknownToken: "Unknown or expired link token. Rotate the Telegram token from your dashboard and try again.",
    linkUsage: "Use /link TOKEN (from your dashboard) to link this chat, or paste the chat id from /id into Vintel.",
    chatIdTitle: "Manual Telegram link",
    chatIdBody: "Your chat id is <b>{chatId}</b>. Paste it into the Vintel dashboard if you want to link this chat manually.",
    statusTitle: "Chat status",
    statusLinked: "Linked account: <b>{name}</b>",
    statusSearches: "Tracked searches: <b>{count}</b>",
    statusKeywords: "Keywords: <b>{count}</b>",
    statusListings: "Stored matches: <b>{count}</b>",
    statusAlerts: "Delivered alerts: <b>{count}</b>",
    statusDelivery: "Telegram delivery: <b>{value}</b>",
    statusMinScore: "Min score: <b>{value}</b>",
    statusKeywordMode: "Keyword mode: <b>{value}</b>",
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
    trackSavedBody: "Vintel will now watch this hunt and send fresh matches here.",
    huntsTitle: "Your tracked hunts",
    huntsEmpty: "No tracked hunts yet. Add one from the Vintel dashboard or use /addurl.",
    huntsRemoveHint: "Use /remove &lt;number&gt; to delete a hunt.",
    huntsRemoved: "Hunt <b>{label}</b> removed.",
    huntsRemoveInvalid: "Invalid hunt number. Use /hunts to see the list.",
    addUrlUsage: "Usage: /addurl &lt;Vinted search URL&gt;",
    addUrlInvalid: "Invalid or non-Vinted URL. Only vinted.it and vinted.com URLs are accepted.",
    addUrlSaved: "URL tracked: <b>{url}</b>\nVintel will now watch this search and send fresh matches here.",
    settingsTitle: "Your current filters",
    settingsCategories: "Categories: <b>{value}</b>",
    settingsKeywords: "Include keywords: <b>{value}</b>",
    settingsExclude: "Exclude keywords: <b>{value}</b>",
    settingsMode: "Keyword mode: <b>{value}</b>",
    settingsMinPrice: "Min price: <b>{value}</b>",
    settingsMaxPrice: "Max price: <b>{value}</b>",
    settingsScore: "Min score: <b>{value}</b>",
    settingsNone: "(none)"
  },
  it: {
    welcomeTitle: "Bot sniper Vintel",
    welcomeBody:
      "Collega questa chat a Vintel, salva cacce tracciate, ricevi qui i match live e apri ogni listing manualmente solo quando vale la pena agire.",
    helpTitle: "Cosa puoi fare qui",
    helpBody:
      "/status controlla account e cacce attive. /hunts elenca le ricerche tracciate. /remove &lt;n&gt; rimuove la caccia per numero. /addurl &lt;url&gt; aggiunge un URL di ricerca Vinted. /link &lt;token&gt; collega questa chat dalla dashboard. /id mostra il chat id per il collegamento manuale.",
    notLinked:
      "Questa chat non e' ancora collegata. Apri Vintel e usa il bottone Telegram automatico, oppure incolla il chat id mostrato da /id nella dashboard.",
    linked: "Telegram e' ora collegato a <b>{name}</b>. Gli alert delle ricerche tracciate arriveranno in questa chat.",
    missingToken: "Token /start mancante. Apri direttamente il link Telegram dalla dashboard Vintel per collegare questa chat.",
    unknownToken: "Token di collegamento sconosciuto o scaduto. Rigenera il token dalla dashboard e riprova.",
    linkUsage: "Usa /link TOKEN (dalla dashboard) per collegare questa chat, oppure incolla in Vintel il chat id ottenuto da /id.",
    chatIdTitle: "Collegamento Telegram manuale",
    chatIdBody: "Il tuo chat id e' <b>{chatId}</b>. Incollalo nella dashboard Vintel se vuoi collegare questa chat manualmente.",
    statusTitle: "Stato chat",
    statusLinked: "Account collegato: <b>{name}</b>",
    statusSearches: "Ricerche tracciate: <b>{count}</b>",
    statusKeywords: "Keyword: <b>{count}</b>",
    statusListings: "Match salvati: <b>{count}</b>",
    statusAlerts: "Alert consegnati: <b>{count}</b>",
    statusDelivery: "Consegna Telegram: <b>{value}</b>",
    statusMinScore: "Score minimo: <b>{value}</b>",
    statusKeywordMode: "Logica keyword: <b>{value}</b>",
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
    trackSavedBody: "Vintel monitorera' ora questa caccia e inviera' qui i match freschi.",
    huntsTitle: "Le tue cacce tracciate",
    huntsEmpty: "Ancora nessuna caccia tracciata. Aggiungila dalla dashboard Vintel o usa /addurl.",
    huntsRemoveHint: "Usa /remove &lt;numero&gt; per eliminare una caccia.",
    huntsRemoved: "Caccia <b>{label}</b> rimossa.",
    huntsRemoveInvalid: "Numero caccia non valido. Usa /hunts per vedere la lista.",
    addUrlUsage: "Uso: /addurl &lt;URL ricerca Vinted&gt;",
    addUrlInvalid: "URL non valido o non Vinted. Sono accettati solo URL vinted.it e vinted.com.",
    addUrlSaved: "URL tracciato: <b>{url}</b>\nVintel monitorera' ora questa ricerca e inviera' qui i match freschi.",
    settingsTitle: "I tuoi filtri attuali",
    settingsCategories: "Categorie: <b>{value}</b>",
    settingsKeywords: "Keyword incluse: <b>{value}</b>",
    settingsExclude: "Keyword escluse: <b>{value}</b>",
    settingsMode: "Logica keyword: <b>{value}</b>",
    settingsMinPrice: "Prezzo minimo: <b>{value}</b>",
    settingsMaxPrice: "Prezzo massimo: <b>{value}</b>",
    settingsScore: "Score minimo: <b>{value}</b>",
    settingsNone: "(nessuno)"
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
      [{ text: "/menu" }, { text: "/status" }, { text: "/hunts" }],
      [{ text: "/id" }, { text: "/help" }, { text: user ? "/dashboard" : "/start" }]
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
          { command: "hunts", description: "List your tracked hunts" },
          { command: "remove", description: "Remove a tracked hunt by number" },
          { command: "addurl", description: "Add a Vinted search URL to track" },
          { command: "settings", description: "Show your current filter settings" },
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

async function sendBotHunts(chatId: string, user: UserRecord | null) {
  const locale = getLocale(user);
  const t = telegramCopy[locale];

  if (!user) {
    await sendTelegramMessage(String(chatId), t.notLinked, {
      reply_markup: getReplyKeyboard(locale, user)
    });
    await sendAppLinks(chatId, user);
    return;
  }

  const hunts = user.filters.trackedSearches;

  if (hunts.length === 0) {
    await sendTelegramMessage(String(chatId), `<b>${t.huntsTitle}</b>\n${t.huntsEmpty}`, {
      reply_markup: getReplyKeyboard(locale, user)
    });
    return;
  }

  const lines = [`<b>${t.huntsTitle}</b> (${hunts.length})`];
  hunts.slice(0, 15).forEach((hunt, i) => {
    const parts: string[] = [`${i + 1}. <b>${escapeHtml(hunt.label)}</b>`];
    if (hunt.categoryTitle) {
      parts.push(`[${escapeHtml(hunt.categoryTitle)}]`);
    }
    if (hunt.maxPriceCents) {
      parts.push(`max ${(hunt.maxPriceCents / 100).toFixed(0)}€`);
    }
    if (hunt.includeKeywords.length > 0) {
      parts.push(escapeHtml(hunt.includeKeywords.slice(0, 3).join(", ")));
    }
    lines.push(parts.join(" — "));
  });

  if (hunts.length > 15) {
    lines.push(`…and ${hunts.length - 15} more`);
  }

  lines.push(`\n${t.huntsRemoveHint}`);

  await sendTelegramMessage(String(chatId), lines.join("\n"), {
    reply_markup: getReplyKeyboard(locale, user),
    disable_web_page_preview: true
  });
}

async function removeBotHunt(chatId: string, user: UserRecord | null, indexStr: string) {
  const locale = getLocale(user);
  const t = telegramCopy[locale];

  if (!user) {
    await sendTelegramMessage(String(chatId), t.notLinked, {
      reply_markup: getReplyKeyboard(locale, user)
    });
    return { ok: true, action: "not-linked" as const };
  }

  const index = parseInt(indexStr.trim(), 10) - 1;
  const hunt = user.filters.trackedSearches[index];

  if (!hunt) {
    await sendTelegramMessage(String(chatId), t.huntsRemoveInvalid, {
      reply_markup: getReplyKeyboard(locale, user)
    });
    return { ok: true, action: "remove-invalid" as const };
  }

  await updateUserById(user.id, (current) => ({
    ...current,
    filters: {
      ...current.filters,
      trackedSearches: current.filters.trackedSearches.filter((e) => e.id !== hunt.id),
      searchUrls: current.filters.searchUrls.filter((e) => e !== hunt.searchUrl)
    }
  }));

  await sendTelegramMessage(String(chatId), applyTemplate(t.huntsRemoved, { label: escapeHtml(hunt.label) }), {
    reply_markup: getReplyKeyboard(locale, user)
  });

  return { ok: true, action: "removed" as const };
}

async function addBotUrl(chatId: string, user: UserRecord | null, rawUrl: string) {
  const locale = getLocale(user);
  const t = telegramCopy[locale];

  if (!user) {
    await sendTelegramMessage(String(chatId), t.notLinked, {
      reply_markup: getReplyKeyboard(locale, user)
    });
    return { ok: true, action: "not-linked" as const };
  }

  if (!rawUrl.trim()) {
    await sendTelegramMessage(String(chatId), t.addUrlUsage, {
      reply_markup: getReplyKeyboard(locale, user)
    });
    return { ok: true, action: "addurl-usage" as const };
  }

  let normalized: string | null = null;
  try {
    normalized = normalizeVintedCatalogUrl(rawUrl.trim());
  } catch {
    normalized = null;
  }

  if (!normalized) {
    await sendTelegramMessage(String(chatId), t.addUrlInvalid, {
      reply_markup: getReplyKeyboard(locale, user)
    });
    return { ok: true, action: "addurl-invalid" as const };
  }

  const now = new Date().toISOString();
  await updateUserById(user.id, (current) => {
    const existing = current.filters.trackedSearches.find((e) => e.searchUrl === normalized);
    const trackedSearch = {
      id: existing?.id ?? randomUUID(),
      label: existing?.label ?? normalized!,
      query: "",
      searchUrl: normalized!,
      categoryTitle: null,
      includeKeywords: [],
      minPriceCents: null,
      maxPriceCents: null,
      createdAt: existing?.createdAt ?? now,
      lastTrackedAt: now
    };

    return {
      ...current,
      filters: {
        ...current.filters,
        searchUrls: [...new Set([normalized!, ...current.filters.searchUrls])],
        trackedSearches: [trackedSearch, ...current.filters.trackedSearches.filter((e) => e.searchUrl !== normalized)]
      }
    };
  });

  await sendTelegramMessage(String(chatId), applyTemplate(t.addUrlSaved, { url: escapeHtml(normalized) }), {
    reply_markup: getReplyKeyboard(locale, user),
    disable_web_page_preview: true
  });

  return { ok: true, action: "addurl-saved" as const };
}

async function sendBotSettings(chatId: string, user: UserRecord | null) {
  const locale = getLocale(user);
  const t = telegramCopy[locale];

  if (!user) {
    await sendTelegramMessage(String(chatId), t.notLinked, {
      reply_markup: getReplyKeyboard(locale, user)
    });
    return;
  }

  const f = user.filters;
  const none = t.settingsNone;

  const lines = [
    `<b>${t.settingsTitle}</b>`,
    applyTemplate(t.settingsCategories, { value: f.categories.join(", ") || none }),
    applyTemplate(t.settingsKeywords, { value: f.includeKeywords.join(", ") || none }),
    applyTemplate(t.settingsExclude, { value: f.excludeKeywords.join(", ") || none }),
    applyTemplate(t.settingsMode, { value: f.keywordMode.toUpperCase() }),
    applyTemplate(t.settingsMinPrice, { value: f.minPriceCents != null ? `${(f.minPriceCents / 100).toFixed(2)} EUR` : none }),
    applyTemplate(t.settingsMaxPrice, { value: f.maxPriceCents != null ? `${(f.maxPriceCents / 100).toFixed(2)} EUR` : none }),
    applyTemplate(t.settingsScore, { value: String(f.minScore) })
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

  if (command === "/hunts") {
    await sendBotHunts(String(chatId), linkedUser);
    return { ok: true, action: "hunts" as const };
  }

  if (command === "/remove") {
    const payload = text.replace(/^\/remove(@\w+)?/, "").trim();
    return removeBotHunt(String(chatId), linkedUser, payload);
  }

  if (command === "/addurl") {
    const payload = text.replace(/^\/addurl(@\w+)?/, "").trim();
    return addBotUrl(String(chatId), linkedUser, payload);
  }

  if (command === "/settings") {
    await sendBotSettings(String(chatId), linkedUser);
    return { ok: true, action: "settings" as const };
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
