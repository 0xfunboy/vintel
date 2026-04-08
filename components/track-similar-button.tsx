"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

type TrackPreset = {
  label: string;
  query: string;
  searchUrl: string;
  categoryTitle: string | null;
  includeKeywords: string[];
  minPriceCents: number | null;
  maxPriceCents: number | null;
  listingTitle: string | null;
  listingPriceCents: number | null;
};

type TrackSimilarButtonProps = {
  allowTracking: boolean;
  trackHref: string;
  buttonLabel: string;
  buttonClassName?: string;
  preset: TrackPreset;
  labels: {
    title: string;
    body: string;
    label: string;
    query: string;
    category: string;
    keywords: string;
    minPrice: string;
    maxPrice: string;
    searchUrl: string;
    submit: string;
    cancel: string;
    telegramHint: string;
    saved: string;
    failed: string;
  };
};

type TrackFormState = {
  label: string;
  query: string;
  categoryTitle: string;
  includeKeywords: string;
  minPrice: string;
  maxPrice: string;
  searchUrl: string;
};

function centsToDisplay(value: number | null) {
  return value !== null && Number.isFinite(value) ? String(Math.round(value / 100)) : "";
}

function toFormState(preset: TrackPreset): TrackFormState {
  return {
    label: preset.label,
    query: preset.query,
    categoryTitle: preset.categoryTitle ?? "",
    includeKeywords: preset.includeKeywords.join(", "),
    minPrice: centsToDisplay(preset.minPriceCents),
    maxPrice: centsToDisplay(preset.maxPriceCents),
    searchUrl: preset.searchUrl
  };
}

function displayToCents(value: string) {
  const number = Number(value.trim());
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) : null;
}

export function TrackSimilarButton({
  allowTracking,
  trackHref,
  buttonLabel,
  buttonClassName = "ghost-button",
  preset,
  labels
}: TrackSimilarButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [form, setForm] = useState<TrackFormState>(() => toFormState(preset));

  function openModal() {
    if (!allowTracking) {
      window.location.href = trackHref;
      return;
    }

    setForm(toFormState(preset));
    setFeedback(null);
    setOpen(true);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/sniper/track", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          label: form.label.trim(),
          query: form.query.trim(),
          searchUrl: form.searchUrl.trim(),
          categoryTitle: form.categoryTitle.trim() || null,
          includeKeywords: form.includeKeywords
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean),
          minPriceCents: displayToCents(form.minPrice),
          maxPriceCents: displayToCents(form.maxPrice),
          listingTitle: preset.listingTitle,
          listingPriceCents: preset.listingPriceCents
        })
      });

      if (response.status === 401) {
        window.location.href = trackHref;
        return;
      }

      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? labels.failed);
      }

      setFeedback(labels.saved);
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
      <button className={buttonClassName} type="button" onClick={openModal}>
        {buttonLabel}
      </button>

      {feedback ? <span className="inline-note track-feedback">{feedback}</span> : null}

      {open ? (
        <div className="track-modal-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div
            className="track-modal"
            role="dialog"
            aria-modal="true"
            aria-label={labels.title}
            onClick={(event) => event.stopPropagation()}
          >
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
              <label className="field">
                <span>{labels.label}</span>
                <input value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} />
              </label>

              <label className="field">
                <span>{labels.query}</span>
                <input value={form.query} onChange={(event) => setForm((current) => ({ ...current, query: event.target.value }))} />
              </label>

              <label className="field">
                <span>{labels.category}</span>
                <input
                  value={form.categoryTitle}
                  onChange={(event) => setForm((current) => ({ ...current, categoryTitle: event.target.value }))}
                />
              </label>

              <label className="field">
                <span>{labels.keywords}</span>
                <input
                  value={form.includeKeywords}
                  onChange={(event) => setForm((current) => ({ ...current, includeKeywords: event.target.value }))}
                />
              </label>

              <label className="field">
                <span>{labels.minPrice}</span>
                <input
                  inputMode="decimal"
                  value={form.minPrice}
                  onChange={(event) => setForm((current) => ({ ...current, minPrice: event.target.value }))}
                />
              </label>

              <label className="field">
                <span>{labels.maxPrice}</span>
                <input
                  inputMode="decimal"
                  value={form.maxPrice}
                  onChange={(event) => setForm((current) => ({ ...current, maxPrice: event.target.value }))}
                />
              </label>

              <label className="field-wide">
                <span>{labels.searchUrl}</span>
                <input
                  value={form.searchUrl}
                  onChange={(event) => setForm((current) => ({ ...current, searchUrl: event.target.value }))}
                />
              </label>

              <p className="inline-note track-modal-note">{labels.telegramHint}</p>

              <div className="track-modal-actions">
                <button className="ghost-button" type="button" onClick={() => setOpen(false)}>
                  {labels.cancel}
                </button>
                <button className="primary-button" type="submit" disabled={submitting}>
                  {submitting ? `${labels.submit}...` : labels.submit}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
