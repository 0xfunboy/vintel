import { getListingById, getUserById, readAlerts, updateUserById } from "./db";
import { formatCurrency } from "./filters";
import type { AlertRecord, ListingRecord, TrackedSearchRecord, UserRecord } from "./types";
import { extractSniperKeywords, normalizeVintedCatalogUrl } from "./vinted";

export type ListingFeedbackReason = "price_too_high" | "wrong_product";

type ApplyListingFeedbackInput = {
  userId: string;
  listingId: string;
  reason: ListingFeedbackReason;
  keywords?: string[];
};

type FeedbackSummary = {
  scope: "tracked" | "global";
  trackedSearchId: string | null;
  trackedSearchLabel: string | null;
  updatedExcludeKeywords: string[];
  updatedMaxPriceCents: number | null;
};

function normalizeKeyword(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

function uniqueKeywords(values: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const keyword = normalizeKeyword(value);
    if (!keyword || seen.has(keyword)) {
      continue;
    }

    seen.add(keyword);
    normalized.push(keyword);
  }

  return normalized;
}

function setSearchUrlPriceCap(searchUrl: string, maxPriceCents: number | null) {
  const normalized = normalizeVintedCatalogUrl(searchUrl);
  if (!normalized) {
    return searchUrl;
  }

  const url = new URL(normalized);
  if (maxPriceCents === null || maxPriceCents <= 0) {
    url.searchParams.delete("price_to");
    return url.toString();
  }

  const wholeCurrencyCap = Math.max(1, Math.floor(maxPriceCents / 100));
  url.searchParams.set("price_to", String(wholeCurrencyCap));
  return url.toString();
}

function derivePriceCapFromListing(listing: ListingRecord) {
  if (listing.priceCents <= 100) {
    return null;
  }

  return Math.max(100, listing.priceCents - 100);
}

function findTrackedSearchForAlert(user: UserRecord, listing: ListingRecord, alerts: AlertRecord[]) {
  const matchedAlert = alerts.find((alert) => alert.userId === user.id && alert.listingId === listing.id && alert.trackedSearchId);
  if (matchedAlert?.trackedSearchId) {
    return user.filters.trackedSearches.find((entry) => entry.id === matchedAlert.trackedSearchId) ?? null;
  }

  if (matchedAlert?.trackedSearchUrl) {
    const normalizedAlertUrl = normalizeVintedCatalogUrl(matchedAlert.trackedSearchUrl);
    if (normalizedAlertUrl) {
      return user.filters.trackedSearches.find((entry) => normalizeVintedCatalogUrl(entry.searchUrl) === normalizedAlertUrl) ?? null;
    }
  }

  if (!listing.sourceSearchUrl) {
    return null;
  }

  const normalizedListingUrl = normalizeVintedCatalogUrl(listing.sourceSearchUrl);
  if (!normalizedListingUrl) {
    return null;
  }

  return user.filters.trackedSearches.find((entry) => normalizeVintedCatalogUrl(entry.searchUrl) === normalizedListingUrl) ?? null;
}

export function buildFeedbackKeywordOptions(listing: ListingRecord, trackedSearch: TrackedSearchRecord | null) {
  const candidates = uniqueKeywords([
    ...listing.matchedKeywords,
    ...extractSniperKeywords([listing.title, listing.description, trackedSearch?.query, trackedSearch?.categoryTitle]),
    ...listing.title.match(/\b(?:rtx|gtx|rx)?\s?\d{3,4}\b/gi)?.map((entry) => entry.replace(/\s+/g, "")) ?? [],
    ...listing.title.match(/\bddr[45]\b/gi) ?? []
  ]);

  const trackedIncludes = new Set((trackedSearch?.includeKeywords ?? []).map(normalizeKeyword));
  const trackedExcludes = new Set((trackedSearch?.excludeKeywords ?? []).map(normalizeKeyword));

  return candidates
    .filter((keyword) => !trackedExcludes.has(keyword))
    .sort((left, right) => {
      const leftImportant = /\d/.test(left) || /^ddr[45]$/.test(left);
      const rightImportant = /\d/.test(right) || /^ddr[45]$/.test(right);
      if (leftImportant !== rightImportant) {
        return leftImportant ? -1 : 1;
      }

      if (trackedIncludes.has(left) !== trackedIncludes.has(right)) {
        return trackedIncludes.has(left) ? 1 : -1;
      }

      return left.localeCompare(right);
    })
    .slice(0, 8);
}

export async function getListingFeedbackContext(userId: string, listingId: string) {
  const [user, listing, alerts] = await Promise.all([getUserById(userId), getListingById(listingId), readAlerts()]);
  if (!user || !listing || !listing.matchedUserIds.includes(user.id)) {
    return null;
  }

  const trackedSearch = findTrackedSearchForAlert(user, listing, alerts);
  return {
    user,
    listing,
    trackedSearch,
    keywordOptions: buildFeedbackKeywordOptions(listing, trackedSearch)
  };
}

export async function applyListingFeedback(input: ApplyListingFeedbackInput): Promise<FeedbackSummary> {
  const context = await getListingFeedbackContext(input.userId, input.listingId);
  if (!context) {
    throw new Error("listing-not-found");
  }

  const { user, listing, trackedSearch } = context;
  const selectedKeywords = uniqueKeywords(input.keywords ?? []);

  if (input.reason === "wrong_product" && selectedKeywords.length === 0) {
    throw new Error("missing-keywords");
  }

  const nextMaxPrice = input.reason === "price_too_high" ? derivePriceCapFromListing(listing) : null;
  let summary: FeedbackSummary = {
    scope: trackedSearch ? "tracked" : "global",
    trackedSearchId: trackedSearch?.id ?? null,
    trackedSearchLabel: trackedSearch?.label ?? null,
    updatedExcludeKeywords: [],
    updatedMaxPriceCents: null
  };

  await updateUserById(user.id, (current) => {
    const dismissedListingIds = [...new Set([input.listingId, ...current.filters.dismissedListingIds])];

    if (trackedSearch) {
      const nextTrackedSearches = current.filters.trackedSearches.map((entry) => {
        if (entry.id !== trackedSearch.id) {
          return entry;
        }

        const excludeKeywords =
          input.reason === "wrong_product" ? [...new Set([...entry.excludeKeywords, ...selectedKeywords])] : entry.excludeKeywords;
        const maxPriceCents =
          input.reason === "price_too_high"
            ? nextMaxPrice === null
              ? entry.maxPriceCents
              : entry.maxPriceCents === null
                ? nextMaxPrice
                : Math.min(entry.maxPriceCents, nextMaxPrice)
            : entry.maxPriceCents;

        summary = {
          scope: "tracked",
          trackedSearchId: entry.id,
          trackedSearchLabel: entry.label,
          updatedExcludeKeywords: excludeKeywords,
          updatedMaxPriceCents: maxPriceCents
        };

        return {
          ...entry,
          excludeKeywords,
          maxPriceCents,
          searchUrl: input.reason === "price_too_high" ? setSearchUrlPriceCap(entry.searchUrl, maxPriceCents) : entry.searchUrl,
          lastTrackedAt: new Date().toISOString()
        };
      });

      return {
        ...current,
        filters: {
          ...current.filters,
          dismissedListingIds,
          trackedSearches: nextTrackedSearches,
          searchUrls: [
            ...new Set([
              ...nextTrackedSearches.map((entry) => entry.searchUrl),
              ...current.filters.searchUrls.filter(
                (url) => !current.filters.trackedSearches.some((entry) => entry.searchUrl === url)
              )
            ])
          ]
        }
      };
    }

    const excludeKeywords =
      input.reason === "wrong_product" ? [...new Set([...current.filters.excludeKeywords, ...selectedKeywords])] : current.filters.excludeKeywords;
    const maxPriceCents =
      input.reason === "price_too_high"
        ? nextMaxPrice === null
          ? current.filters.maxPriceCents
          : current.filters.maxPriceCents === null
            ? nextMaxPrice
            : Math.min(current.filters.maxPriceCents, nextMaxPrice)
        : current.filters.maxPriceCents;

    summary = {
      scope: "global",
      trackedSearchId: null,
      trackedSearchLabel: null,
      updatedExcludeKeywords: excludeKeywords,
      updatedMaxPriceCents: maxPriceCents
    };

    return {
      ...current,
      filters: {
        ...current.filters,
        dismissedListingIds,
        excludeKeywords,
        maxPriceCents
      }
    };
  });

  return summary;
}

export function formatFeedbackSummary(locale: "en" | "it", listing: ListingRecord, summary: FeedbackSummary, reason: ListingFeedbackReason, keywords: string[]) {
  if (locale === "it") {
    if (reason === "price_too_high") {
      const target = summary.trackedSearchLabel ? ` sulla caccia ${summary.trackedSearchLabel}` : "";
      return `Ricevuto. Imposto un cap prezzo piu' basso${target}, sotto ${formatCurrency(summary.updatedMaxPriceCents ?? listing.priceCents, listing.currency)}.`;
    }

    const target = summary.trackedSearchLabel ? ` nella caccia ${summary.trackedSearchLabel}` : " nei filtri globali";
    return `Ricevuto. Escludo ${keywords.join(", ")}${target} e nascondo questo listing.`;
  }

  if (reason === "price_too_high") {
    const target = summary.trackedSearchLabel ? ` for hunt ${summary.trackedSearchLabel}` : "";
    return `Done. I lowered the max price${target} below ${formatCurrency(summary.updatedMaxPriceCents ?? listing.priceCents, listing.currency)}.`;
  }

  const target = summary.trackedSearchLabel ? ` inside hunt ${summary.trackedSearchLabel}` : " in your global filters";
  return `Done. I will exclude ${keywords.join(", ")}${target} and hide this listing.`;
}
