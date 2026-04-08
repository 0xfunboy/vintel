import { NextRequest, NextResponse } from "next/server";

import { pollTrackedSearches } from "@/lib/poller";

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

  const summary = await pollTrackedSearches();
  return NextResponse.json({ ok: true, summary });
}
