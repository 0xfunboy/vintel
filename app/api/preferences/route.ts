import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { auth } from "@/auth";
import { getUserByEmail, updateUserById } from "@/lib/db";
import type { Locale, Theme } from "@/lib/types";

function isTheme(value: unknown): value is Theme {
  return value === "dark" || value === "light";
}

function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "it";
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { theme?: unknown; locale?: unknown };
  const cookieStore = await cookies();

  if (isTheme(body.theme)) {
    cookieStore.set("theme", body.theme, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365
    });
  }

  if (isLocale(body.locale)) {
    cookieStore.set("locale", body.locale, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365
    });
  }

  const session = await auth();
  if (session?.user?.email) {
    const user = await getUserByEmail(session.user.email);
    if (user) {
      await updateUserById(user.id, (current) => ({
        ...current,
        theme: isTheme(body.theme) ? body.theme : current.theme,
        locale: isLocale(body.locale) ? body.locale : current.locale
      }));
    }
  }

  return NextResponse.json({ ok: true });
}
