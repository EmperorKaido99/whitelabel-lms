import type { NextAuthConfig } from "next-auth";

// Edge-safe config — no Prisma, no Node-only modules.
// Used exclusively in middleware for JWT validation.
export const edgeAuthConfig: NextAuthConfig = {
  providers: [],
  pages: { signIn: "/auth" },
  callbacks: {
    session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string | undefined;
        session.user.tenantId = token.tenantId as string | undefined;
      }
      return session;
    },
  },
};
