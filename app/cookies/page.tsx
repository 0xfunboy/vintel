import { copy, getLocalePreference } from "@/lib/i18n";

export default async function CookiesPage() {
  const locale = await getLocalePreference();
  const t = copy[locale];

  return (
    <main className="single-panel-page">
      <section className="content-panel legal-panel">
        <div className="eyebrow">{t.cookies}</div>
        <h1 className="section-title">{t.cookies}</h1>
        <p className="section-copy">
          The app uses essential cookies for authentication, CSRF protection, security, selected language, selected theme,
          and consent state. No advertising or third-party analytics cookies are enabled in this build.
        </p>
        <p className="section-copy">
          Preference cookies may be refused from the consent banner. Authentication cookies remain necessary to access the
          private dashboard.
        </p>
      </section>
    </main>
  );
}
