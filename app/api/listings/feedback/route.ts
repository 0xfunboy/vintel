import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getUserByEmail } from "@/lib/db";
import { applyListingFeedback, getListingFeedbackContext } from "@/lib/feedback";

const payloadSchema = z.object({
  listingId: z.string().min(1),
  reason: z.enum(["price_too_high", "wrong_product"]),
  keywords: z.array(z.string()).optional().default([])
});

export async function POST(request: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const user = await getUserByEmail(email);
  if (!user) {
    return NextResponse.json({ ok: false, error: "unknown-user" }, { status: 404 });
  }

  try {
    const context = await getListingFeedbackContext(user.id, parsed.data.listingId);
    if (!context) {
      return NextResponse.json({ ok: false, error: "listing-not-found" }, { status: 404 });
    }

    const summary = await applyListingFeedback({
      userId: user.id,
      listingId: parsed.data.listingId,
      reason: parsed.data.reason,
      keywords: parsed.data.keywords
    });

    return NextResponse.json({
      ok: true,
      summary,
      listing: {
        id: context.listing.id,
        title: context.listing.title
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "feedback-failed"
      },
      { status: 400 }
    );
  }
}
