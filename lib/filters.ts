import type { IngestListing, MatchResult, UserRecord } from "./types";

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeList(values: string[]) {
  return values.map(normalize).filter(Boolean);
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

  if (!user.alertsEnabled) {
    return { matches: false, score: 0, matchedKeywords: [], notes: ["Alerts disabled"] };
  }

  if (blocklist.includes(sellerName)) {
    return { matches: false, score: 0, matchedKeywords: [], notes: ["Blocked seller"] };
  }

  if (allowlist.length > 0 && !allowlist.includes(sellerName)) {
    return { matches: false, score: 0, matchedKeywords: [], notes: ["Seller outside allowlist"] };
  }

  if (categories.length > 0 && (!category || !categories.includes(category))) {
    return { matches: false, score: 0, matchedKeywords: [], notes: ["Category outside filter"] };
  }

  const matchedKeywords = includes.filter((keyword) => haystack.includes(keyword));
  const requiresAllKeywords = user.filters.keywordMode === "and";
  const keywordMatched = includes.length === 0 ? true : requiresAllKeywords ? matchedKeywords.length === includes.length : matchedKeywords.length > 0;

  if (!keywordMatched) {
    return { matches: false, score: 0, matchedKeywords: [], notes: ["No keyword match"] };
  }

  const excluded = excludes.find((keyword) => haystack.includes(keyword));
  if (excluded) {
    return {
      matches: false,
      score: 0,
      matchedKeywords,
      notes: [`Excluded by keyword: ${excluded}`]
    };
  }

  const notes: string[] = [];
  let score = 48 + matchedKeywords.length * 11;

  if (categories.length > 0) {
    score += 5;
    notes.push("Category matched");
  }

  if (matchedKeywords.some((keyword) => /4090|4080|7900|5070|5080|5090/.test(keyword))) {
    score += 12;
    notes.push("High-priority SKU");
  }

  if (user.filters.minPriceCents !== null && candidate.priceCents < user.filters.minPriceCents) {
    score -= 8;
    notes.push("Below min price");
  }

  if (user.filters.maxPriceCents !== null && candidate.priceCents > user.filters.maxPriceCents) {
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
    notes
  };
}
