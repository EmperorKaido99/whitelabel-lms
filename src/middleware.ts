import NextAuth from "next-auth";
import { edgeAuthConfig } from "@/lib/auth/edge-config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(edgeAuthConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const user = req.auth?.user as { role?: string } | undefined;
  const isLoggedIn = !!req.auth?.user;
  const isAdmin = user?.role === "admin";

  // Protect /admin — must be logged in as admin
  if (pathname.startsWith("/admin")) {
    if (!isLoggedIn) {
      const url = new URL("/auth", req.url);
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }
    if (!isAdmin) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  // Protect /dashboard and /certificate — must be logged in
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/certificate")) {
    if (!isLoggedIn) {
      const url = new URL("/auth", req.url);
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }
  }
});

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/certificate/:path*"],
};
