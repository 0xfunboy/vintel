"use client";

import { useEffect, useRef, useState } from "react";

const GLITCH_VARIANTS = ["shift", "slice", "scan"] as const;

type GlitchVariant = (typeof GLITCH_VARIANTS)[number] | "idle";

type HeroGlitchTitleProps = {
  text: string;
};

function nextDelay() {
  return Math.floor(2000 + Math.random() * 3000);
}

export function HeroGlitchTitle({ text }: HeroGlitchTitleProps) {
  const [variant, setVariant] = useState<GlitchVariant>("idle");
  const resetRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;

    const triggerGlitch = () => {
      const nextVariant = GLITCH_VARIANTS[Math.floor(Math.random() * GLITCH_VARIANTS.length)];
      setVariant(nextVariant);

      if (resetRef.current !== null) {
        window.clearTimeout(resetRef.current);
      }

      resetRef.current = window.setTimeout(() => {
        setVariant("idle");
      }, nextVariant === "scan" ? 420 : 260);
    };

    const schedule = () => {
      timerRef.current = window.setTimeout(() => {
        if (!mounted) {
          return;
        }

        triggerGlitch();
        schedule();
      }, nextDelay());
    };

    schedule();

    return () => {
      mounted = false;

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }

      if (resetRef.current !== null) {
        window.clearTimeout(resetRef.current);
      }
    };
  }, []);

  return (
    <h1 className={`hero-glitch hero-glitch--${variant}`} data-text={text}>
      <span>{text}</span>
    </h1>
  );
}
