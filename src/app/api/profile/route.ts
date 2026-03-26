import { NextRequest, NextResponse } from "next/server";

async function getSession() {
  const { auth } = await import("@/lib/auth/config");
  return auth();
}

// GET /api/profile — return the current user's public fields
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const { prisma } = await import("@/adapters/db");
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json(user);
  } catch (err) {
    console.error("[profile/GET]", err);
    return NextResponse.json({ error: "Failed to fetch profile." }, { status: 500 });
  }
}

// PATCH /api/profile — update name and/or password
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const body = await req.json();
    const { name, currentPassword, newPassword } = body;

    const { prisma } = await import("@/adapters/db");
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const updates: Record<string, unknown> = {};

    // Update name
    if (typeof name === "string") {
      updates.name = name.trim() || null;
    }

    // Update password (requires current password verification)
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: "Current password is required to set a new one." }, { status: 400 });
      }

      const { validatePassword } = await import("@/lib/password");
      const { valid, errors } = validatePassword(newPassword);
      if (!valid) {
        return NextResponse.json({ error: errors.join(". ") + "." }, { status: 400 });
      }

      const bcrypt = await import("bcryptjs");
      if (user.password) {
        const match = await bcrypt.compare(currentPassword, user.password);
        if (!match) {
          return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
        }
      }

      updates.password = await bcrypt.hash(newPassword, 12);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    await prisma.user.update({ where: { id: session.user.id }, data: updates });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[profile/PATCH]", err);
    return NextResponse.json({ error: "Failed to update profile." }, { status: 500 });
  }
}
