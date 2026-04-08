import { randomUUID } from "node:crypto";

import { readAlerts, readListings, readUsers, writeAlerts, writeListings } from "./db";
import { matchListingToUser } from "./filters";
import { sendTelegramAlert } from "./telegram";
import type { AlertRecord, IngestListing, IngestSummary, ListingRecord } from "./types";

export async function ingestListings(items: IngestListing[]): Promise<IngestSummary> {
  const [users, existingListings, existingAlerts] = await Promise.all([readUsers(), readListings(), readAlerts()]);
  const knownListings = new Set(existingListings.map((entry) => `${entry.source}:${entry.sourceListingId}`));
  const nextListings = [...existingListings];
  const nextAlerts = [...existingAlerts];

  const summary: IngestSummary = {
    received: items.length,
    inserted: 0,
    matched: 0,
    dashboardAlerts: 0,
    telegramAlerts: 0
  };

  for (const item of items) {
    const listingKey = `${item.source}:${item.sourceListingId}`;
    if (knownListings.has(listingKey)) {
      continue;
    }

    const results = users
      .map((user) => ({
        user,
        result: matchListingToUser(item, user)
      }))
      .filter((entry) => entry.result.matches);

    if (results.length === 0) {
      continue;
    }

    summary.matched += 1;

    const listing: ListingRecord = {
      id: randomUUID(),
      source: item.source,
      sourceListingId: item.sourceListingId,
      category: item.category ?? null,
      title: item.title,
      description: item.description ?? null,
      url: item.url,
      imageUrl: item.imageUrl ?? null,
      priceCents: item.priceCents,
      currency: item.currency,
      sellerName: item.sellerName,
      sellerUrl: item.sellerUrl ?? null,
      location: item.location ?? null,
      postedAt: item.postedAt,
      discoveredAt: new Date().toISOString(),
      score: Math.max(...results.map((entry) => entry.result.score)),
      matchedUserIds: results.map((entry) => entry.user.id),
      matchedKeywords: [...new Set(results.flatMap((entry) => entry.result.matchedKeywords))],
      notes: [...new Set(results.flatMap((entry) => entry.result.notes))],
      status: "new"
    };

    nextListings.unshift(listing);
    knownListings.add(listingKey);
    summary.inserted += 1;

    for (const { user } of results) {
      const dashboardAlert: AlertRecord = {
        id: randomUUID(),
        userId: user.id,
        listingId: listing.id,
        channel: "dashboard",
        sentAt: new Date().toISOString(),
        openedAt: null,
        clickedAt: null
      };

      nextAlerts.unshift(dashboardAlert);
      summary.dashboardAlerts += 1;

      const telegramSent = await sendTelegramAlert(user, listing);
      if (telegramSent) {
        summary.telegramAlerts += 1;
        listing.status = "alerted";
      }
    }
  }

  await Promise.all([writeListings(nextListings), writeAlerts(nextAlerts)]);
  return summary;
}
