"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import type { Locale } from "@/lib/types";

type LocaleSwitcherProps = {
  initialLocale: Locale;
  label: string;
};

const flags: Record<Locale, string> = { en: "🇬🇧", it: "🇮🇹" };

export function LocaleSwitcher({ initialLocale, label }: LocaleSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function updateLocale(nextLocale: Locale) {
    await fetch("/api/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale: nextLocale })
    });

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="locale-btns" aria-label={label}>
      {(["en", "it"] as Locale[]).map((locale) => (
        <button
          key={locale}
          type="button"
          className={initialLocale === locale ? "locale-btn is-active" : "locale-btn"}
          disabled={isPending}
          onClick={() => updateLocale(locale)}
          title={locale.toUpperCase()}
        >
          {flags[locale]}
        </button>
      ))}
    </div>
  );
}
