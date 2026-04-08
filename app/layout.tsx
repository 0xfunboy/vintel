import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Manrope, Space_Grotesk } from "next/font/google";

import { auth } from "@/auth";
import { CookieBanner } from "@/components/cookie-banner";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { copy, getCookieConsent, getLocalePreference, getThemePreference } from "@/lib/i18n";

import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display"
});

const body = Manrope({
  subsets: ["latin"],
  variable: "--font-body"
});

export const metadata: Metadata = {
  metadataBase: new URL("https://app.eeess.cyou"),
  title: "Vintel | Vinted sniper",
  description: "Vintel turns fresh Vinted listings into a clean public market board with optional personal filters and Telegram delivery."
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await auth();
  const locale = await getLocalePreference();
  const theme = await getThemePreference();
  const consent = await getCookieConsent();
  const t = copy[locale];

  return (
    <html lang={locale} data-theme={theme}>
      <body className={`${display.variable} ${body.variable}`}>
        <div className="page-background">
          <div className="page-noise" />
          <div className="site-shell">
            <header className="site-header">
              <div className="header-main">
                <a href="/" className="brand">
                  <span className="brand-mark" />
                  <span>
                    <strong>{t.brand}</strong>
                    <small>{t.tagline}</small>
                  </span>
                </a>

                <nav className="nav-links">
                  <a href="/">{t.navHome}</a>
                  <a href="/#trending">{t.navTrending}</a>
                  <a href="/#fresh">{t.navFresh}</a>
                  <a href="/#bot">{t.navTelegram}</a>
                </nav>
              </div>

              <div className="toolbar">
                <LocaleSwitcher initialLocale={locale} label={t.language} />
                <ThemeToggle
                  initialTheme={theme}
                  labels={{
                    theme: t.theme,
                    dark: t.dark,
                    light: t.light
                  }}
                />
                <a className="header-cta" href={session?.user?.email ? "/dashboard" : "/signin"}>
                  {session?.user?.email ? t.navDashboard : t.signInTitle}
                </a>
              </div>
            </header>

            {children}

            <footer className="site-footer">
              <div className="footer-links">
                <a href="/dashboard">{t.navDashboard}</a>
                <a href="/privacy">{t.navPrivacy}</a>
                <a href="/cookies">{t.navCookies}</a>
                <a href="/gdpr">{t.navGdpr}</a>
              </div>
              <p>{t.footerNote}</p>
            </footer>
          </div>
        </div>

        <CookieBanner body={t.cookieBanner} acceptLabel={t.cookieAccept} rejectLabel={t.cookieReject} consent={consent} />
      </body>
    </html>
  );
}
