import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const CATALOG_PATH = path.join(process.cwd(), "data", "catalog.json");

export async function GET() {
  try {
    const raw = await readFile(CATALOG_PATH, "utf-8");
    const courses = JSON.parse(raw);
    return NextResponse.json(courses);
  } catch {
    return NextResponse.json([]);
  }
}
