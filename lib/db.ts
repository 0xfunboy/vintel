import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";

import type { AlertRecord, ListingRecord, Locale, Theme, UserExport, UserFilters, UserRecord } from "./types";

const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(process.cwd(), "data");

const defaults: UserFilters = {
  categories: [],
  includeKeywords: [],
  excludeKeywords: [],
  keywordMode: "or",
  searchInDescription: true,
  minPriceCents: null,
  maxPriceCents: null,
  minScore: 65,
  sellersAllowlist: [],
  sellersBlocklist: [],
  searchUrls: []
};

async function ensureDataDir() {
  await mkdir(dataDir, { recursive: true });
}

async function loadJson<T>(fileName: string, fallback: T): Promise<T> {
  await ensureDataDir();
  const filePath = path.join(dataDir, fileName);

  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    await saveJson(fileName, fallback);
    return fallback;
  }
}

async function saveJson<T>(fileName: string, value: T) {
  await ensureDataDir();
  const filePath = path.join(dataDir, fileName);
  await writeFile(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

export async function readUsers() {
  return loadJson<UserRecord[]>("users.json", []);
}

export async function writeUsers(users: UserRecord[]) {
  await saveJson("users.json", users);
}

export async function readListings() {
  return loadJson<ListingRecord[]>("listings.json", []);
}

export async function writeListings(listings: ListingRecord[]) {
  await saveJson("listings.json", listings);
}

export async function readAlerts() {
  return loadJson<AlertRecord[]>("alerts.json", []);
}

export async function writeAlerts(alerts: AlertRecord[]) {
  await saveJson("alerts.json", alerts);
}

export function createTelegramLinkToken() {
  return randomBytes(18).toString("base64url");
}

export function createUserDefaults(locale: Locale, theme: Theme): Pick<UserRecord, "locale" | "theme" | "telegramChatId" | "telegramLinkToken" | "telegramEnabled" | "alertsEnabled" | "filters"> {
  return {
    locale,
    theme,
    telegramChatId: null,
    telegramLinkToken: createTelegramLinkToken(),
    telegramEnabled: true,
    alertsEnabled: true,
    filters: defaults
  };
}

export async function ensureUser(input: {
  email: string;
  name: string | null | undefined;
  image: string | null | undefined;
  locale: Locale;
  theme: Theme;
}) {
  const users = await readUsers();
  const existing = users.find((user) => user.email.toLowerCase() === input.email.toLowerCase());
  const now = new Date().toISOString();

  if (existing) {
    const nextUsers = users.map((user) =>
      user.id !== existing.id
        ? user
        : {
            ...user,
            name: input.name ?? user.name,
            image: input.image ?? user.image,
            updatedAt: now
          }
    );

    await writeUsers(nextUsers);
    return nextUsers.find((user) => user.id === existing.id)!;
  }

  const user: UserRecord = {
    id: randomUUID(),
    email: input.email,
    name: input.name ?? input.email,
    image: input.image ?? null,
    createdAt: now,
    updatedAt: now,
    ...createUserDefaults(input.locale, input.theme)
  };

  await writeUsers([user, ...users]);
  return user;
}

export async function getUserByEmail(email: string) {
  const users = await readUsers();
  return users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function getUserByTelegramLinkToken(token: string) {
  const users = await readUsers();
  return users.find((user) => user.telegramLinkToken === token) ?? null;
}

export async function getUserByTelegramChatId(chatId: string) {
  const users = await readUsers();
  return users.find((user) => user.telegramChatId === chatId) ?? null;
}

export async function updateUserById(userId: string, updater: (user: UserRecord) => UserRecord) {
  const users = await readUsers();
  let updated: UserRecord | null = null;

  const nextUsers = users.map((user) => {
    if (user.id !== userId) {
      return user;
    }

    updated = {
      ...updater(user),
      updatedAt: new Date().toISOString()
    };

    return updated;
  });

  await writeUsers(nextUsers);
  return updated;
}

export async function exportUserData(userId: string): Promise<UserExport | null> {
  const [users, alerts, listings] = await Promise.all([readUsers(), readAlerts(), readListings()]);
  const user = users.find((entry) => entry.id === userId);

  if (!user) {
    return null;
  }

  return {
    profile: user,
    alerts: alerts.filter((alert) => alert.userId === user.id),
    listings: listings.filter((listing) => listing.matchedUserIds.includes(user.id))
  };
}

export async function deleteUserData(userId: string) {
  const [users, alerts, listings] = await Promise.all([readUsers(), readAlerts(), readListings()]);
  const nextUsers = users.filter((user) => user.id !== userId);
  const nextAlerts = alerts.filter((alert) => alert.userId !== userId);
  const nextListings = listings
    .map((listing) => ({
      ...listing,
      matchedUserIds: listing.matchedUserIds.filter((id) => id !== userId)
    }))
    .filter((listing) => listing.matchedUserIds.length > 0);

  await Promise.all([writeUsers(nextUsers), writeAlerts(nextAlerts), writeListings(nextListings)]);
}
