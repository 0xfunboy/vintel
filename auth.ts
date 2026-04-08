import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { ensureUser } from "@/lib/db";

const googleConfigured = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

export const { auth, handlers, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt"
  },
  providers: googleConfigured ? [Google] : [],
  pages: {
    signIn: "/signin"
  },
  callbacks: {
    async signIn({ user, profile }) {
      const email = user.email ?? (typeof profile?.email === "string" ? profile.email : null);
      const verified = typeof profile?.email_verified === "boolean" ? profile.email_verified : true;

      if (!email || !verified) {
        return false;
      }

      await ensureUser({
        email,
        name: user.name,
        image: user.image,
        locale: "en",
        theme: "dark"
      });

      return true;
    },
    async session({ session, token }) {
      if (session.user && typeof token.email === "string") {
        session.user.email = token.email;
      }

      return session;
    }
  }
});

export function isGoogleConfigured() {
  return googleConfigured;
}
