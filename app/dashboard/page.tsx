import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  addTrackedUrlAction,
  deleteAccountAction,
  linkTelegramChatIdAction,
  removeTrackedSearchAction,
  rotateTelegramToken,
  saveDashboardSettings,
  signOutAction,
  unlinkTelegramAction
} from "@/app/actions";
import { ensureUser, exportUserData, getUserByEmail, readAlerts, readListings } from "@/lib/db";
import { buildFeedbackKeywordOptions } from "@/lib/feedback";
import { formatCurrency } from "@/lib/filters";
import { copy, getLocalePreference, getThemePreference } from "@/lib/i18n";
import { buildTelegramDeepLink, buildTelegramLinkCommand } from "@/lib/telegram";
import { CopyButton } from "@/components/copy-button";
import { ListingFeedbackButton } from "@/components/listing-feedback-button";
import type { AlertRecord, ListingRecord, TrackedSearchRecord } from "@/lib/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function findTrackedSearchForListing(listing: ListingRecord, alerts: AlertRecord[], trackedSearches: TrackedSearchRecord[]) {
  const alert = alerts.find((entry) => entry.listingId === listing.id && entry.trackedSearchId);
  if (alert?.trackedSearchId) {
    return trackedSearches.find((entry) => entry.id === alert.trackedSearchId) ?? null;
  }

  if (alert?.trackedSearchUrl) {
    return trackedSearches.find((entry) => entry.searchUrl === alert.trackedSearchUrl) ?? null;
  }

  if (!listing.sourceSearchUrl) {
    return null;
  }

  return trackedSearches.find((entry) => entry.searchUrl === listing.sourceSearchUrl) ?? null;
}

export default async function DashboardPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    redirect("/signin");
  }

  const locale = await getLocalePreference();
  const theme = await getThemePreference();
  const t = copy[locale];

  await ensureUser({
    email,
    name: session.user?.name,
    image: session.user?.image,
    locale,
    theme
  });

  const user = await getUserByEmail(email);
  if (!user) {
    redirect("/signin");
  }

  const [allAlerts, allListings, telegramLink, exportData] = await Promise.all([
    readAlerts(),
    readListings(),
    buildTelegramDeepLink(user),
    exportUserData(user.id)
  ]);

  const userAlerts = allAlerts.filter((alert) => alert.userId === user.id);
  const listings = allListings
    .filter((listing) => listing.matchedUserIds.includes(user.id))
    .filter((listing) => !user.filters.dismissedListingIds.includes(listing.id));
  const recentAlerts = userAlerts.slice(0, 12);
  const trackedSearches = user.filters.trackedSearches;
  const today = new Date().toISOString().slice(0, 10);
  const snipedToday = listings.filter((listing) => listing.discoveredAt.slice(0, 10) === today).length;
  const alertsToday = userAlerts.filter((alert) => alert.sentAt.slice(0, 10) === today).length;
  const telegramLinkCommand = buildTelegramLinkCommand(user);

  return (
    <main className="dashboard-grid">
      {/* ── Hero ─────────────────────────────────────── */}
      <section className="content-panel hero-dashboard">
        <div className="hero-stack">
          <div>
            <div className="eyebrow">{t.dashboardTitle}</div>
            <h1 className="section-title">{user.name}</h1>
            <p className="section-copy">{t.dashboardBody}</p>
          </div>

          <div className="toolbar-row">
            <a className="ghost-button" href="/">
              {t.navHome}
            </a>
            <form action={signOutAction}>
              <button className="ghost-button" type="submit">
                {t.signOut}
              </button>
            </form>
            <a className="ghost-button" href="/api/me/export" target="_blank" rel="noreferrer">
              {t.exportData}
            </a>
          </div>
        </div>

        <div className="dashboard-stats">
          <article className="status-card">
            <span className="metric-label">{t.dashboardMetricListings}</span>
            <strong className="metric-value">{listings.length}</strong>
          </article>
          <article className="status-card">
            <span className="metric-label">{t.dashboardMetricToday}</span>
            <strong className="metric-value">{snipedToday}</strong>
          </article>
          <article className="status-card">
            <span className="metric-label">{t.dashboardMetricTracked}</span>
            <strong className="metric-value">{trackedSearches.length}</strong>
          </article>
          <article className="status-card">
            <span className="metric-label">{t.dashboardMetricAlertsToday}</span>
            <strong className="metric-value">{alertsToday}</strong>
          </article>
          <article className="status-card">
            <span className="metric-label">{t.dashboardMetricTelegram}</span>
            <strong className="metric-value metric-value-sm">
              {user.telegramChatId ? t.telegramConnected : t.telegramNotConnected}
            </strong>
          </article>
        </div>
      </section>

      {/* ── Tracked Items ─────────────────────────────── */}
      <section className="content-panel tracked-panel">
        <div className="panel-head">
          <div>
            <h2>{t.dashboardTracked}</h2>
            <p>{t.dashboardTrackedBody}</p>
          </div>
        </div>

        {/* Add custom URL form */}
        <form action={addTrackedUrlAction} className="add-url-form">
          <input
            name="searchUrl"
            type="url"
            required
            placeholder={t.filterCustomUrlPlaceholder}
            className="add-url-input"
          />
          <input name="label" placeholder={t.filterCustomUrlLabel} className="add-url-label-input" />
          <button className="ghost-button add-url-submit" type="submit">
            {t.filterCustomUrlSubmit}
          </button>
        </form>

        {trackedSearches.length === 0 ? (
          <div className="empty-state">{t.dashboardTrackedEmpty}</div>
        ) : (
          <div className="tracked-table-wrap">
            <table className="tracked-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t.filterCategories}</th>
                  <th>{t.filterKeywords}</th>
                  <th>{t.filterMaxPrice}</th>
                  <th>URL</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {trackedSearches.map((trackedSearch, i) => (
                  <tr className="tracked-row" key={trackedSearch.id}>
                    <td className="tracked-index">{i + 1}</td>
                    <td>
                      <div className="tracked-label" title={trackedSearch.label}>
                        {trackedSearch.label}
                      </div>
                      {trackedSearch.categoryTitle ? (
                        <div className="tracked-sub">{trackedSearch.categoryTitle}</div>
                      ) : null}
                    </td>
                    <td className="tracked-keywords">
                      {trackedSearch.includeKeywords.length > 0
                        ? trackedSearch.includeKeywords.slice(0, 4).join(", ") +
                          (trackedSearch.includeKeywords.length > 4 ? "…" : "")
                        : <span className="tracked-empty-cell">—</span>}
                    </td>
                    <td className="tracked-price">
                      {trackedSearch.maxPriceCents ? formatCurrency(trackedSearch.maxPriceCents, "EUR") : <span className="tracked-empty-cell">—</span>}
                    </td>
                    <td className="tracked-url-cell" title={trackedSearch.searchUrl}>
                      {trackedSearch.searchUrl.replace(/^https?:\/\/[^/]+/, "").slice(0, 32)}…
                    </td>
                    <td>
                      <div className="tracked-actions">
                        <CopyButton text={trackedSearch.searchUrl} label={t.copyUrl} copiedLabel={t.copiedUrl} />
                        <a className="icon-btn" href={trackedSearch.searchUrl} target="_blank" rel="noreferrer">
                          {t.openUrl}
                        </a>
                        <form action={removeTrackedSearchAction}>
                          <input type="hidden" name="trackedSearchId" value={trackedSearch.id} />
                          <button className="icon-btn danger-btn-sm" type="submit">
                            ×
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Filters & Delivery ────────────────────────── */}
      <section className="content-panel">
        <div className="panel-head">
          <div>
            <h2>{t.settings}</h2>
            <p>{t.dashboardSettingsBody}</p>
          </div>
        </div>

        <form action={saveDashboardSettings} className="settings-form">
          <label className="field-wide">
            <span>{t.filterCategories}</span>
            <input name="categories" defaultValue={user.filters.categories.join(", ")} />
          </label>

          <label className="field-wide">
            <span>{t.filterKeywords}</span>
            <textarea name="includeKeywords" defaultValue={user.filters.includeKeywords.join(", ")} />
          </label>

          <label className="field-wide">
            <span>{t.filterExclude}</span>
            <textarea name="excludeKeywords" defaultValue={user.filters.excludeKeywords.join(", ")} />
          </label>

          <label className="field">
            <span>{t.filterMinPrice}</span>
            <input name="minPriceCents" type="number" defaultValue={user.filters.minPriceCents ?? ""} />
          </label>

          <label className="field">
            <span>{t.filterMaxPrice}</span>
            <input name="maxPriceCents" type="number" defaultValue={user.filters.maxPriceCents ?? ""} />
          </label>

          <label className="field">
            <span>{t.filterKeywordMode}</span>
            <select name="keywordMode" defaultValue={user.filters.keywordMode} className="select-input">
              <option value="or">OR</option>
              <option value="and">AND</option>
            </select>
          </label>

          <label className="field">
            <span>{t.filterMinScore}</span>
            <input name="minScore" type="number" min="1" max="100" defaultValue={user.filters.minScore} />
          </label>

          <label className="field">
            <span>{t.filterAllow}</span>
            <input name="sellersAllowlist" defaultValue={user.filters.sellersAllowlist.join(", ")} />
          </label>

          <label className="field-wide">
            <span>{t.filterBlock}</span>
            <input name="sellersBlocklist" defaultValue={user.filters.sellersBlocklist.join(", ")} />
          </label>

          <div className="check-row field-wide">
            <label className="check">
              <input type="checkbox" name="searchInDescription" defaultChecked={user.filters.searchInDescription} />
              <span>{t.filterSearchDescription}</span>
            </label>
            <label className="check">
              <input type="checkbox" name="alertsEnabled" defaultChecked={user.alertsEnabled} />
              <span>{t.filterAlerts}</span>
            </label>
            <label className="check">
              <input type="checkbox" name="telegramEnabled" defaultChecked={user.telegramEnabled} />
              <span>{t.filterTelegram}</span>
            </label>
          </div>

          <button className="primary-button field-wide" type="submit">
            {t.saveSettings}
          </button>
        </form>
      </section>

      {/* ── Telegram ──────────────────────────────────── */}
      <section className="content-panel">
        <div className="panel-head">
          <div>
            <h2>{t.telegram}</h2>
            <p>{t.connectTelegramBody}</p>
          </div>
        </div>

        <div className="telegram-compact">
          <div className="telegram-status-row">
            <div className={user.telegramChatId ? "badge success" : "badge"}>
              {user.telegramChatId ? t.telegramConnected : t.telegramNotConnected}
            </div>
            <div className="telegram-quick-actions">
              {telegramLink ? (
                <>
                  <a className="icon-btn" href={telegramLink} target="_blank" rel="noreferrer">
                    {t.autoLinkTelegram}
                  </a>
                  <a className="icon-btn" href={telegramLink} target="_blank" rel="noreferrer">
                    {t.openTelegram}
                  </a>
                </>
              ) : (
                <span className="inline-note warning-note">{t.botUnavailable}</span>
              )}
              <form action={rotateTelegramToken} style={{ display: "contents" }}>
                <button className="icon-btn" type="submit">
                  {t.regenerateToken}
                </button>
              </form>
              {user.telegramChatId ? (
                <form action={unlinkTelegramAction} style={{ display: "contents" }}>
                  <button className="icon-btn danger-btn-sm" type="submit">
                    {t.unlinkTelegram}
                  </button>
                </form>
              ) : null}
            </div>
          </div>

          <label className="field-wide" style={{ marginTop: "14px" }}>
            <span>{t.telegramManualCommand}</span>
            <input readOnly value={telegramLinkCommand} />
          </label>
          <p className="inline-note">{t.telegramManualCommandBody}</p>

          <form action={linkTelegramChatIdAction} className="settings-form compact-settings-form" style={{ marginTop: "10px" }}>
            <label className="field-wide">
              <span>{t.telegramChatId}</span>
              <input name="telegramChatId" defaultValue={user.telegramChatId ?? ""} />
            </label>
            <p className="inline-note field-wide">{t.telegramManualChatIdHint}</p>
            <button className="ghost-button" type="submit">
              {t.telegramManualChatId}
            </button>
          </form>
        </div>
      </section>

      {/* ── Matched Listings ──────────────────────────── */}
      <section className="content-panel listings-panel">
        <div className="panel-head">
          <div>
            <h2>{t.listingStream}</h2>
            <p>{t.productFeedBody}</p>
          </div>
        </div>

        {listings.length === 0 ? (
          <div className="empty-state">{t.emptyListings}</div>
        ) : (
          <div className="listing-grid">
            {listings.map((listing) => {
              const trackedSearch = findTrackedSearchForListing(listing, userAlerts, trackedSearches);

              return (
                <article className="listing-card" key={listing.id}>
                  <div className="listing-head">
                    <div>
                      <div className="badge">{listing.source}</div>
                      <h3>{listing.title}</h3>
                      {trackedSearch?.label ? (
                        <div className="tracked-sub">{trackedSearch.label}</div>
                      ) : null}
                    </div>
                    <div className="price-pill">{formatCurrency(listing.priceCents, listing.currency)}</div>
                  </div>

                  <div className="meta-grid">
                    <span>{listing.sellerName}</span>
                    <span>{formatDate(listing.postedAt)}</span>
                    <span>score {listing.score}</span>
                  </div>

                  <div className="token-row">
                    {listing.matchedKeywords.map((keyword) => (
                      <span className="token" key={keyword}>
                        {keyword}
                      </span>
                    ))}
                  </div>

                  <div className="listing-actions">
                    <a className="primary-button" href={listing.url} target="_blank" rel="noreferrer">
                      {t.buy}
                    </a>
                    <a className="ghost-button" href={listing.url} target="_blank" rel="noreferrer">
                      {t.openListing}
                    </a>
                    <ListingFeedbackButton
                      listingId={listing.id}
                      trackedSearchLabel={trackedSearch?.label ?? null}
                      keywordOptions={buildFeedbackKeywordOptions(listing, trackedSearch)}
                      labels={{
                        button: t.feedbackNotInterested,
                        title: t.feedbackTitle,
                        body: t.feedbackBody,
                        priceReason: t.feedbackReasonPrice,
                        priceHint: t.feedbackReasonPriceHint,
                        wrongReason: t.feedbackReasonWrong,
                        wrongHint: t.feedbackReasonWrongHint,
                        confirm: t.feedbackConfirm,
                        cancel: t.feedbackCancel,
                        success: t.feedbackSuccess,
                        failed: t.feedbackFailed
                      }}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Activity ──────────────────────────────────── */}
      <section className="content-panel">
        <div className="panel-head">
          <div>
            <h2>{t.activity}</h2>
            <p>
              {exportData
                ? `${exportData.alerts.length} total alerts in your account history.`
                : t.dashboardActivityBody}
            </p>
          </div>
        </div>

        {recentAlerts.length === 0 ? (
          <div className="empty-state">{t.emptyAlerts}</div>
        ) : (
          <div className="activity-list">
            {recentAlerts.map((alert) => (
              <div className="activity-row" key={alert.id}>
                <strong>{alert.channel}</strong>
                <span>{formatDate(alert.sentAt)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── GDPR ──────────────────────────────────────── */}
      <section className="content-panel danger-panel">
        <div className="panel-head">
          <div>
            <h2>{t.gdpr}</h2>
            <p>{t.dashboardDeleteBody}</p>
          </div>
        </div>

        <div className="danger-actions">
          <a className="ghost-button" href="/api/me/export" target="_blank" rel="noreferrer">
            {t.exportData}
          </a>
          <form action={deleteAccountAction}>
            <button className="danger-button" type="submit">
              {t.deleteAccount}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
