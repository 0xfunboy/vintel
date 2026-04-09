"use server";

import { randomBytes, randomUUID } from "node:crypto";

import { redirect } from "next/navigation";

import { auth, isGoogleConfigured, signIn, signOut } from "@/auth";
import { deleteUserData, getUserByEmail, updateUserById } from "@/lib/db";
import { sendTelegramMessage } from "@/lib/telegram";
import { normalizeVintedCatalogUrl } from "@/lib/vinted";

function parseCsv(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseOptionalNumber(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }

  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

async function requireUser() {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    redirect("/signin");
  }

  const user = await getUserByEmail(email);
  if (!user) {
    redirect("/signin");
  }

  return user;
}

export async function signInWithGoogle() {
  if (!isGoogleConfigured()) {
    throw new Error("Google OAuth is not configured");
  }

  await signIn("google", {
    redirectTo: "/dashboard"
  });
}

export async function signOutAction() {
  await signOut({
    redirectTo: "/"
  });
}

export async function saveDashboardSettings(formData: FormData) {
  const user = await requireUser();

  await updateUserById(user.id, (current) => ({
    ...current,
    telegramEnabled: formData.get("telegramEnabled") === "on",
    alertsEnabled: formData.get("alertsEnabled") === "on",
    filters: {
      ...current.filters,
      categories: parseCsv(formData.get("categories")),
      includeKeywords: parseCsv(formData.get("includeKeywords")),
      excludeKeywords: parseCsv(formData.get("excludeKeywords")),
      keywordMode: formData.get("keywordMode") === "and" ? "and" : "or",
      searchInDescription: formData.get("searchInDescription") === "on",
      sellersAllowlist: parseCsv(formData.get("sellersAllowlist")),
      sellersBlocklist: parseCsv(formData.get("sellersBlocklist")),
      searchUrls: String(formData.get("searchUrls") ?? "")
        .split("\n")
        .map((entry) => entry.trim())
        .filter(Boolean),
      minPriceCents: parseOptionalNumber(formData.get("minPriceCents")),
      maxPriceCents: parseOptionalNumber(formData.get("maxPriceCents")),
      minScore: Number(formData.get("minScore") ?? current.filters.minScore)
    }
  }));

  redirect("/dashboard?saved=1");
}

export async function addTrackedUrlAction(formData: FormData) {
  const user = await requireUser();
  const rawUrl = String(formData.get("searchUrl") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();

  if (!rawUrl) {
    redirect("/dashboard?tracked=missing-url");
  }

  let normalized: string | null = null;
  try {
    normalized = normalizeVintedCatalogUrl(rawUrl);
  } catch {
    redirect("/dashboard?tracked=invalid-url");
  }

  if (!normalized) {
    redirect("/dashboard?tracked=invalid-url");
  }

  const now = new Date().toISOString();
  const trackedSearchLabel = label || normalized;

  await updateUserById(user.id, (current) => {
    const existing = current.filters.trackedSearches.find((e) => e.searchUrl === normalized);
    const trackedSearch = {
      id: existing?.id ?? randomUUID(),
      label: trackedSearchLabel,
      query: "",
      searchUrl: normalized!,
      categoryTitle: null,
      includeKeywords: [],
      excludeKeywords: existing?.excludeKeywords ?? [],
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

  redirect("/dashboard?tracked=added");
}

export async function rotateTelegramToken() {
  const user = await requireUser();

  await updateUserById(user.id, (current) => ({
    ...current,
    telegramLinkToken: randomBytes(18).toString("base64url")
  }));

  redirect("/dashboard?telegram=rotated");
}

export async function linkTelegramChatIdAction(formData: FormData) {
  const user = await requireUser();
  const rawChatId = String(formData.get("telegramChatId") ?? "").trim();

  if (!/^-?\d+$/.test(rawChatId)) {
    redirect("/dashboard?telegram=invalid-chat-id");
  }

  await updateUserById(user.id, (current) => ({
    ...current,
    telegramChatId: rawChatId,
    telegramEnabled: true
  }));

  try {
    await sendTelegramMessage(rawChatId, "<b>Vintel</b>\nManual dashboard link confirmed for this chat.", {
      disable_web_page_preview: true
    });
  } catch {
    redirect("/dashboard?telegram=chat-unreachable");
  }

  redirect("/dashboard?telegram=linked");
}

export async function unlinkTelegramAction() {
  const user = await requireUser();

  await updateUserById(user.id, (current) => ({
    ...current,
    telegramChatId: null,
    telegramEnabled: false
  }));

  redirect("/dashboard?telegram=unlinked");
}

export async function removeTrackedSearchAction(formData: FormData) {
  const user = await requireUser();
  const trackedSearchId = String(formData.get("trackedSearchId") ?? "").trim();

  if (!trackedSearchId) {
    redirect("/dashboard?tracked=missing");
  }

  await updateUserById(user.id, (current) => {
    const nextTrackedSearches = current.filters.trackedSearches.filter((entry) => entry.id !== trackedSearchId);
    const removedSearchUrl = current.filters.trackedSearches.find((entry) => entry.id === trackedSearchId)?.searchUrl ?? null;

    return {
      ...current,
      filters: {
        ...current.filters,
        trackedSearches: nextTrackedSearches,
        searchUrls: removedSearchUrl
          ? current.filters.searchUrls.filter((entry) => entry !== removedSearchUrl)
          : current.filters.searchUrls
      }
    };
  });

  redirect("/dashboard?tracked=removed");
}

export async function deleteAccountAction() {
  const user = await requireUser();
  await deleteUserData(user.id);
  await signOut({
    redirectTo: "/"
  });
}
