import type { IngestListing, MatchResult, UserRecord } from "./types";

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeList(values: string[]) {
  return values.map(normalize).filter(Boolean);
}

function normalizeSearchRef(value: string) {
  return value.toLowerCase().trim().replace(/\/+$/, "");
}

function unique(values: string[]) {
  return [...new Set(values)];
}

export function formatCurrency(priceCents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format(priceCents / 100);
}

export function matchListingToUser(candidate: IngestListing, user: UserRecord): MatchResult {
  const title = normalize(candidate.title);
  const description = normalize(candidate.description ?? "");
  const haystack = user.filters.searchInDescription ? `${title} ${description}`.trim() : title;
  const category = normalize(candidate.category ?? "");
  const sellerName = normalize(candidate.sellerName);
  const categories = normalizeList(user.filters.categories);
  const includes = normalizeList(user.filters.includeKeywords);
  const excludes = normalizeList(user.filters.excludeKeywords);
  const allowlist = normalizeList(user.filters.sellersAllowlist);
  const blocklist = normalizeList(user.filters.sellersBlocklist);
  const candidateSearchUrl = candidate.searchUrl ?? null;
  const normalizedCandidateSearchUrl = candidateSearchUrl ? normalizeSearchRef(candidateSearchUrl) : null;
  const matchedTrackedSearch = normalizedCandidateSearchUrl
    ? user.filters.trackedSearches.find((entry) => normalizeSearchRef(entry.searchUrl) === normalizedCandidateSearchUrl)
    : null;
  const trackedSearches = user.filters.searchUrls.map(normalizeSearchRef);
  const trackedSearchMatch =
    Boolean(matchedTrackedSearch) || (normalizedCandidateSearchUrl ? trackedSearches.includes(normalizedCandidateSearchUrl) : false);
  const trackedCategories = matchedTrackedSearch?.categoryTitle ? normalizeList([matchedTrackedSearch.categoryTitle]) : [];
  const trackedIncludes = normalizeList(matchedTrackedSearch?.includeKeywords ?? []);
  const trackedExcludes = normalizeList(matchedTrackedSearch?.excludeKeywords ?? []);
  const effectiveCategories = trackedCategories.length > 0 ? trackedCategories : categories;
  const effectiveMinPrice = matchedTrackedSearch?.minPriceCents ?? user.filters.minPriceCents;
  const effectiveMaxPrice = matchedTrackedSearch?.maxPriceCents ?? user.filters.maxPriceCents;

  if (!user.alertsEnabled) {
    return { matches: false, score: 0, matchedKeywords: [], notes: ["Alerts disabled"], matchedTrackedSearchId: null, matchedTrackedSearchUrl: null };
  }

  if (blocklist.includes(sellerName)) {
    return { matches: false, score: 0, matchedKeywords: [], notes: ["Blocked seller"], matchedTrackedSearchId: null, matchedTrackedSearchUrl: null };
  }

  if (allowlist.length > 0 && !allowlist.includes(sellerName)) {
    return { matches: false, score: 0, matchedKeywords: [], notes: ["Seller outside allowlist"], matchedTrackedSearchId: null, matchedTrackedSearchUrl: null };
  }

  if (effectiveCategories.length > 0 && !trackedSearchMatch && (!category || !effectiveCategories.includes(category))) {
    return { matches: false, score: 0, matchedKeywords: [], notes: ["Category outside filter"], matchedTrackedSearchId: null, matchedTrackedSearchUrl: null };
  }

  const globalMatchedKeywords = includes.filter((keyword) => haystack.includes(keyword));
  const trackedMatchedKeywords = trackedIncludes.filter((keyword) => haystack.includes(keyword));
  const matchedKeywords = unique([...globalMatchedKeywords, ...trackedMatchedKeywords]);
  const requiresAllKeywords = user.filters.keywordMode === "and";
  const trackedKeywordMatched =
    trackedIncludes.length === 0 ? true : requiresAllKeywords ? trackedMatchedKeywords.length === trackedIncludes.length : trackedMatchedKeywords.length > 0;
  const keywordMatched =
    trackedSearchMatch
      ? trackedKeywordMatched
      : includes.length === 0
        ? trackedSearches.length === 0
        : requiresAllKeywords
          ? globalMatchedKeywords.length === includes.length
          : globalMatchedKeywords.length > 0;

  if (!keywordMatched) {
    return { matches: false, score: 0, matchedKeywords: [], notes: ["No keyword match"], matchedTrackedSearchId: null, matchedTrackedSearchUrl: null };
  }

  const excluded = [...excludes, ...trackedExcludes].find((keyword) => haystack.includes(keyword));
  if (excluded) {
    return {
      matches: false,
      score: 0,
      matchedKeywords,
      notes: [`Excluded by keyword: ${excluded}`],
      matchedTrackedSearchId: matchedTrackedSearch?.id ?? null,
      matchedTrackedSearchUrl: matchedTrackedSearch?.searchUrl ?? candidateSearchUrl
    };
  }

  const notes: string[] = [];
  let score = (trackedSearchMatch ? 64 : 48) + matchedKeywords.length * 11;

  if (trackedSearchMatch) {
    notes.push("Tracked search hit");
  }

  if (effectiveCategories.length > 0) {
    score += 5;
    notes.push("Category matched");
  }

  if (matchedKeywords.some((keyword) => /4090|4080|7900|5070|5080|5090/.test(keyword))) {
    score += 12;
    notes.push("High-priority SKU");
  }

  if (effectiveMinPrice !== null && candidate.priceCents < effectiveMinPrice) {
    score -= 8;
    notes.push("Below min price");
  }

  if (effectiveMaxPrice !== null && candidate.priceCents > effectiveMaxPrice) {
    score -= 18;
    notes.push("Above max price");
  } else {
    score += 8;
    notes.push("Within price range");
  }

  if (candidate.imageUrl) {
    score += 3;
  }

  if (/box|receipt|scatola|warranty|garanzia/.test(haystack)) {
    score += 4;
    notes.push("Accessory or warranty mention");
  }

  const finalScore = Math.max(0, Math.min(100, score));

  return {
    matches: finalScore >= user.filters.minScore,
    score: finalScore,
    matchedKeywords,
    notes,
    matchedTrackedSearchId: matchedTrackedSearch?.id ?? null,
    matchedTrackedSearchUrl: matchedTrackedSearch?.searchUrl ?? candidateSearchUrl
  };
}
