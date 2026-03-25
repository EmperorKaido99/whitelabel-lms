import CatalogClient from "./CatalogClient";
import { type CatalogCourse } from "./CourseCard";

async function getCatalog(): Promise<CatalogCourse[]> {
  try {
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const raw = await readFile(join(process.cwd(), "data", "catalog.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export default async function CatalogPage() {
  const courses = await getCatalog();
  return <CatalogClient courses={courses} />;
}
