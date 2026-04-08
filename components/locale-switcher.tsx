"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import type { Locale } from "@/lib/types";

type LocaleSwitcherProps = {
  initialLocale: Locale;
  label: string;
};

export function LocaleSwitcher({ initialLocale, label }: LocaleSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function updateLocale(nextLocale: Locale) {
    await fetch("/api/preferences", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        locale: nextLocale
      })
    });

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="segmented" aria-label={label}>
      <button
        type="button"
        className={initialLocale === "en" ? "segmented-button is-active" : "segmented-button"}
        disabled={isPending}
        onClick={() => updateLocale("en")}
      >
        EN
      </button>
      <button
        type="button"
        className={initialLocale === "it" ? "segmented-button is-active" : "segmented-button"}
        disabled={isPending}
        onClick={() => updateLocale("it")}
      >
        IT
      </button>
    </div>
  );
}
