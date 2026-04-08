"use server";

import { randomBytes } from "node:crypto";

import { redirect } from "next/navigation";

import { auth, isGoogleConfigured, signIn, signOut } from "@/auth";
import { deleteUserData, getUserByEmail, updateUserById } from "@/lib/db";

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

export async function rotateTelegramToken() {
  const user = await requireUser();

  await updateUserById(user.id, (current) => ({
    ...current,
    telegramLinkToken: randomBytes(18).toString("base64url")
  }));

  redirect("/dashboard?telegram=rotated");
}

export async function deleteAccountAction() {
  const user = await requireUser();
  await deleteUserData(user.id);
  await signOut({
    redirectTo: "/"
  });
}
