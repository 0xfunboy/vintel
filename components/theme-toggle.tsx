"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import type { Theme } from "@/lib/types";

type ThemeToggleProps = {
  initialTheme: Theme;
  labels: {
    dark: string;
    light: string;
    theme: string;
  };
};

export function ThemeToggle({ initialTheme, labels }: ThemeToggleProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function updateTheme(nextTheme: Theme) {
    document.documentElement.dataset.theme = nextTheme;

    await fetch("/api/preferences", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        theme: nextTheme
      })
    });

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="segmented" aria-label={labels.theme}>
      <button
        type="button"
        className={initialTheme === "dark" ? "segmented-button is-active" : "segmented-button"}
        disabled={isPending}
        onClick={() => updateTheme("dark")}
      >
        {labels.dark}
      </button>
      <button
        type="button"
        className={initialTheme === "light" ? "segmented-button is-active" : "segmented-button"}
        disabled={isPending}
        onClick={() => updateTheme("light")}
      >
        {labels.light}
      </button>
    </div>
  );
}
