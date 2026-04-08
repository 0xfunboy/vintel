import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { deleteAccountAction, rotateTelegramToken, saveDashboardSettings, signOutAction } from "@/app/actions";
import { ensureUser, exportUserData, getUserByEmail, readAlerts, readListings } from "@/lib/db";
import { formatCurrency } from "@/lib/filters";
import { copy, getLocalePreference, getThemePreference } from "@/lib/i18n";
import { buildTelegramDeepLink } from "@/lib/telegram";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
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

  const listings = allListings.filter((listing) => listing.matchedUserIds.includes(user.id));
  const alerts = allAlerts.filter((alert) => alert.userId === user.id).slice(0, 12);
  const matchedKeywords = [...new Set(listings.flatMap((listing) => listing.matchedKeywords))].slice(0, 8);

  return (
    <main className="dashboard-grid">
      <section className="content-panel hero-dashboard">
        <div className="hero-stack">
          <div>
            <div className="eyebrow">{t.dashboardTitle}</div>
            <h1 className="section-title">{user.name}</h1>
            <p className="section-copy">{t.dashboardBody}</p>
          </div>

          <div className="toolbar-row">
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
            <span className="metric-label">{t.dashboardMetricTelegram}</span>
            <strong className="metric-value">{user.telegramChatId ? t.telegramConnected : t.telegramNotConnected}</strong>
          </article>
          <article className="status-card">
            <span className="metric-label">{t.dashboardMetricKeywords}</span>
            <strong className="metric-value">{matchedKeywords.length}</strong>
          </article>
        </div>
      </section>

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

          <label className="field-wide">
            <span>{t.filterSearchUrls}</span>
            <textarea name="searchUrls" defaultValue={user.filters.searchUrls.join("\n")} />
          </label>

          <div className="check-row">
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

          <button className="primary-button" type="submit">
            {t.saveSettings}
          </button>
        </form>
      </section>

      <section className="content-panel">
        <div className="panel-head">
          <div>
            <h2>{t.telegram}</h2>
            <p>{t.connectTelegramBody}</p>
          </div>
        </div>

        <div className="telegram-card">
          <div className={user.telegramChatId ? "badge success" : "badge"}>{user.telegramChatId ? t.telegramConnected : t.telegramNotConnected}</div>
          {telegramLink ? (
            <a className="primary-button" href={telegramLink} target="_blank" rel="noreferrer">
              {t.openTelegram}
            </a>
          ) : (
            <p className="inline-note warning-note">{t.botUnavailable}</p>
          )}

          <form action={rotateTelegramToken}>
            <button className="ghost-button" type="submit">
              {t.regenerateToken}
            </button>
          </form>
        </div>
      </section>

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
            {listings.map((listing) => (
              <article className="listing-card" key={listing.id}>
                <div className="listing-head">
                  <div>
                    <div className="badge">{listing.source}</div>
                    <h3>{listing.title}</h3>
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

                <div className="token-row muted-row">
                  {listing.notes.map((note) => (
                    <span className="token subdued" key={note}>
                      {note}
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
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="content-panel">
        <div className="panel-head">
          <div>
            <h2>{t.activity}</h2>
            <p>{exportData ? `${exportData.alerts.length} total alerts in your account history.` : t.dashboardActivityBody}</p>
          </div>
        </div>

        {alerts.length === 0 ? (
          <div className="empty-state">{t.emptyAlerts}</div>
        ) : (
          <div className="activity-list">
            {alerts.map((alert) => (
              <div className="activity-row" key={alert.id}>
                <strong>{alert.channel}</strong>
                <span>{formatDate(alert.sentAt)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

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
