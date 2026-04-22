export function isTeacher(user) {
  return Boolean(user?.is_superuser || user?.is_staff);
}

export function getDefaultLandingPath(user) {
  return "/courses";
}

export function canViewDashboard(user) {
  return isTeacher(user);
}

export function canManageCourse(user, course) {
  if (isTeacher(user)) return true;
  if (!course) return false;
  return course.role === "teacher";
}
