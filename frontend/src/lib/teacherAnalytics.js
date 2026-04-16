import { getJson } from "./api";

function toNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function normalizeCourseMeta(course, fallback = {}) {
  return {
    id: course?.id ?? fallback.id ?? null,
    name: course?.name ?? fallback.name ?? "",
    course_code: course?.course_code ?? fallback.course_code ?? "",
    term: course?.term ?? fallback.term ?? "",
    role: fallback.role ?? course?.role ?? "",
    active:
      typeof course?.active === "boolean"
        ? course.active
        : typeof fallback.active === "boolean"
        ? fallback.active
        : null,
  };
}

function normalizeSentiment(sentiment) {
  const breakdown = sentiment?.breakdown || sentiment || {};
  const normalizedBreakdown = {
    positive: toNumber(breakdown.positive),
    neutral: toNumber(breakdown.neutral),
    negative: toNumber(breakdown.negative),
  };
  const totalComments =
    sentiment?.total_comments ??
    Object.values(normalizedBreakdown).reduce((sum, value) => sum + value, 0);
  const topLabel =
    sentiment?.top_label ||
    Object.entries(normalizedBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    "neutral";
  const topPercent =
    sentiment?.top_percent ?? normalizedBreakdown[topLabel] ?? 0;

  return {
    top_label: topLabel,
    top_percent: toNumber(topPercent),
    total_comments: toNumber(totalComments),
    breakdown: normalizedBreakdown,
  };
}

function normalizePost(post, index = 0) {
  return {
    post_id: post?.post_id ?? post?.id ?? `post-${index}`,
    author_id: post?.author_id ?? null,
    author_name: post?.author_name ?? post?.author ?? "",
    preview: post?.preview ?? post?.content_preview ?? post?.content ?? "",
    likes: toNumber(post?.likes ?? post?.total_likes),
    comments: toNumber(post?.comments ?? post?.total_comments),
    views: toNumber(post?.views ?? post?.total_views),
    interactions: toNumber(
      post?.interactions ?? post?.total_interactions,
      toNumber(post?.likes ?? post?.total_likes) +
        toNumber(post?.comments ?? post?.total_comments)
    ),
    created_at: post?.created_at ?? null,
  };
}

function normalizeHashtag(item, index = 0) {
  return {
    hashtag: item?.hashtag ?? item?.tag ?? `hashtag-${index}`,
    total_posts: toNumber(item?.total_posts),
    total_interactions: toNumber(item?.total_interactions),
    change_percent: toNumber(item?.change_percent),
    sentiment: normalizeSentiment(item?.sentiment),
  };
}

function normalizeStudent(item, index = 0) {
  return {
    user_id: item?.user_id ?? item?.student_id ?? item?.id ?? `student-${index}`,
    name: item?.name ?? item?.student_name ?? item?.display_name ?? "Unknown student",
    posts_total: toNumber(item?.posts_total ?? item?.total_posts),
    interactions_total: toNumber(
      item?.interactions_total ?? item?.total_interactions
    ),
    change_percent: toNumber(item?.change_percent),
    sentiment: normalizeSentiment(item?.sentiment),
  };
}

function buildMeta(data) {
  const refreshing = Boolean(data?.refreshing);
  return {
    refreshing,
    calculatedAt: data?.calculated_at ?? null,
    sourceKind: refreshing ? "fallback" : "backend",
    sourceLabel: refreshing ? "Fallback placeholder" : "Backend snapshot",
  };
}

export function normalizeCourseDashboardPayload(payload, fallbackCourse = {}) {
  const data = payload?.course || payload || {};
  const meta = buildMeta(data);

  return {
    ...data,
    meta,
    course: normalizeCourseMeta(data?.course, fallbackCourse),
    summary: {
      total_posts: toNumber(data?.summary?.total_posts),
      total_interactions: toNumber(data?.summary?.total_interactions),
      registered_students: toNumber(data?.summary?.registered_students),
    },
    sentiment: normalizeSentiment(data?.sentiment),
    hashtags: Array.isArray(data?.hashtags)
      ? data.hashtags.map((item, index) => normalizeHashtag(item, index))
      : [],
    students: Array.isArray(data?.students)
      ? data.students.map((item, index) => normalizeStudent(item, index))
      : [],
  };
}

export function normalizeHashtagDashboardPayload(payload, fallbackCourse = {}) {
  const data = payload?.hashtag || payload || {};
  const meta = buildMeta(data);

  return {
    ...data,
    meta,
    course: normalizeCourseMeta(data?.course, fallbackCourse),
    hashtag: data?.hashtag ?? "",
    summary: {
      total_posts: toNumber(data?.summary?.total_posts),
      total_likes: toNumber(data?.summary?.total_likes),
      total_comments: toNumber(data?.summary?.total_comments),
      total_views: toNumber(data?.summary?.total_views),
      total_interactions: toNumber(data?.summary?.total_interactions),
    },
    sentiment: normalizeSentiment(data?.sentiment),
    top_posts: Array.isArray(data?.top_posts)
      ? data.top_posts.map((item, index) => normalizePost(item, index))
      : [],
  };
}

export function normalizeStudentDashboardPayload(payload, fallbackCourse = {}) {
  const data = payload?.student || payload || {};
  const meta = buildMeta(data);

  return {
    ...data,
    meta,
    course: normalizeCourseMeta(data?.course, fallbackCourse),
    student: {
      id: data?.student?.id ?? null,
      name: data?.student?.name ?? data?.student?.display_name ?? "",
      email: data?.student?.email ?? "",
    },
    summary: {
      total_posts: toNumber(data?.summary?.total_posts),
      total_likes: toNumber(data?.summary?.total_likes),
      total_comments: toNumber(data?.summary?.total_comments),
      total_views: toNumber(data?.summary?.total_views),
      total_interactions: toNumber(data?.summary?.total_interactions),
    },
    sentiment: normalizeSentiment(data?.sentiment),
    top_posts: Array.isArray(data?.top_posts)
      ? data.top_posts.map((item, index) => normalizePost(item, index))
      : [],
  };
}

export async function fetchCourseDashboard(courseId, fallbackCourse = {}) {
  const payload = await getJson(`/api/admin/dashboard/courses/${courseId}/`);
  return normalizeCourseDashboardPayload(payload, fallbackCourse);
}

export async function fetchHashtagDashboard(courseId, hashtag, fallbackCourse = {}) {
  const encoded = encodeURIComponent(hashtag);
  const payload = await getJson(`/api/admin/dashboard/courses/${courseId}/hashtags/${encoded}/`);
  return normalizeHashtagDashboardPayload(payload, fallbackCourse);
}

export async function fetchStudentDashboard(courseId, studentId, fallbackCourse = {}) {
  const payload = await getJson(`/api/admin/dashboard/courses/${courseId}/students/${studentId}/`);
  return normalizeStudentDashboardPayload(payload, fallbackCourse);
}
