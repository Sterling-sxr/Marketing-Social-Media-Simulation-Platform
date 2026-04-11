function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

export function isTeacherRole(role) {
  const normalized = normalizeRole(role);
  return normalized === "teacher" || normalized === "instructor";
}

export function isTeacherLike(user) {
  if (!user) return false;
  return Boolean(
    user.is_staff || user.is_superuser || isTeacherRole(user.role)
  );
}
