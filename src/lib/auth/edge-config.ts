import type { NextAuthConfig } from "next-auth";

// Edge-safe config — no Prisma, no Node-only modules.
// Used exclusively in middleware for JWT validation.
export const edgeAuthConfig: NextAuthConfig = {
  providers: [],
  pages: { signIn: "/auth" },
};
