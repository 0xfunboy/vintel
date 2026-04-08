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

  async function toggle() {
    const next: Theme = initialTheme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;

    await fetch("/api/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ theme: next })
    });

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      className="theme-btn"
      disabled={isPending}
      onClick={toggle}
      title={labels.theme}
      aria-label={initialTheme === "dark" ? labels.light : labels.dark}
    >
      {initialTheme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
