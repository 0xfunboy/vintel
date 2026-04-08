"use client";

import type { CSSProperties } from "react";
import { startTransition, useDeferredValue, useEffect, useState } from "react";

import { TrackSimilarButton } from "@/components/track-similar-button";
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
    anyBudget: string;
    upToPrice: string;
    manualBudget: string;
    dialogTitle: string;
    dialogBody: string;
    dialogLabel: string;
    dialogQuery: string;
    dialogCategory: string;
    dialogKeywords: string;
    dialogMinPrice: string;
    dialogMaxPrice: string;
    dialogSearchUrl: string;
    dialogSubmit: string;
    dialogCancel: string;
    dialogTelegramHint: string;
  };
};

const PRESET_PRICE_CAPS = [0, 10, 100, 500, 1000] as const;
const MAX_PRICE_CAP = 1000;

function getInitialPriceCap(searchUrl: string) {
  try {
    const value = Number(new URL(searchUrl).searchParams.get("price_to") ?? "0");
    return Number.isFinite(value) && value > 0 ? Math.min(MAX_PRICE_CAP, Math.round(value)) : 0;
  } catch {
    return 0;
  }
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

function formatBudgetLabel(value: number, locale: Locale, labels: PublicMarketBoardProps["labels"]) {
  if (value <= 0) {
    return labels.anyBudget;
  }

  const amount = `$${value.toLocaleString(locale === "it" ? "it-IT" : "en-US")}`;
  return labels.upToPrice.replace("{price}", amount);
}

export function PublicMarketBoard({ locale, initialState, allowTracking, trackHref, labels }: PublicMarketBoardProps) {
  const [query, setQuery] = useState(initialState.query);
  const [market, setMarket] = useState<MarketState>(initialState);
  const [selectedCategoryPath, setSelectedCategoryPath] = useState<string>("all");
  const [selectedMaxPrice, setSelectedMaxPrice] = useState<number>(() => getInitialPriceCap(initialState.searchUrl));
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);
  const deferredMaxPrice = useDeferredValue(selectedMaxPrice);
  const activeCategory =
    selectedCategoryPath === "all" ? null : market.categories.find((entry) => entry.path === selectedCategoryPath) ?? null;
  const activeBudgetLabel = formatBudgetLabel(selectedMaxPrice, locale, labels);
  const sliderProgress = `${Math.round((selectedMaxPrice / MAX_PRICE_CAP) * 100)}%`;

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
        if (deferredMaxPrice > 0) {
          params.set("priceTo", String(deferredMaxPrice));
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
  }, [deferredMaxPrice, deferredQuery, labels.liveFailed, selectedCategoryPath]);

  const filtered = market.listings.filter((listing) => {
    const haystack = `${listing.title} ${listing.description ?? ""} ${listing.category ?? ""}`.toLowerCase();
    const queryMatch = deferredQuery.trim() === "" ? true : haystack.includes(deferredQuery.toLowerCase().trim());
    const priceMatch = selectedMaxPrice === 0 ? true : listing.priceCents <= selectedMaxPrice * 100;

    return queryMatch && priceMatch;
  });

  const preview = filtered.slice(0, 12);
  const searchContext = deferredQuery.trim() || market.query;
  const dialogLabels = {
    title: labels.dialogTitle,
    body: labels.dialogBody,
    label: labels.dialogLabel,
    query: labels.dialogQuery,
    category: labels.dialogCategory,
    keywords: labels.dialogKeywords,
    minPrice: labels.dialogMinPrice,
    maxPrice: labels.dialogMaxPrice,
    searchUrl: labels.dialogSearchUrl,
    submit: labels.dialogSubmit,
    cancel: labels.dialogCancel,
    telegramHint: labels.dialogTelegramHint,
    saved: labels.trackSaved,
    failed: labels.liveFailed
  };

  return (
    <section className="content-panel market-panel market-panel-refined" id="market">
      <div className="market-panel-header">
        <div>
          <p className="section-label">{labels.title}</p>
          <p className="section-copy">{labels.body}</p>
        </div>

        <div className="market-status-copy">
          <span className={searching ? "badge" : "badge success"}>{searching ? labels.liveSearching : labels.liveReady}</span>
          <span>{labels.liveResults.replace("{count}", String(market.totalEntries))}</span>
        </div>
      </div>

      <div className="track-surface">
        <label className="search-shell search-shell-wide">
          <span className="search-icon">⌕</span>
          <input
            className="search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={labels.browse}
          />
        </label>

        <div className="track-grid">
          <div className="track-field">
            <span className="control-label">{labels.categoryMode}</span>
            <div className="chip-strip">
              <button
                type="button"
                className={selectedCategoryPath === "all" ? "filter-chip is-active" : "filter-chip"}
                onClick={() => setSelectedCategoryPath("all")}
              >
                {labels.all}
              </button>
              {market.categories
                .filter((category) => category.itemCount > 0)
                .slice(0, 10)
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
          </div>

          <div className="track-field track-field-wide">
            <div className="budget-header">
              <span className="control-label">{labels.priceMode}</span>
              <strong>{activeBudgetLabel}</strong>
            </div>

            <div className="budget-presets">
              {PRESET_PRICE_CAPS.map((cap) => (
                <button
                  key={cap}
                  type="button"
                  className={selectedMaxPrice === cap ? "filter-chip is-active" : "filter-chip"}
                  onClick={() => setSelectedMaxPrice(cap)}
                >
                  {cap === 0 ? labels.all : `< $${cap}`}
                </button>
              ))}
            </div>

            <div className="budget-slider-block">
              <input
                className="budget-slider"
                type="range"
                min="0"
                max={String(MAX_PRICE_CAP)}
                step="10"
                value={selectedMaxPrice}
                onChange={(event) => setSelectedMaxPrice(Number(event.target.value))}
                style={{ "--budget-progress": sliderProgress } as CSSProperties}
              />
              <div className="slider-caption-row">
                <span className="slider-caption">{labels.manualBudget}</span>
                <span className="slider-caption">{activeBudgetLabel}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="market-status-row">
          <div className="feature-pills">
            <span className="feature-pill">{labels.keywordMode}</span>
            <span className="feature-pill">{labels.categoryMode}</span>
            <span className="feature-pill">{labels.priceMode}</span>
          </div>

          <div className="market-utility-row">
            {(searchContext || activeCategory) && (
              <TrackSimilarButton
                allowTracking={allowTracking}
                trackHref={trackHref}
                buttonLabel={labels.trackSearch}
                preset={{
                  label: searchContext || activeCategory?.title || labels.title,
                  query: searchContext,
                  searchUrl: market.searchUrl,
                  categoryTitle: activeCategory?.title ?? null,
                  includeKeywords: searchContext
                    .split(/\s+/)
                    .map((entry) => entry.trim())
                    .filter(Boolean)
                    .slice(0, 6),
                  minPriceCents: null,
                  maxPriceCents: selectedMaxPrice > 0 ? selectedMaxPrice * 100 : null,
                  listingTitle: null,
                  listingPriceCents: null
                }}
                labels={dialogLabels}
              />
            )}
          </div>
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
                  <TrackSimilarButton
                    allowTracking={allowTracking}
                    trackHref={trackHref}
                    buttonLabel={labels.trackSimilar}
                    preset={{
                      label: listing.title,
                      query: searchContext || listing.title,
                      searchUrl: market.searchUrl,
                      categoryTitle: activeCategory?.title ?? listing.category ?? null,
                      includeKeywords: listing.matchedKeywords,
                      minPriceCents: null,
                      maxPriceCents: selectedMaxPrice > 0 ? selectedMaxPrice * 100 : listing.priceCents,
                      listingTitle: listing.title,
                      listingPriceCents: listing.priceCents
                    }}
                    labels={dialogLabels}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
