"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ListingFeedbackButtonProps = {
  listingId: string;
  trackedSearchLabel: string | null;
  keywordOptions: string[];
  labels: {
    button: string;
    title: string;
    body: string;
    priceReason: string;
    priceHint: string;
    wrongReason: string;
    wrongHint: string;
    confirm: string;
    cancel: string;
    success: string;
    failed: string;
  };
};

export function ListingFeedbackButton({ listingId, trackedSearchLabel, keywordOptions, labels }: ListingFeedbackButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<"price_too_high" | "wrong_product">("price_too_high");
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return reason === "price_too_high" || selectedKeywords.length > 0;
  }, [reason, selectedKeywords.length]);

  function toggleKeyword(keyword: string) {
    setSelectedKeywords((current) =>
      current.includes(keyword) ? current.filter((entry) => entry !== keyword) : [...current, keyword]
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/listings/feedback", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          listingId,
          reason,
          keywords: reason === "wrong_product" ? selectedKeywords : []
        })
      });

      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? labels.failed);
      }

      setFeedback(labels.success);
      setOpen(false);
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : labels.failed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button className="ghost-button" type="button" onClick={() => setOpen(true)}>
        {labels.button}
      </button>

      {feedback ? <span className="inline-note track-feedback">{feedback}</span> : null}

      {open ? (
        <div className="track-modal-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div className="track-modal" role="dialog" aria-modal="true" aria-label={labels.title} onClick={(event) => event.stopPropagation()}>
            <div className="track-modal-head">
              <div>
                <p className="section-label">{labels.title}</p>
                <p className="section-copy">{labels.body}</p>
              </div>

              <button className="ghost-button" type="button" onClick={() => setOpen(false)}>
                {labels.cancel}
              </button>
            </div>

            <form className="track-modal-form" onSubmit={onSubmit}>
              <div className="feedback-reason-grid">
                <button
                  type="button"
                  className={reason === "price_too_high" ? "filter-chip is-active" : "filter-chip"}
                  onClick={() => {
                    setReason("price_too_high");
                    setSelectedKeywords([]);
                  }}
                >
                  {labels.priceReason}
                </button>
                <button
                  type="button"
                  className={reason === "wrong_product" ? "filter-chip is-active" : "filter-chip"}
                  onClick={() => setReason("wrong_product")}
                >
                  {labels.wrongReason}
                </button>
              </div>

              {reason === "price_too_high" ? (
                <p className="inline-note track-modal-note">
                  {trackedSearchLabel ? labels.priceHint.replace("{hunt}", trackedSearchLabel) : labels.priceHint.replace("{hunt}", "global filter")}
                </p>
              ) : (
                <div className="feedback-keywords-block">
                  <p className="inline-note track-modal-note">{labels.wrongHint}</p>
                  <div className="chip-strip">
                    {keywordOptions.map((keyword) => (
                      <button
                        key={keyword}
                        type="button"
                        className={selectedKeywords.includes(keyword) ? "filter-chip is-active" : "filter-chip"}
                        onClick={() => toggleKeyword(keyword)}
                      >
                        {keyword}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="track-modal-actions">
                <button className="ghost-button" type="button" onClick={() => setOpen(false)}>
                  {labels.cancel}
                </button>
                <button className="primary-button" type="submit" disabled={submitting || !canSubmit}>
                  {submitting ? `${labels.confirm}...` : labels.confirm}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
