"use client";

import { useState } from "react";

type CookieBannerProps = {
  body: string;
  acceptLabel: string;
  rejectLabel: string;
  consent: string | null;
};

export function CookieBanner({ body, acceptLabel, rejectLabel, consent }: CookieBannerProps) {
  const [visible, setVisible] = useState(consent === null);

  function save(value: "accepted" | "rejected") {
    document.cookie = `cookie_consent=${value}; Max-Age=31536000; Path=/; SameSite=Lax`;
    setVisible(false);
  }

  if (!visible) {
    return null;
  }

  return (
    <div className="cookie-banner">
      <div className="cookie-copy">{body}</div>
      <div className="cookie-actions">
        <button type="button" className="ghost-button" onClick={() => save("rejected")}>
          {rejectLabel}
        </button>
        <button type="button" className="primary-button" onClick={() => save("accepted")}>
          {acceptLabel}
        </button>
      </div>
    </div>
  );
}
