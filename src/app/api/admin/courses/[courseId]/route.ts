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

    // Remove from catalog
    const updated = catalog.filter((c: { id: string }) => c.id !== courseId);
    await writeFile(CATALOG_PATH, JSON.stringify(updated, null, 2), "utf-8");

    // Remove extracted SCORM files from disk
    const scormDir = path.join(process.cwd(), "public", "scorm", course.packageId);
    if (existsSync(scormDir)) {
      await rm(scormDir, { recursive: true, force: true });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[delete-course]", err);
    return NextResponse.json({ error: "Failed to delete course." }, { status: 500 });
  }
}
