import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getUserByEmail, updateUserById } from "@/lib/db";
import { sendTelegramTrackingConfirmation } from "@/lib/telegram";
import { extractSniperKeywords, inferPriceBand, normalizeVintedCatalogUrl } from "@/lib/vinted";

const payloadSchema = z.object({
  label: z.string().optional().default(""),
  query: z.string().optional().default(""),
  searchUrl: z.string().url().optional().nullable(),
  categoryTitle: z.string().optional().nullable(),
  listingTitle: z.string().optional().nullable(),
  listingPriceCents: z.number().int().nonnegative().optional().nullable(),
  includeKeywords: z.array(z.string()).optional().default([]),
  minPriceCents: z.number().int().nonnegative().optional().nullable(),
  maxPriceCents: z.number().int().nonnegative().optional().nullable()
});

export async function POST(request: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const user = await getUserByEmail(email);
  if (!user) {
    return NextResponse.json({ ok: false, error: "unknown-user" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const normalizedSearchUrl = parsed.data.searchUrl ? normalizeVintedCatalogUrl(parsed.data.searchUrl) : null;
  const keywords = parsed.data.includeKeywords.length
    ? parsed.data.includeKeywords.map((entry) => entry.trim()).filter(Boolean)
    : extractSniperKeywords([parsed.data.query, parsed.data.listingTitle, parsed.data.categoryTitle]);
  const inferredBand = inferPriceBand(parsed.data.listingPriceCents);
  const trackedSearchLabel =
    parsed.data.label.trim() ||
    parsed.data.query.trim() ||
    parsed.data.listingTitle?.trim() ||
    parsed.data.categoryTitle?.trim() ||
    normalizedSearchUrl ||
    "Tracked search";

  const nextTrackedSearches = normalizedSearchUrl
    ? new Set([normalizedSearchUrl, ...user.filters.searchUrls]).size
    : user.filters.searchUrls.length;

  await updateUserById(user.id, (current) => {
    const trackedSearch = normalizedSearchUrl
      ? {
          id:
            current.filters.trackedSearches.find((entry) => entry.searchUrl === normalizedSearchUrl)?.id ?? randomUUID(),
          label: trackedSearchLabel,
          query: parsed.data.query.trim(),
          searchUrl: normalizedSearchUrl,
          categoryTitle: parsed.data.categoryTitle?.trim() || null,
          includeKeywords: keywords,
          minPriceCents: parsed.data.minPriceCents ?? inferredBand.minPriceCents,
          maxPriceCents: parsed.data.maxPriceCents ?? inferredBand.maxPriceCents,
          createdAt:
            current.filters.trackedSearches.find((entry) => entry.searchUrl === normalizedSearchUrl)?.createdAt ??
            new Date().toISOString(),
          lastTrackedAt: new Date().toISOString()
        }
      : null;

    return {
      ...current,
      filters: {
        ...current.filters,
        searchUrls: normalizedSearchUrl ? [...new Set([normalizedSearchUrl, ...current.filters.searchUrls])] : current.filters.searchUrls,
        trackedSearches: trackedSearch
          ? [
              trackedSearch,
              ...current.filters.trackedSearches.filter((entry) => entry.searchUrl !== trackedSearch.searchUrl)
            ]
          : current.filters.trackedSearches
      }
    };
  });

  if (normalizedSearchUrl) {
    const refreshedUser = await getUserByEmail(email);
    const trackedSearch = refreshedUser?.filters.trackedSearches.find((entry) => entry.searchUrl === normalizedSearchUrl);
    if (refreshedUser && trackedSearch) {
      await sendTelegramTrackingConfirmation(refreshedUser, trackedSearch).catch(() => false);
    }
  }

  return NextResponse.json({
    ok: true,
    searchUrl: normalizedSearchUrl,
    keywords,
    trackedSearches: nextTrackedSearches
  });
}
