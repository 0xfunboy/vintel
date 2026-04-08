import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ingestListings } from "@/lib/ingest";

const listingSchema = z.object({
  source: z.string().min(1),
  sourceListingId: z.string().min(1),
  searchUrl: z.string().url().nullable().optional(),
  category: z.string().nullable().optional(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  url: z.string().url(),
  imageUrl: z.string().url().nullable().optional(),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().min(3).max(8),
  sellerName: z.string().min(1),
  sellerUrl: z.string().url().nullable().optional(),
  location: z.string().nullable().optional(),
  postedAt: z.string().datetime()
});

const payloadSchema = z.object({
  items: z.array(listingSchema)
});

function isAuthorized(request: NextRequest) {
  const secret = process.env.INGEST_CRON_SECRET;
  if (!secret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const summary = await ingestListings(parsed.data.items);
  return NextResponse.json({ ok: true, summary });
}
