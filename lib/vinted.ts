import type { IngestListing, ListingRecord, Locale } from "./types";

const ITEM_BLOCK_PATTERN = /\\"items\\":\{\\"items\\":(\[.*?\]),\\"pagination\\":(\{.*?\}),\\"searchTrackingParams\\":/s;
const CATEGORY_BLOCK_PATTERN = /\\"facetedCategories\\":\{\\"categories\\":(\[.*?\]),\\"uiState\\":/s;
const STOP_WORDS = new Set([
  "a",
  "ad",
  "al",
  "alla",
  "con",
  "da",
  "dei",
  "del",
  "della",
  "di",
  "for",
  "gli",
  "il",
  "in",
  "la",
  "new",
  "per",
  "pc",
  "rtx",
  "su",
  "the",
  "un",
  "una",
  "with"
]);

type RawVintedThumbnail = {
  type?: string;
  url?: string;
};

type RawVintedPhoto = {
  url?: string;
  thumbnails?: RawVintedThumbnail[];
  high_resolution?: {
    timestamp?: number;
  };
};

type RawVintedItem = {
  id: number;
  title: string;
  brand_title?: string;
  status?: string;
  price?: {
    amount?: string;
    currency_code?: string;
  };
  url?: string;
  path?: string;
  photo?: RawVintedPhoto | null;
  photos?: RawVintedPhoto[];
  user?: {
    login?: string;
    profile_url?: string;
  };
  promoted?: boolean;
};

type RawVintedCategory = {
  id: string;
  title: string;
  url: string;
  item_count?: number;
};

type RawVintedPagination = {
  total_entries?: number;
};

export type VintedFacetCategory = {
  id: string;
  title: string;
  itemCount: number;
  path: string;
  url: string;
};

export type VintedCatalogSearchResult = {
  query: string;
  searchUrl: string;
  listings: ListingRecord[];
  ingestItems: IngestListing[];
  categories: VintedFacetCategory[];
  totalEntries: number;
  generatedAt: string;
  fallbackUsed: boolean;
  fallbackQueries: string[];
};

type SearchVintedCatalogInput = {
  locale?: Locale;
  query?: string;
  searchUrl?: string;
  categoryPath?: string | null;
  priceTo?: number | null;
  limit?: number;
};

function getVintedBaseUrl() {
  return process.env.VINTED_BASE_URL?.trim() || "https://www.vinted.it";
}

function isAllowedVintedHost(hostname: string) {
  return hostname === "www.vinted.it" || hostname === "vinted.it" || hostname === "www.vinted.com" || hostname === "vinted.com";
}

function decodeEmbeddedJson<T>(value: string) {
  return JSON.parse(JSON.parse(`"${value}"`)) as T;
}

function normalizePriceToCents(amount?: string) {
  const number = Number(amount ?? "0");
  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(0, Math.round(number * 100));
}

function normalizeSearchText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function uniqueNormalizedQueries(values: string[]) {
  const seen = new Set<string>();
  const queries: string[] = [];

  for (const value of values) {
    const normalized = normalizeSearchText(value);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) {
      continue;
    }

    seen.add(key);
    queries.push(normalized);
  }

  return queries;
}

function normalizeTrackedUrl(url: string) {
  return url.replace(/\/+$/, "");
}

function coerceCategoryTitle(value: string | null | undefined) {
  const normalized = normalizeSearchText(value ?? "");
  if (!normalized) {
    return null;
  }

  if (normalized.toLowerCase() === "tutto" || normalized.toLowerCase() === "all") {
    return null;
  }

  return normalized;
}

function getBestPhoto(raw: RawVintedItem) {
  return raw.photo ?? raw.photos?.[0] ?? null;
}

function getBestImageUrl(raw: RawVintedItem) {
  const photo = getBestPhoto(raw);
  if (!photo) {
    return null;
  }

  const thumb = photo.thumbnails?.find((entry) => entry.type === "thumb310x430")?.url;
  return thumb ?? photo.url ?? null;
}

function getPostedAt(raw: RawVintedItem) {
  const photo = getBestPhoto(raw);
  const timestamp = photo?.high_resolution?.timestamp;
  if (typeof timestamp === "number" && Number.isFinite(timestamp) && timestamp > 0) {
    return new Date(timestamp * 1000).toISOString();
  }

  return new Date().toISOString();
}

function normalizeCategoryPath(input: string | null | undefined) {
  if (!input) {
    return null;
  }

  if (input.startsWith("http://") || input.startsWith("https://")) {
    const url = new URL(input);
    return url.pathname.startsWith("/catalog") ? url.pathname : null;
  }

  return input.startsWith("/catalog") ? input : null;
}

function getCategoryFromPath(pathname: string) {
  const match = pathname.match(/^\/catalog\/\d+-([^/?#]+)/);
  if (!match) {
    return null;
  }

  return match[1]
    .replace(/-/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function buildFallbackCategory(raw: RawVintedItem, searchUrl: URL, categories: VintedFacetCategory[]) {
  void raw;
  void categories;
  return coerceCategoryTitle(getCategoryFromPath(searchUrl.pathname)) ?? null;
}

function extractKeywordsFromText(value: string) {
  const normalized = normalizeSearchText(value);
  if (!normalized) {
    return [];
  }

  const seen = new Set<string>();
  const tokens: string[] = [];

  for (const token of normalized.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    if (token.length < 3 || STOP_WORDS.has(token)) {
      continue;
    }

    if (seen.has(token)) {
      continue;
    }

    seen.add(token);
    tokens.push(token);
  }

  return tokens.slice(0, 6);
}

function splitAlphaNumericToken(token: string) {
  const match = token.match(/^([a-z]+)(\d+[a-z0-9]*)$/i);
  if (!match) {
    return null;
  }

  return `${match[1]} ${match[2]}`;
}

function joinSeparatedModelTokens(tokens: string[]) {
  if (tokens.length !== 2) {
    return null;
  }

  if (!/^[a-z]{2,6}$/i.test(tokens[0]) || !/^\d{3,5}[a-z0-9]*$/i.test(tokens[1])) {
    return null;
  }

  return `${tokens[0]}${tokens[1]}`;
}

function buildExpandedSearchQueries(query: string) {
  const normalized = normalizeSearchText(query);
  if (!normalized) {
    return [];
  }

  const originalTokens = normalized.split(/\s+/).filter(Boolean);
  const lowerTokens = originalTokens.map((token) => token.toLowerCase());
  const candidates: string[] = [];

  for (const token of originalTokens) {
    const splitToken = splitAlphaNumericToken(token);
    if (splitToken) {
      candidates.push(normalized.replace(token, splitToken));
    }
  }

  const joinedModel = joinSeparatedModelTokens(originalTokens);
  if (joinedModel) {
    candidates.push(joinedModel);
  }

  if (lowerTokens.includes("ddr5") || lowerTokens.includes("ddr4")) {
    const ddrToken = lowerTokens.includes("ddr5") ? "DDR5" : "DDR4";
    candidates.push(`${ddrToken} RAM`);
    candidates.push(`RAM ${ddrToken}`);
    candidates.push(`kit RAM ${ddrToken}`);
    candidates.push(`${ddrToken} memory`);
  }

  if (lowerTokens.includes("ram")) {
    candidates.push(`${normalized} kit`);
    candidates.push(`${normalized} memory`);
  }

  if (
    lowerTokens.includes("gpu") ||
    lowerTokens.includes("rtx") ||
    lowerTokens.includes("gtx") ||
    lowerTokens.includes("radeon") ||
    lowerTokens.includes("rx") ||
    lowerTokens.some((token) => /^\d{3,5}$/.test(token))
  ) {
    candidates.push(`${normalized} GPU`);
    candidates.push(`${normalized} scheda video`);
    candidates.push(`${normalized} graphics card`);
  }

  if (lowerTokens.includes("ssd") || lowerTokens.includes("nvme")) {
    candidates.push(`${normalized} NVMe`);
    candidates.push(`${normalized} M.2`);
  }

  if (lowerTokens.includes("monitor")) {
    candidates.push(`${normalized} gaming`);
  }

  return uniqueNormalizedQueries(candidates).filter((candidate) => candidate.toLowerCase() !== normalized.toLowerCase()).slice(0, 5);
}

function toAbsoluteCatalogUrl(pathOrUrl: string) {
  const base = new URL(getVintedBaseUrl());
  const url = new URL(pathOrUrl, base);

  if (!isAllowedVintedHost(url.hostname) || !url.pathname.startsWith("/catalog")) {
    throw new Error("Unsupported Vinted catalog URL");
  }

  url.searchParams.delete("page");
  url.searchParams.set("disabled_personalization", "true");
  if (!url.searchParams.has("order")) {
    url.searchParams.set("order", "newest_first");
  }

  return url;
}

export function buildVintedCatalogUrl(input: { query?: string; categoryPath?: string | null; priceTo?: number | null }) {
  const url = toAbsoluteCatalogUrl(normalizeCategoryPath(input.categoryPath) ?? "/catalog");
  const query = normalizeSearchText(input.query ?? "");
  const priceTo =
    typeof input.priceTo === "number" && Number.isFinite(input.priceTo) && input.priceTo > 0
      ? Math.round(input.priceTo)
      : null;

  if (query) {
    url.searchParams.set("search_text", query);
  } else {
    url.searchParams.delete("search_text");
  }

  if (priceTo !== null) {
    url.searchParams.set("price_to", String(priceTo));
  } else {
    url.searchParams.delete("price_to");
  }

  return url.toString();
}

export function normalizeVintedCatalogUrl(value: string) {
  try {
    return normalizeTrackedUrl(toAbsoluteCatalogUrl(value).toString());
  } catch {
    return null;
  }
}

function normalizeCategory(raw: RawVintedCategory) {
  const absoluteUrl = toAbsoluteCatalogUrl(raw.url).toString();

  return {
    id: raw.id,
    title: raw.title,
    itemCount: raw.item_count ?? 0,
    path: new URL(absoluteUrl).pathname,
    url: absoluteUrl
  } satisfies VintedFacetCategory;
}

function toIngestListing(raw: RawVintedItem, fallbackCategory: string | null, searchUrl: string): IngestListing {
  return {
    source: "vinted",
    sourceListingId: String(raw.id),
    category: fallbackCategory,
    title: normalizeSearchText(raw.title),
    description: raw.status ? `${raw.status}${raw.brand_title ? ` • ${raw.brand_title}` : ""}` : raw.brand_title ?? null,
    url: raw.url ?? new URL(raw.path ?? `/items/${raw.id}`, getVintedBaseUrl()).toString(),
    imageUrl: getBestImageUrl(raw),
    priceCents: normalizePriceToCents(raw.price?.amount),
    currency: raw.price?.currency_code ?? "EUR",
    sellerName: raw.user?.login ?? "unknown",
    sellerUrl: raw.user?.profile_url ?? null,
    location: null,
    postedAt: getPostedAt(raw),
    searchUrl
  };
}

function toPublicListing(item: IngestListing): ListingRecord {
  return {
    id: `live:${item.source}:${item.sourceListingId}`,
    source: item.source,
    sourceListingId: item.sourceListingId,
    sourceSearchUrl: item.searchUrl ?? null,
    category: item.category ?? null,
    title: item.title,
    description: item.description ?? null,
    url: item.url,
    imageUrl: item.imageUrl ?? null,
    priceCents: item.priceCents,
    currency: item.currency,
    sellerName: item.sellerName,
    sellerUrl: item.sellerUrl ?? null,
    location: item.location ?? null,
    postedAt: item.postedAt,
    discoveredAt: new Date().toISOString(),
    score: 78,
    matchedUserIds: [],
    matchedKeywords: extractKeywordsFromText(item.title),
    notes: [],
    status: "new"
  };
}

export function inferPriceBand(priceCents: number | null | undefined) {
  if (!priceCents || priceCents <= 0) {
    return {
      minPriceCents: null,
      maxPriceCents: null
    };
  }

  return {
    minPriceCents: Math.max(0, Math.round(priceCents * 0.78)),
    maxPriceCents: Math.round(priceCents * 1.24)
  };
}

export function extractSniperKeywords(values: Array<string | null | undefined>) {
  const merged = values.map((value) => value ?? "").join(" ");
  return extractKeywordsFromText(merged);
}

async function fetchVintedCatalog(input: SearchVintedCatalogInput = {}): Promise<VintedCatalogSearchResult> {
  const searchUrl = normalizeTrackedUrl(
    input.searchUrl
      ? normalizeVintedCatalogUrl(input.searchUrl) ??
        buildVintedCatalogUrl({ query: input.query, categoryPath: input.categoryPath, priceTo: input.priceTo })
      : buildVintedCatalogUrl({ query: input.query, categoryPath: input.categoryPath, priceTo: input.priceTo })
  );

  const url = new URL(searchUrl);
  const locale = input.locale ?? "it";
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "accept-language": locale === "it" ? "it-IT,it;q=0.9" : "en-US,en;q=0.9",
      "user-agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36"
    }
  });

  if (!response.ok) {
    throw new Error(`Vinted catalog fetch failed: ${response.status}`);
  }

  const html = await response.text();
  const itemsMatch = html.match(ITEM_BLOCK_PATTERN);
  const categoriesMatch = html.match(CATEGORY_BLOCK_PATTERN);

  if (!itemsMatch) {
    throw new Error("Vinted catalog payload not found in HTML response");
  }

  const rawItems = decodeEmbeddedJson<RawVintedItem[]>(itemsMatch[1]);
  const rawPagination = decodeEmbeddedJson<RawVintedPagination>(itemsMatch[2]);
  const categories = categoriesMatch ? decodeEmbeddedJson<RawVintedCategory[]>(categoriesMatch[1]).map(normalizeCategory) : [];
  const limit = Math.max(1, input.limit ?? 24);

  const ingestItems = rawItems.slice(0, limit).map((raw) => {
    const fallbackCategory = buildFallbackCategory(raw, url, categories);
    return toIngestListing(raw, fallbackCategory, searchUrl);
  });

  return {
    query: normalizeSearchText(url.searchParams.get("search_text") ?? input.query ?? ""),
    searchUrl,
    listings: ingestItems.map(toPublicListing),
    ingestItems,
    categories,
    totalEntries: rawPagination.total_entries ?? rawItems.length,
    generatedAt: new Date().toISOString(),
    fallbackUsed: false,
    fallbackQueries: []
  };
}

function mergeCategories(collections: VintedFacetCategory[][]) {
  const byPath = new Map<string, VintedFacetCategory>();

  for (const categories of collections) {
    for (const category of categories) {
      const existing = byPath.get(category.path);
      if (!existing || category.itemCount > existing.itemCount) {
        byPath.set(category.path, category);
      }
    }
  }

  return [...byPath.values()].sort((left, right) => right.itemCount - left.itemCount);
}

function mergeListings(collections: ListingRecord[][], limit: number) {
  const seen = new Set<string>();
  const merged: ListingRecord[] = [];

  for (const listings of collections) {
    for (const listing of listings) {
      const key = `${listing.source}:${listing.sourceListingId}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      merged.push(listing);

      if (merged.length >= limit) {
        return merged;
      }
    }
  }

  return merged;
}

export async function searchVintedCatalog(input: SearchVintedCatalogInput = {}): Promise<VintedCatalogSearchResult> {
  const primary = await fetchVintedCatalog(input);
  const normalizedQuery = normalizeSearchText(input.query ?? primary.query);

  if (input.searchUrl || input.categoryPath || !normalizedQuery || primary.totalEntries > 0 || primary.listings.length > 0) {
    return primary;
  }

  const fallbackQueries = buildExpandedSearchQueries(normalizedQuery);
  if (fallbackQueries.length === 0) {
    return primary;
  }

  const fallbackResults = (
    await Promise.all(
      fallbackQueries.map((query) =>
        fetchVintedCatalog({
          ...input,
          query,
          searchUrl: undefined
        }).catch(() => null)
      )
    )
  ).filter((entry): entry is VintedCatalogSearchResult => {
    if (!entry) {
      return false;
    }

    return entry.totalEntries > 0 || entry.listings.length > 0;
  });

  if (fallbackResults.length === 0) {
    return primary;
  }

  const limit = Math.max(1, input.limit ?? 24);
  const mergedListings = mergeListings(fallbackResults.map((entry) => entry.listings), limit);
  const mergedIngestItems = mergeListings(
    fallbackResults.map((entry) => entry.ingestItems.map((item) => toPublicListing(item))),
    limit
  ).map((listing) => ({
    source: listing.source,
    sourceListingId: listing.sourceListingId,
    searchUrl: listing.sourceSearchUrl,
    category: listing.category,
    title: listing.title,
    description: listing.description,
    url: listing.url,
    imageUrl: listing.imageUrl,
    priceCents: listing.priceCents,
    currency: listing.currency,
    sellerName: listing.sellerName,
    sellerUrl: listing.sellerUrl,
    location: listing.location,
    postedAt: listing.postedAt
  }));

  return {
    query: normalizedQuery,
    searchUrl: fallbackResults[0]?.searchUrl ?? primary.searchUrl,
    listings: mergedListings,
    ingestItems: mergedIngestItems,
    categories: mergeCategories(fallbackResults.map((entry) => entry.categories)),
    totalEntries: fallbackResults.reduce((total, entry) => total + entry.totalEntries, 0),
    generatedAt: new Date().toISOString(),
    fallbackUsed: true,
    fallbackQueries: fallbackResults.map((entry) => entry.query)
  };
}
