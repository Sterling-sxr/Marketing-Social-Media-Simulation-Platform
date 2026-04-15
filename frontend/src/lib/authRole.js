function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

export function isTeacherRole(role) {
  const normalized = normalizeRole(role);
  return normalized === "teacher" || normalized === "instructor";
}

export function isTeacherLike(user) {
  if (!user) return false;
  const candidateRoles = [
    user.role,
    user.course_role,
    user.user_type,
    user.profile?.role,
    user.profile?.course_role,
    user.profile?.user_type,
    user.user?.role,
    user.user?.course_role,
    user.user?.user_type,
  ];
  return Boolean(
    user.is_staff ||
      user.is_superuser ||
      candidateRoles.some((role) => isTeacherRole(role))
  );
}
