import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as { role?: string }).role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = 50;
    const skip = (page - 1) * limit;
    const action = searchParams.get("action") ?? undefined;
    const tenantId = searchParams.get("tenantId") ?? undefined;

    const { prisma } = await import("@/adapters/db");
    const where = {
      ...(action ? { action: { contains: action } } : {}),
      ...(tenantId ? { tenantId } : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({ logs, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("GET /api/admin/audit error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
