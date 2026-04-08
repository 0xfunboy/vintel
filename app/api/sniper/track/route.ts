import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getUserByEmail, updateUserById } from "@/lib/db";
import { extractSniperKeywords, inferPriceBand, normalizeVintedCatalogUrl } from "@/lib/vinted";

const payloadSchema = z.object({
  query: z.string().optional().default(""),
  searchUrl: z.string().url().optional().nullable(),
  categoryTitle: z.string().optional().nullable(),
  listingTitle: z.string().optional().nullable(),
  listingPriceCents: z.number().int().nonnegative().optional().nullable(),
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
  const keywords = extractSniperKeywords([parsed.data.query, parsed.data.listingTitle, parsed.data.categoryTitle]);
  const shouldSeedPriceBand =
    normalizedSearchUrl !== null &&
    user.filters.searchUrls.length === 0 &&
    user.filters.minPriceCents === null &&
    user.filters.maxPriceCents === null;
  const inferredBand = shouldSeedPriceBand ? inferPriceBand(parsed.data.listingPriceCents) : { minPriceCents: null, maxPriceCents: null };

  const nextTrackedSearches = normalizedSearchUrl
    ? new Set([normalizedSearchUrl, ...user.filters.searchUrls]).size
    : user.filters.searchUrls.length;

  await updateUserById(user.id, (current) => ({
    ...current,
    filters: {
      ...current.filters,
      includeKeywords: [...new Set([...current.filters.includeKeywords, ...keywords])],
      searchUrls: normalizedSearchUrl ? [...new Set([normalizedSearchUrl, ...current.filters.searchUrls])] : current.filters.searchUrls,
      minPriceCents: current.filters.minPriceCents ?? inferredBand.minPriceCents,
      maxPriceCents: current.filters.maxPriceCents ?? parsed.data.maxPriceCents ?? inferredBand.maxPriceCents
    }
  }));

  return NextResponse.json({
    ok: true,
    searchUrl: normalizedSearchUrl,
    keywords,
    trackedSearches: nextTrackedSearches
  });
}
