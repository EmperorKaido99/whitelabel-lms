import { notFound } from "next/navigation";
import ScormPlayer from "./ScormPlayer";

interface CatalogCourse {
  id: string;
  packageId: string;
  title: string;
  entryPoint: string;
  version: string;
  fileCount: number;
  publishedAt: string;
}

async function getCourse(id: string): Promise<CatalogCourse | null> {
  try {
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const raw = await readFile(join(process.cwd(), "data", "catalog.json"), "utf-8");
    const courses: CatalogCourse[] = JSON.parse(raw);
    return courses.find((c) => c.id === id) ?? null;
  } catch {
    return null;
  }
}

export default async function CoursePlayerPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const course = await getCourse(courseId);

  if (!course) {
    notFound();
  }

  const scormUrl = `/scorm/${course.packageId}/${course.entryPoint}`;

  return <ScormPlayer course={course} scormUrl={scormUrl} />;
}
