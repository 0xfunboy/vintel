"use client";

import { startTransition, useDeferredValue, useEffect, useState } from "react";

import { formatCurrency } from "@/lib/filters";
import type { ListingRecord, Locale } from "@/lib/types";
import type { VintedFacetCategory } from "@/lib/vinted";

type MarketState = {
  query: string;
  searchUrl: string;
  listings: ListingRecord[];
  categories: VintedFacetCategory[];
  totalEntries: number;
  generatedAt: string;
};

type PublicMarketBoardProps = {
  locale: Locale;
  initialState: MarketState;
  allowTracking: boolean;
  trackHref: string;
  labels: {
    title: string;
    body: string;
    noListings: string;
    browse: string;
    keywordMode: string;
    categoryMode: string;
    priceMode: string;
    open: string;
    all: string;
    liveReady: string;
    liveSearching: string;
    liveResults: string;
    liveFailed: string;
    trackSearch: string;
    trackSimilar: string;
    trackSignIn: string;
    trackSaved: string;
  };
};

type PriceLane = "all" | "10" | "100" | "1000";

function matchesLane(priceCents: number, lane: PriceLane) {
  if (lane === "10") {
    return priceCents <= 1000;
  }

  if (lane === "100") {
    return priceCents <= 10000;
  }

  if (lane === "1000") {
    return priceCents <= 100000;
  }

  return true;
}

function formatDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function getFallbackLabel(listing: ListingRecord) {
  return (listing.category ?? listing.source ?? listing.title).slice(0, 1).toUpperCase();
}

function getCategoryLabel(listing: ListingRecord, activeCategory: VintedFacetCategory | null) {
  return listing.category ?? activeCategory?.title ?? null;
}

export function PublicMarketBoard({ locale, initialState, allowTracking, trackHref, labels }: PublicMarketBoardProps) {
  const [query, setQuery] = useState(initialState.query);
  const [market, setMarket] = useState<MarketState>(initialState);
  const [selectedCategoryPath, setSelectedCategoryPath] = useState<string>("all");
  const [selectedLane, setSelectedLane] = useState<PriceLane>("all");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackMessage, setTrackMessage] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);
  const activeCategory = selectedCategoryPath === "all" ? null : market.categories.find((entry) => entry.path === selectedCategoryPath) ?? null;

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (deferredQuery.trim()) {
          params.set("q", deferredQuery.trim());
        }
        if (selectedCategoryPath !== "all") {
          params.set("categoryPath", selectedCategoryPath);
        }

        const response = await fetch(`/api/search/live?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal
        });

        const payload = (await response.json()) as {
          ok: boolean;
          error?: string;
          result?: MarketState;
        };

        if (!response.ok || !payload.ok || !payload.result) {
          throw new Error(payload.error ?? labels.liveFailed);
        }

        startTransition(() => {
          setMarket(payload.result as MarketState);
        });
      } catch (fetchError) {
        if (!controller.signal.aborted) {
          setError(fetchError instanceof Error ? fetchError.message : labels.liveFailed);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false);
        }
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [deferredQuery, labels.liveFailed, selectedCategoryPath]);

  const filtered = market.listings.filter((listing) => {
    const haystack = `${listing.title} ${listing.description ?? ""} ${listing.category ?? ""}`.toLowerCase();
    const queryMatch = deferredQuery.trim() === "" ? true : haystack.includes(deferredQuery.toLowerCase().trim());
    const laneMatch = matchesLane(listing.priceCents, selectedLane);

    return queryMatch && laneMatch;
  });

  const preview = filtered.slice(0, 12);
  const searchContext = deferredQuery.trim() || market.query;

  async function trackSimilar(listing?: ListingRecord) {
    if (!allowTracking) {
      window.location.href = trackHref;
      return;
    }

    setTrackMessage(null);

    try {
      const response = await fetch("/api/sniper/track", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          query: searchContext || listing?.title || "",
          searchUrl: market.searchUrl,
          categoryTitle: activeCategory?.title ?? listing?.category ?? null,
          listingTitle: listing?.title ?? null,
          listingPriceCents: listing?.priceCents ?? null
        })
      });

      if (response.status === 401) {
        window.location.href = trackHref;
        return;
      }

      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? labels.liveFailed);
      }

      setTrackMessage(labels.trackSaved);
    } catch (trackError) {
      setTrackMessage(trackError instanceof Error ? trackError.message : labels.liveFailed);
    }
  }

  return (
    <section className="content-panel market-panel" id="market">
      <div className="market-head">
        <div>
          <div className="section-kicker">{labels.title}</div>
          <h2 className="section-title compact-title">{labels.title}</h2>
          <p className="section-copy">{labels.body}</p>
        </div>

        <div className="feature-pills">
          <span className="feature-pill">{labels.keywordMode}</span>
          <span className="feature-pill">{labels.categoryMode}</span>
          <span className="feature-pill">{labels.priceMode}</span>
        </div>
      </div>

      <div className="market-toolbar">
        <label className="search-shell">
          <span className="search-icon">⌕</span>
          <input
            className="search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={labels.browse}
          />
        </label>

        <div className="chip-strip">
          <span className="chip-title">{labels.categoryMode}</span>
          <button
            type="button"
            className={selectedCategoryPath === "all" ? "filter-chip is-active" : "filter-chip"}
            onClick={() => setSelectedCategoryPath("all")}
          >
            {labels.all}
          </button>
          {market.categories
            .filter((category) => category.itemCount > 0)
            .slice(0, 8)
            .map((category) => (
              <button
                key={category.path}
                type="button"
                className={selectedCategoryPath === category.path ? "filter-chip is-active" : "filter-chip"}
                onClick={() => setSelectedCategoryPath(category.path)}
              >
                {category.title}
              </button>
            ))}
        </div>

        <div className="chip-strip">
          <span className="chip-title">{labels.priceMode}</span>
          {(["all", "10", "100", "1000"] as const).map((lane) => (
            <button
              key={lane}
              type="button"
              className={selectedLane === lane ? "filter-chip is-active" : "filter-chip"}
              onClick={() => setSelectedLane(lane)}
            >
              {lane === "all" ? labels.all : `< $${lane}`}
            </button>
          ))}
        </div>
      </div>

      <div className="market-status-row">
        <div className="market-status-copy">
          <span className={searching ? "badge" : "badge success"}>{searching ? labels.liveSearching : labels.liveReady}</span>
          <span>{labels.liveResults.replace("{count}", String(market.totalEntries))}</span>
        </div>

        <div className="market-utility-row">
          {(searchContext || activeCategory) && (
            <button className="ghost-button" type="button" onClick={() => trackSimilar()}>
              {allowTracking ? labels.trackSearch : labels.trackSignIn}
            </button>
          )}
          {trackMessage ? <span className="inline-note">{trackMessage}</span> : null}
        </div>
      </div>

      {preview.length === 0 ? (
        <div className="empty-state">{error ?? labels.noListings}</div>
      ) : (
        <div className="public-grid">
          {preview.map((listing) => (
            <article className="public-card" key={listing.id}>
              {listing.imageUrl ? (
                <div className="listing-media-shell">
                  <img
                    className="listing-media"
                    src={listing.imageUrl}
                    alt={listing.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <div className="listing-media-fallback">
                  <span>{getFallbackLabel(listing)}</span>
                </div>
              )}

              <div className="public-card-body">
                <div className="public-card-top">
                  <div>
                    <div className="micro-row">
                      {getCategoryLabel(listing, activeCategory) ? (
                        <span className="micro-badge">{getCategoryLabel(listing, activeCategory)}</span>
                      ) : null}
                      <span className="micro-badge subdued">{formatDate(listing.postedAt, locale)}</span>
                    </div>
                    <h3>{listing.title}</h3>
                  </div>
                  <div className="price-pill">{formatCurrency(listing.priceCents, listing.currency)}</div>
                </div>

                <div className="meta-grid">
                  <span>{listing.sellerName}</span>
                  <span>{listing.source}</span>
                </div>

                {listing.matchedKeywords.length > 0 ? (
                  <div className="token-row">
                    {listing.matchedKeywords.slice(0, 3).map((keyword) => (
                      <span className="token" key={keyword}>
                        {keyword}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="listing-actions">
                  <a className="primary-button" href={listing.url} target="_blank" rel="noreferrer">
                    {labels.open}
                  </a>
                  <button className="ghost-button" type="button" onClick={() => trackSimilar(listing)}>
                    {allowTracking ? labels.trackSimilar : labels.trackSignIn}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
