"use client";

import { useState } from "react";

type CopyButtonProps = {
  text: string;
  label: string;
  copiedLabel: string;
};

export function CopyButton({ text, label, copiedLabel }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // fallback: select and copy via execCommand
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <button type="button" className={copied ? "icon-btn is-copied" : "icon-btn"} onClick={handleCopy}>
      {copied ? copiedLabel : label}
    </button>
  );
}
