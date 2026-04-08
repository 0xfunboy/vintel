import { auth } from "@/auth";
import { HeroGlitchTitle } from "@/components/hero-glitch-title";
import { PublicMarketBoard } from "@/components/public-market-board";
import { readListings, readUsers } from "@/lib/db";
import { formatCurrency } from "@/lib/filters";
import { copy, getLocalePreference } from "@/lib/i18n";
import { getTelegramBotProfile } from "@/lib/telegram";
import type { ListingRecord, Locale } from "@/lib/types";
import { buildVintedCatalogUrl, extractSniperKeywords, searchVintedCatalog } from "@/lib/vinted";

function formatDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function toKey(value: string) {
  return value.toLowerCase().trim();
}

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

function getListingLabel(listing: ListingRecord) {
  return titleCase(toKey(listing.category ?? listing.source ?? "Item"));
}

function renderLane(title: string, listings: ListingRecord[], empty: string, locale: Locale) {
  return (
    <article className="lane-panel">
      <div className="lane-head">
        <h3>{title}</h3>
        <span>{listings.length}</span>
      </div>

      {listings.length === 0 ? (
        <div className="lane-empty">{empty}</div>
      ) : (
        <div className="lane-list">
          {listings.map((listing) => (
            <a className="lane-item" key={listing.id} href={listing.url} target="_blank" rel="noreferrer">
              {listing.imageUrl ? (
                <div className="lane-thumb-shell">
                  <img
                    className="lane-thumb"
                    src={listing.imageUrl}
                    alt={listing.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <div className="lane-thumb-fallback">{getListingLabel(listing).slice(0, 1)}</div>
              )}

              <div className="lane-copy">
                <strong>{listing.title}</strong>
                <span>{listing.category ?? listing.sellerName}</span>
              </div>

              <div className="lane-side">
                <span>{formatDate(listing.postedAt, locale)}</span>
                <div className="lane-price">{formatCurrency(listing.priceCents, listing.currency)}</div>
              </div>
            </a>
          ))}
        </div>
      )}
    </article>
  );
}

export default async function HomePage() {
  const session = await auth();
  const locale = await getLocalePreference();
  const t = copy[locale];
  const [bot, storedListings, users, liveSearch] = await Promise.all([
    getTelegramBotProfile(),
    readListings(),
    readUsers(),
    searchVintedCatalog({ locale, limit: 24 }).catch(() => null)
  ]);

  const sortedStoredListings = [...storedListings].sort(
    (left, right) => new Date(right.postedAt).getTime() - new Date(left.postedAt).getTime()
  );
  const marketListings = liveSearch?.listings.length ? liveSearch.listings : sortedStoredListings;
  const analyticsSeed = sortedStoredListings.length > 0 ? sortedStoredListings : marketListings;

  const under10 = marketListings.filter((listing) => listing.priceCents <= 1000).slice(0, 4);
  const under100 = marketListings.filter((listing) => listing.priceCents <= 10000).slice(0, 4);
  const under1000 = marketListings.filter((listing) => listing.priceCents <= 100000).slice(0, 4);
  const latest = marketListings.slice(0, 9);
  const latestSniped = marketListings.slice(0, 3);
  const spotlight = latest[0] ?? null;

  const categoryCounts = new Map<string, number>();
  for (const listing of analyticsSeed) {
    const category = toKey(listing.category ?? "");
    if (!category) {
      continue;
    }

    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  }

  if (categoryCounts.size === 0 && liveSearch) {
    for (const category of liveSearch.categories) {
      if (category.itemCount > 0) {
        categoryCounts.set(toKey(category.title), category.itemCount);
      }
    }
  }

  const hotCategories = [...categoryCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([category, count]) => ({
      category: titleCase(category),
      count
    }));
  const topCategories = hotCategories.slice(0, 3);

  const keywordCounts = new Map<string, number>();
  for (const user of users) {
    for (const keyword of user.filters.includeKeywords) {
      const key = toKey(keyword);
      if (!key) {
        continue;
      }

      keywordCounts.set(key, (keywordCounts.get(key) ?? 0) + 1);
    }
  }

  for (const listing of analyticsSeed) {
    for (const keyword of listing.matchedKeywords) {
      const key = toKey(keyword);
      if (!key) {
        continue;
      }

      keywordCounts.set(key, (keywordCounts.get(key) ?? 0) + 1);
    }
  }

  if (keywordCounts.size === 0) {
    for (const listing of marketListings) {
      for (const keyword of extractSniperKeywords([listing.title, listing.description])) {
        const key = toKey(keyword);
        if (!key) {
          continue;
        }

        keywordCounts.set(key, (keywordCounts.get(key) ?? 0) + 1);
      }
    }
  }

  const trending = [...keywordCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 10)
    .map(([keyword]) => titleCase(keyword));
  const topProductTargets = [...keywordCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([keyword, count]) => ({
      label: titleCase(keyword),
      count
    }));

  const botUrl = bot?.username ? `https://t.me/${bot.username}` : null;
  const personalizeHref = session?.user?.email ? "/dashboard" : "/signin";
  const liveHitCount = liveSearch?.totalEntries ?? marketListings.length;

  return (
    <main className="market-home market-home-refined">
      <section className="hero-frame">
        <div className="hero-main">
          <p className="section-label">{locale === "it" ? "Portale sniper Vinted" : "Vinted sniper portal"}</p>
          <HeroGlitchTitle text={t.heroTitle} />
          <p className="hero-copy hero-copy-wide">{t.heroBody}</p>

          <div className="feature-pills">
            <span className="feature-pill">{t.homeKeywordMode}</span>
            <span className="feature-pill">{t.homeCategoryMode}</span>
            <span className="feature-pill">{t.homePriceMode}</span>
          </div>

          <div className="hero-actions">
            <a className="primary-button" href="#market">
              {t.productFeed}
            </a>
            {botUrl ? (
              <a className="ghost-button" href={botUrl} target="_blank" rel="noreferrer">
                {t.homeOpenBot}
              </a>
            ) : null}
            <a className="ghost-button" href={personalizeHref}>
              {session?.user?.email ? t.navDashboard : t.homeSyncBot}
            </a>
          </div>

          <div className="hero-stat-strip">
            <div className="hero-stat">
              <span>{t.homeLiveReady}</span>
              <strong>{liveHitCount}</strong>
            </div>
            <div className="hero-stat">
              <span>{t.homeCategories}</span>
              <strong>{hotCategories.length}</strong>
            </div>
            <div className="hero-stat">
              <span>{t.homeTelegramTitle}</span>
              <strong>{bot?.username ? `@${bot.username}` : "offline"}</strong>
            </div>
          </div>
        </div>

        <aside className="hero-rail">
          <article className="spotlight-card hero-spotlight">
            <p className="section-label">{t.homeLatest}</p>

            {spotlight ? (
              <>
                {spotlight.imageUrl ? (
                  <div className="spotlight-media-shell">
                    <img
                      className="spotlight-media"
                      src={spotlight.imageUrl}
                      alt={spotlight.title}
                      loading="eager"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="spotlight-fallback">{getListingLabel(spotlight)}</div>
                )}

                <div className="spotlight-body">
                  <div className="micro-row">
                    {spotlight.category ? <span className="micro-badge">{spotlight.category}</span> : null}
                    <span className="micro-badge subdued">{formatDate(spotlight.postedAt, locale)}</span>
                  </div>
                  <h2 className="compact-heading">{spotlight.title}</h2>
                  <p className="section-copy">{spotlight.description ?? spotlight.sellerName}</p>
                  <div className="spotlight-footer">
                    <strong>{formatCurrency(spotlight.priceCents, spotlight.currency)}</strong>
                    <a className="primary-button" href={spotlight.url} target="_blank" rel="noreferrer">
                      {t.openListing}
                    </a>
                  </div>
                </div>
              </>
            ) : (
              <div className="spotlight-fallback spotlight-empty">
                <div>
                  <strong>{t.homeLatest}</strong>
                  <span>{t.homeNoListings}</span>
                </div>
              </div>
            )}
          </article>

          <div className="hero-utility-grid">
            <article className="preview-panel hero-utility-panel" id="bot">
              <p className="section-label">{t.homeTelegramTitle}</p>
              <div className="hero-utility-copy">
                <strong>@{bot?.username ?? "vintedLbot"}</strong>
                <p>{t.homeTelegramBody}</p>
              </div>
              <div className="hero-actions compact-actions">
                {botUrl ? (
                  <a className="primary-button" href={botUrl} target="_blank" rel="noreferrer">
                    {t.homeOpenBot}
                  </a>
                ) : null}
                <a className="ghost-button" href={personalizeHref}>
                  {session?.user?.email ? t.navDashboard : t.heroCta}
                </a>
              </div>
            </article>

            <article className="preview-panel hero-utility-panel">
              <p className="section-label">{t.homeTrending}</p>
              <div className="trend-cloud">
                {trending.length === 0 ? (
                  <span className="empty-inline">{t.homeNoListings}</span>
                ) : (
                  trending.slice(0, 5).map((keyword) => (
                    <span className="trend-chip" key={keyword}>
                      {keyword}
                    </span>
                  ))
                )}
              </div>
            </article>
          </div>
        </aside>
      </section>

      <PublicMarketBoard
        locale={locale}
        initialState={{
          query: liveSearch?.query ?? "",
          searchUrl: liveSearch?.searchUrl ?? buildVintedCatalogUrl({}),
          listings: marketListings,
          categories: liveSearch?.categories ?? [],
          totalEntries: liveSearch?.totalEntries ?? marketListings.length,
          generatedAt: liveSearch?.generatedAt ?? new Date().toISOString()
        }}
        allowTracking={Boolean(session?.user?.email)}
        trackHref={personalizeHref}
        labels={{
          title: t.productFeed,
          body: t.productFeedBody,
          noListings: t.homeNoListings,
          browse: t.homeSearchPlaceholder,
          keywordMode: t.homeKeywordMode,
          categoryMode: t.homeCategoryMode,
          priceMode: t.homePriceMode,
          open: t.openListing,
          all: t.homeAll,
          liveReady: t.homeLiveReady,
          liveSearching: t.homeLiveSearching,
          liveResults: t.homeLiveResults,
          liveFailed: t.homeLiveFailed,
          trackSearch: t.homeTrackSearch,
          trackSimilar: t.homeTrackSimilar,
          trackSignIn: t.homeTrackSignIn,
          trackSaved: t.homeTrackSaved,
          anyBudget: t.homeBudgetAny,
          upToPrice: t.homeBudgetUpTo,
          manualBudget: t.homeBudgetManual
        }}
      />

      <section className="insight-ribbon" id="trending">
        <article className="insight-column">
          <p className="section-label">{t.homeLatestSniped}</p>
          <p className="section-copy">{t.homeLatestSnipedBody}</p>

          {latestSniped.length === 0 ? (
            <span className="empty-inline">{t.homeNoListings}</span>
          ) : (
            <div className="rank-list">
              {latestSniped.map((listing, index) => (
                <a className="rank-row" key={listing.id} href={listing.url} target="_blank" rel="noreferrer">
                  <span className="rank-index">{index + 1}</span>
                  <span className="rank-copy">
                    <strong>{listing.title}</strong>
                    <span>{listing.category ?? listing.sellerName}</span>
                  </span>
                  <span className="rank-side">
                    <strong>{formatCurrency(listing.priceCents, listing.currency)}</strong>
                    <span>{formatDate(listing.postedAt, locale)}</span>
                  </span>
                </a>
              ))}
            </div>
          )}
        </article>

        <article className="insight-column">
          <p className="section-label">{t.homeMostSniped}</p>
          <p className="section-copy">{t.homeMostSnipedBody}</p>

          {topProductTargets.length === 0 ? (
            <span className="empty-inline">{t.homeNoListings}</span>
          ) : (
            <div className="rank-list">
              {topProductTargets.map((entry, index) => (
                <div className="rank-row" key={entry.label}>
                  <span className="rank-index">{index + 1}</span>
                  <span className="rank-copy">
                    <strong>{entry.label}</strong>
                    <span>{t.homeTrending}</span>
                  </span>
                  <span className="rank-side">
                    <strong>{entry.count}</strong>
                    <span>{t.homeHits}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="insight-column">
          <p className="section-label">{t.homeMostSnipedCategories}</p>
          <p className="section-copy">{t.homeMostSnipedCategoriesBody}</p>

          {topCategories.length === 0 ? (
            <span className="empty-inline">{t.homeNoListings}</span>
          ) : (
            <div className="rank-list">
              {topCategories.map((entry, index) => (
                <div className="rank-row" key={entry.category}>
                  <span className="rank-index">{index + 1}</span>
                  <span className="rank-copy">
                    <strong>{entry.category}</strong>
                    <span>{t.homeCategories}</span>
                  </span>
                  <span className="rank-side">
                    <strong>{entry.count}</strong>
                    <span>{t.homeHits}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="content-panel pulse-band">
        <div className="pulse-lead">
          <p className="section-label">{t.homePulse}</p>
          <p className="section-copy">{t.homePulseBody}</p>
        </div>

        <div className="pulse-groups">
          <div className="pulse-group">
            <span className="pulse-heading">{t.homeTrending}</span>
            <div className="trend-cloud">
              {trending.length === 0 ? (
                <span className="empty-inline">{t.homeNoListings}</span>
              ) : (
                trending.map((keyword) => (
                  <span className="trend-chip" key={keyword}>
                    {keyword}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="pulse-group">
            <span className="pulse-heading">{t.homeCategories}</span>
            <div className="category-stack">
              {hotCategories.length === 0 ? (
                <span className="empty-inline">{t.homeNoListings}</span>
              ) : (
                hotCategories.map(({ category, count }) => (
                  <span className="category-pill" key={category}>
                    <strong>{category}</strong>
                    <span>{count}</span>
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="lane-grid" id="fresh">
        {renderLane(t.homeUnder10, under10, t.homeNoListings, locale)}
        {renderLane(t.homeUnder100, under100, t.homeNoListings, locale)}
        {renderLane(t.homeUnder1000, under1000, t.homeNoListings, locale)}
      </section>

      <section className="content-panel latest-panel">
        <div className="latest-panel-head">
          <div>
            <p className="section-label">{t.homeLatest}</p>
            <p className="section-copy">{t.homeLatestBody}</p>
          </div>
        </div>

        {latest.length === 0 ? (
          <div className="empty-state">{t.homeNoListings}</div>
        ) : (
          <div className="latest-feed-grid">
            {latest.map((listing) => (
              <article className="latest-feed-card" key={listing.id}>
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
                    <span>{getListingLabel(listing)}</span>
                  </div>
                )}

                <div className="latest-card-body">
                  <div className="micro-row">
                    {listing.category ? <span className="micro-badge">{listing.category}</span> : null}
                    <span className="micro-badge subdued">{formatDate(listing.postedAt, locale)}</span>
                  </div>
                  <h3>{listing.title}</h3>
                  <p>{listing.description ?? listing.sellerName}</p>
                  <div className="latest-feed-footer">
                    <strong>{formatCurrency(listing.priceCents, listing.currency)}</strong>
                    <a href={listing.url} target="_blank" rel="noreferrer">
                      {t.openListing}
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
