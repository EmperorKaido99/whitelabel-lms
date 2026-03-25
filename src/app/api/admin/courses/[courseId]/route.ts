import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, rm } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const CATALOG_PATH = path.join(process.cwd(), "data", "catalog.json");

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;

    const raw = await readFile(CATALOG_PATH, "utf-8");
    const catalog = JSON.parse(raw);

    const course = catalog.find((c: { id: string }) => c.id === courseId);
    if (!course) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    const updated = catalog.filter((c: { id: string }) => c.id !== courseId);
    await writeFile(CATALOG_PATH, JSON.stringify(updated, null, 2), "utf-8");

    const scormDir = path.join(process.cwd(), "public", "scorm", course.packageId);
    if (existsSync(scormDir)) {
      await rm(scormDir, { recursive: true, force: true });
    }

    // Also remove from DB if present
    try {
      const { prisma } = await import("@/adapters/db");
      await prisma.course.deleteMany({ where: { id: courseId } });
    } catch { /* DB optional */ }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[delete-course]", err);
    return NextResponse.json({ error: "Failed to delete course." }, { status: 500 });
  }
}

// PATCH /api/admin/courses/[courseId] — update course title, description, categories
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const body = await req.json();
    const { title, description, categories } = body;

    const raw = await readFile(CATALOG_PATH, "utf-8");
    const catalog = JSON.parse(raw);

    const idx = catalog.findIndex((c: { id: string }) => c.id === courseId);
    if (idx === -1) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    if (title !== undefined) catalog[idx].title = title.trim();
    if (description !== undefined) catalog[idx].description = description.trim();
    if (categories !== undefined) catalog[idx].categories = Array.isArray(categories) ? categories : [];

    await writeFile(CATALOG_PATH, JSON.stringify(catalog, null, 2), "utf-8");

    // Sync to DB if present
    try {
      const { prisma } = await import("@/adapters/db");
      await prisma.course.updateMany({
        where: { id: courseId },
        data: {
          ...(title !== undefined ? { title: title.trim() } : {}),
          ...(description !== undefined ? { description: description.trim() } : {}),
          ...(categories !== undefined ? { categories: JSON.stringify(categories) } : {}),
        },
      });
    } catch { /* DB optional */ }

    return NextResponse.json({ success: true, course: catalog[idx] });
  } catch (err) {
    console.error("[patch-course]", err);
    return NextResponse.json({ error: "Failed to update course." }, { status: 500 });
  }
}
