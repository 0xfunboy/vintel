import { signInWithGoogle } from "@/app/actions";
import { isGoogleConfigured } from "@/auth";
import { copy, getLocalePreference } from "@/lib/i18n";

export default async function SignInPage() {
  const locale = await getLocalePreference();
  const t = copy[locale];

  return (
    <main className="single-panel-page">
      <section className="content-panel narrow-panel">
        <div className="eyebrow">{t.signInTitle}</div>
        <h1 className="section-title">{t.signInTitle}</h1>
        <p className="section-copy">{t.signInBody}</p>

        <form action={signInWithGoogle}>
          <button className="primary-button" type="submit" disabled={!isGoogleConfigured()}>
            {t.heroCta}
          </button>
        </form>

        {!isGoogleConfigured() ? <p className="inline-note warning-note">{t.signInConfigMissing}</p> : null}
      </section>
    </main>
  );
}
