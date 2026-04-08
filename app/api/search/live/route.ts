import { NextRequest, NextResponse } from "next/server";

import { searchVintedCatalog } from "@/lib/vinted";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const categoryPath = request.nextUrl.searchParams.get("categoryPath");

  try {
    const result = await searchVintedCatalog({
      query,
      categoryPath,
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
        generatedAt: result.generatedAt
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Vinted live search failed"
      },
      { status: 502 }
    );
  }
}
