
import { prisma } from "@/adapters/db";
import type { NextAuthConfig } from "next-auth";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) return null;
          const user = await prisma.user.findFirst({
            where: { email: credentials.email as string },
          });
          if (!user) { console.error("[auth] user not found:", credentials.email); return null; }
          if (!user.password) { console.error("[auth] no password set for user"); return null; }
          const valid = await bcrypt.compare(
            credentials.password as string,
            user.password
          );
          console.log("[auth] password valid:", valid, "for", credentials.email);
            if (!valid) return null;
          return {
            id: user.id,
            email: user.email,
            role: user.role,
            tenantId: user.tenantId,
          };
        } catch (err) {
          console.error("[auth] authorize error:", err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.tenantId = user.tenantId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role;
        session.user.tenantId = token.tenantId;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      try {
        const { logAudit } = await import("@/lib/audit");
        const u = user as { id?: string; email?: string; tenantId?: string };
        await logAudit({
          action: "login",
          actorId: u.id,
          actorEmail: u.email ?? undefined,
          tenantId: u.tenantId,
        });
      } catch { /* never block login */ }
    },
  },
  pages: {
    signIn: "/auth",
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);