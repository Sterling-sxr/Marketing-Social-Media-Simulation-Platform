export function resolveCourseScopedTarget(courses = []) {
  if (!Array.isArray(courses) || courses.length === 0) {
    return { state: "empty", courseId: null };
  }
  if (courses.length === 1) {
    return { state: "single", courseId: courses[0]?.id ?? null };
  }
  return { state: "multi", courseId: null };
}
