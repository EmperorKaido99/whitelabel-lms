import { NextRequest, NextResponse } from "next/server";

// POST /api/admin/enrollments/[enrollmentId]/reset
// Deletes progress and resets enrollment status back to "enrolled"
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  try {
    const { enrollmentId } = await params;
    const { prisma } = await import("@/adapters/db");

    const enrollment = await prisma.enrollment.findUnique({ where: { id: enrollmentId } });
    if (!enrollment) return NextResponse.json({ error: "Enrollment not found." }, { status: 404 });

    await prisma.progress.deleteMany({ where: { enrollmentId } });
    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { status: "enrolled" },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[enrollment/reset]", err);
    return NextResponse.json({ error: "Failed to reset progress." }, { status: 500 });
  }
}
