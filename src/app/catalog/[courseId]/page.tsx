import { notFound } from "next/navigation";
import ScormPlayer from "./ScormPlayer";
import LockedCoursePage from "./LockedCoursePage";

interface CatalogCourse {
  id: string;
  packageId: string;
  title: string;
  entryPoint: string;
  version: string;
  fileCount: number;
  publishedAt: string;
  prerequisites?: string[];
}

interface CourseModule {
  id: string;
  order: number;
  type: string;
  content: string; // JSON string: { packageId, entryPoint, version, title }
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

async function checkPrerequisites(
  userId: string,
  tenantId: string,
  prereqIds: string[],
  allCourses: CatalogCourse[]
): Promise<{ id: string; title: string }[]> {
  if (prereqIds.length === 0) return [];
  const { prisma } = await import("@/adapters/db");
  const completed = await prisma.enrollment.findMany({
    where: { userId, tenantId, courseId: { in: prereqIds }, status: "completed" },
    select: { courseId: true },
  });
  const completedIds = new Set(completed.map(e => e.courseId));
  return prereqIds
    .filter(id => !completedIds.has(id))
    .map(id => ({ id, title: allCourses.find(c => c.id === id)?.title ?? id }));
}

export default async function CoursePlayerPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;

  // Load all courses so we can resolve prerequisite titles
  let allCourses: CatalogCourse[] = [];
  try {
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const raw = await readFile(join(process.cwd(), "data", "catalog.json"), "utf-8");
    allCourses = JSON.parse(raw);
  } catch { /* empty */ }

  const course = allCourses.find(c => c.id === courseId) ?? null;
  if (!course) notFound();

  // Check prerequisites for logged-in users
  const prereqs = course.prerequisites ?? [];
  if (prereqs.length > 0) {
    try {
      const { auth } = await import("@/lib/auth/config");
      const session = await auth();
      if (session?.user?.id) {
        const tenantId = (session.user as { tenantId?: string }).tenantId ?? "";
        const unmet = await checkPrerequisites(session.user.id, tenantId, prereqs, allCourses);
        if (unmet.length > 0) {
          return <LockedCoursePage courseTitle={course.title} unmetPrereqs={unmet} />;
        }
      }
    } catch { /* auth optional */ }
  }

  // Load modules from DB for this course (used for multi-module navigation)
  let modules: CourseModule[] = [];
  try {
    const { prisma } = await import("@/adapters/db");
    const { auth } = await import("@/lib/auth/config");
    const session = await auth();
    const tenantId = (session?.user as { tenantId?: string })?.tenantId;
    if (tenantId) {
      modules = await prisma.module.findMany({
        where: { courseId, tenantId },
        orderBy: { order: "asc" },
      });
    }
  } catch { /* modules optional */ }

  const scormUrl = `/scorm/${course.packageId}/${course.entryPoint}`;
  return <ScormPlayer course={course} scormUrl={scormUrl} modules={modules} />;
}
