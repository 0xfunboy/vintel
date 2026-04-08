import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { exportUserData, getUserByEmail } from "@/lib/db";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const user = await getUserByEmail(email);
  if (!user) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }

  const payload = await exportUserData(user.id);
  return NextResponse.json(payload, {
    headers: {
      "content-disposition": `attachment; filename="vintel-export-${user.id}.json"`
    }
  });
}
