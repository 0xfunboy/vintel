import { NextRequest, NextResponse } from "next/server";

import { buildVintedCatalogUrl, searchVintedCatalog } from "@/lib/vinted";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const categoryPath = request.nextUrl.searchParams.get("categoryPath");
  const rawPriceTo = request.nextUrl.searchParams.get("priceTo");
  const priceTo = rawPriceTo ? Number(rawPriceTo) : null;
  const normalizedPriceTo = priceTo && Number.isFinite(priceTo) && priceTo > 0 ? priceTo : null;

  try {
    const result = await searchVintedCatalog({
      query,
      categoryPath,
      priceTo: normalizedPriceTo,
      limit: 24
    });

    return NextResponse.json({
      ok: true,
      result: {
        query: result.query,
        searchUrl: result.searchUrl,
        listings: result.listings,
        categories: result.categories,
        totalEntries: result.totalEntries,
        generatedAt: result.generatedAt,
        fallbackUsed: result.fallbackUsed,
        fallbackQueries: result.fallbackQueries
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vinted live search failed";
    const liveBlocked = /403/.test(message);

    return NextResponse.json({
      ok: true,
      result: {
        query,
        searchUrl: buildVintedCatalogUrl({
          query,
          categoryPath,
          priceTo: normalizedPriceTo
        }),
        listings: [],
        categories: [],
        totalEntries: 0,
        generatedAt: new Date().toISOString(),
        fallbackUsed: false,
        fallbackQueries: [],
        liveBlocked,
        statusMessage: message
      },
      error: liveBlocked ? "live-blocked" : message
    });
  }
}
