import { copy, getLocalePreference } from "@/lib/i18n";

export default async function GdprPage() {
  const locale = await getLocalePreference();
  const t = copy[locale];

  return (
    <main className="single-panel-page">
      <section className="content-panel legal-panel">
        <div className="eyebrow">{t.gdpr}</div>
        <h1 className="section-title">{t.gdpr}</h1>
        <p className="section-copy">
          You can request access, export, correction, and deletion of your personal data. The dashboard exposes direct
          actions for export and full account deletion.
        </p>
        <p className="section-copy">
          Data categories include Google identity data, Telegram chat linkage, stored filters, alert records, and matched
          listing metadata associated with your account.
        </p>
      </section>
    </main>
  );
}
