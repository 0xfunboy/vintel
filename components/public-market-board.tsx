"use client";

import { useDeferredValue, useState } from "react";

import { formatCurrency } from "@/lib/filters";
import type { ListingRecord, Locale } from "@/lib/types";

type PublicMarketBoardProps = {
  locale: Locale;
  listings: ListingRecord[];
  categories: string[];
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

export function PublicMarketBoard({ locale, listings, categories, labels }: PublicMarketBoardProps) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedLane, setSelectedLane] = useState<PriceLane>("all");
  const deferredQuery = useDeferredValue(query);

  const filtered = listings.filter((listing) => {
    const haystack = `${listing.title} ${listing.description ?? ""} ${listing.category ?? ""}`.toLowerCase();
    const queryMatch = deferredQuery.trim() === "" ? true : haystack.includes(deferredQuery.toLowerCase().trim());
    const categoryMatch = selectedCategory === "all" ? true : (listing.category ?? "").toLowerCase() === selectedCategory.toLowerCase();
    const laneMatch = matchesLane(listing.priceCents, selectedLane);

    return queryMatch && categoryMatch && laneMatch;
  });

  const preview = filtered.slice(0, 8);

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
            className={selectedCategory === "all" ? "filter-chip is-active" : "filter-chip"}
            onClick={() => setSelectedCategory("all")}
          >
            {labels.all}
          </button>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              className={selectedCategory === category ? "filter-chip is-active" : "filter-chip"}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
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

      {preview.length === 0 ? (
        <div className="empty-state">{labels.noListings}</div>
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
                      {listing.category ? <span className="micro-badge">{listing.category}</span> : null}
                      <span className="micro-badge subdued">{listing.source}</span>
                    </div>
                    <h3>{listing.title}</h3>
                  </div>
                  <div className="price-pill">{formatCurrency(listing.priceCents, listing.currency)}</div>
                </div>

                <div className="meta-grid">
                  <span>{listing.sellerName}</span>
                  <span>{formatDate(listing.postedAt, locale)}</span>
                  {listing.location ? <span>{listing.location}</span> : null}
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
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
