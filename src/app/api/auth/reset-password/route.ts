import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { checkRateLimit } from "@/lib/rate-limit";
import { validatePassword } from "@/lib/password";

// 10 attempts per 15 minutes per IP to prevent token brute-force
const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 10;

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`reset:${ip}`, MAX_REQUESTS, WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many requests. Please try again in ${rl.retryAfter} seconds.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  try {
    const { token, password } = await req.json();
    if (!token || !password) return NextResponse.json({ error: "Token and password required" }, { status: 400 });

    const { valid, errors } = validatePassword(password);
    if (!valid) return NextResponse.json({ error: errors.join(". ") + "." }, { status: 400 });

    const { prisma } = await import("@/adapters/db");
    const record = await prisma.passwordResetToken.findUnique({ where: { token }, include: { user: true } });

    if (!record) return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
    if (record.expiresAt < new Date()) {
      await prisma.passwordResetToken.delete({ where: { token } });
      return NextResponse.json({ error: "Token has expired" }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password, 12);
    await prisma.user.update({ where: { id: record.userId }, data: { password: hashed } });
    await prisma.passwordResetToken.delete({ where: { token } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("reset-password error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
