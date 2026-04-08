import { readUsers } from "./db";
import { ingestListings } from "./ingest";
import type { IngestSummary, UserRecord } from "./types";
import { buildVintedCatalogUrl, normalizeVintedCatalogUrl, searchVintedCatalog } from "./vinted";

type PollSummary = {
  users: number;
  searches: number;
  fetched: number;
  unique: number;
  ingest: IngestSummary;
  failures: string[];
};

function buildFallbackSearchUrl(user: UserRecord) {
  const keywords = user.filters.includeKeywords.slice(0, 4).join(" ").trim();
  const categoryHint = user.filters.categories[0]?.trim() ?? "";
  const query = keywords || categoryHint;

  if (!query) {
    return null;
  }

  return buildVintedCatalogUrl({ query });
}

function collectTrackedSearchUrls(user: UserRecord) {
  const tracked = user.filters.searchUrls.map(normalizeVintedCatalogUrl).filter((value): value is string => Boolean(value));
  if (tracked.length > 0) {
    return tracked;
  }

  const fallback = buildFallbackSearchUrl(user);
  return fallback ? [fallback] : [];
}

export async function pollTrackedSearches(): Promise<PollSummary> {
  const users = await readUsers();
  const uniqueSearchUrls = [...new Set(users.flatMap(collectTrackedSearchUrls))];
  const failures: string[] = [];
  const fetchedItems = [];

  for (const searchUrl of uniqueSearchUrls) {
    try {
      const result = await searchVintedCatalog({ searchUrl, limit: 36 });
      fetchedItems.push(...result.ingestItems);
    } catch (error) {
      failures.push(`${searchUrl} :: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  const seen = new Set<string>();
  const uniqueItems = fetchedItems.filter((item) => {
    const key = `${item.source}:${item.sourceListingId}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });

  const ingest = await ingestListings(uniqueItems);

  return {
    users: users.length,
    searches: uniqueSearchUrls.length,
    fetched: fetchedItems.length,
    unique: uniqueItems.length,
    ingest,
    failures
  };
}
