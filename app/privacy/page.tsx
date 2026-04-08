import { copy, getLocalePreference } from "@/lib/i18n";

export default async function PrivacyPage() {
  const locale = await getLocalePreference();
  const t = copy[locale];

  return (
    <main className="single-panel-page">
      <section className="content-panel legal-panel">
        <div className="eyebrow">{t.privacy}</div>
        <h1 className="section-title">{t.privacy}</h1>
        <p className="section-copy">
          This service processes Google account identity data, user-defined filter preferences, Telegram chat linkage,
          alert history, and listing metadata required to deliver manual-buy notifications. Data is stored on the service
          host and retained until deletion by the user or operator.
        </p>
        <p className="section-copy">
          We do not automate checkout, payments, or marketplace transactions. Listing URLs are surfaced for manual action
          by the authenticated user only.
        </p>
        <p className="section-copy">
          For data access or deletion, use the GDPR controls inside the dashboard or contact the service operator at
          <strong> privacy@eeess.cyou</strong>.
        </p>
      </section>
    </main>
  );
}
