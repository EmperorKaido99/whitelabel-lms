import { NextRequest, NextResponse } from "next/server";

// DELETE /api/admin/enrollments/[enrollmentId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  try {
    const { enrollmentId } = await params;
    const { prisma } = await import("@/adapters/db");

    await prisma.progress.deleteMany({ where: { enrollmentId } });
    await prisma.enrollment.delete({ where: { id: enrollmentId } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[enrollments/DELETE]", err);
    return NextResponse.json({ error: "Failed to remove enrollment." }, { status: 500 });
  }
}
