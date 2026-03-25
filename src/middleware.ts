import NextAuth from "next-auth";
import { edgeAuthConfig } from "@/lib/auth/edge-config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(edgeAuthConfig);

export default auth((req) => {
  if (!req.auth?.user) {
    const signInUrl = new URL("/auth", req.url);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }
});

export const config = {
  matcher: ["/admin/:path*"],
};
