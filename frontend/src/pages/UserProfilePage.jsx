// src/pages/UserProfilePage.jsx
import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getJson, postJson, deleteJson } from "../lib/api";
import AuthenticatedShell from "./components/AuthenticatedShell";
import PostCard from "./components/PostCard";
import { useApp } from "../context/AppContext";
import { Edit3 } from "lucide-react";

export default function UserProfilePage() {
  const { userId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { authUser, loadMyProfile, setAuthUser } = useApp();

  // URL tabs
  const showPostsOnly = searchParams.get("tab") === "posts";
  const showLikesOnly = searchParams.get("tab") === "likes";

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [postTab, setPostTab] = useState(showLikesOnly ? "likes" : "posts");
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [likeBusyId, setLikeBusyId] = useState(null);
  const [studentCourses, setStudentCourses] = useState([]);
  const [studentCourseStatus, setStudentCourseStatus] = useState({
    loading: false,
    error: "",
  });
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameStatus, setNameStatus] = useState({
    loading: false,
    error: "",
    message: "",
  });
  const [nameEditing, setNameEditing] = useState(false);
  const currentDisplayName = profile?.display_name || "";
  const trimmedNameDraft = (nameDraft || "").trim();
  const disableNameSave =
    nameStatus.loading || !trimmedNameDraft || trimmedNameDraft === currentDisplayName;

  const isSelf = authUser && String(authUser.id) === String(userId);
  const canViewStudentAnalytics = useMemo(() => {
    if (!authUser) return false;
    if (isSelf) return true;
    return Boolean(authUser.is_superuser || authUser.is_staff);
  }, [authUser, isSelf]);

  // page title for posts/likes pages
  const pageTitle = useMemo(() => {
    if (showLikesOnly) return "Likes";
    if (showPostsOnly) return "Posts";
    return null;
  }, [showPostsOnly, showLikesOnly]);

  // initial fetch: profile + posts/likes depending on URL
  useEffect(() => {
    let isMounted = true;
    setStatus({ loading: true, error: "" });

    const postsUrl = showLikesOnly
      ? `/api/users/${userId}/posts/?tab=likes`
      : `/api/users/${userId}/posts/`;

    Promise.all([getJson(`/api/users/${userId}/profile/`), getJson(postsUrl)])
      .then(([profileData, postsData]) => {
        if (!isMounted) return;
        setProfile(profileData);
        setPosts(postsData?.items || []);
        setStatus({ loading: false, error: "" });
      })
      .catch((error) => {
        if (!isMounted) return;
        setStatus({
          loading: false,
          error: error.message || "Failed to load user.",
        });
      });

    return () => {
      isMounted = false;
    };
  }, [userId, showLikesOnly]);

  useEffect(() => {
    if (profile) {
      setNameDraft(profile.display_name || "");
      setNameStatus({ loading: false, error: "", message: "" });
      setNameEditing(false);
    }
  }, [profile]);

  // refetch when switching internal tab on full profile page
  useEffect(() => {
    if (showPostsOnly || showLikesOnly) return;
    const endpoint =
      postTab === "likes"
        ? `/api/users/${userId}/posts/?tab=likes`
        : `/api/users/${userId}/posts/`;
    getJson(endpoint)
      .then((postsData) => setPosts(postsData?.items || []))
      .catch(() => {});
  }, [postTab, userId, showPostsOnly, showLikesOnly]);

  useEffect(() => {
    if (!canViewStudentAnalytics) return;
    let cancelled = false;
    setStudentCourseStatus((prev) => ({ ...prev, loading: true, error: "" }));
    getJson(`/api/users/${userId}/courses/`)
      .then((data) => {
        if (cancelled) return;
        setStudentCourses(data.items || []);
        setStudentCourseStatus({ loading: false, error: "" });
      })
      .catch((error) => {
        if (cancelled) return;
        setStudentCourseStatus({
          loading: false,
          error: error.message || "Failed to load courses.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [canViewStudentAnalytics, userId]);

  const renderPostContent = (post) => {
    const text = post.content || "";
    const postMentions = post.mentions_detail?.length
      ? post.mentions_detail
      : (post.mentions || []).map((v) => ({
          id: null,
          display: v,
          username: v,
        }));

    const lookup = {};
    for (const m of postMentions) {
      if (!m) continue;
      if (m.id) {
        if (m.username) lookup[(m.username || "").toLowerCase()] = m.id;
        if (m.display) lookup[(m.display || "").toLowerCase()] = m.id;
        if (m.identifier) lookup[(m.identifier || "").toLowerCase()] = m.id;
      }
    }

    const parts = [];
    const re = /(@[^\s@#]+|#[^\s@#]+)/g;
    let match,
      last = 0;
    while ((match = re.exec(text)) !== null) {
      if (match.index > last) parts.push(text.slice(last, match.index));
      const token = match[0];
      if (token.startsWith("@")) {
        const key = token.slice(1).toLowerCase();
        const id = lookup[key];
        parts.push(
          id ? (
            <button
              key={`m-${post.id}-${match.index}`}
              type="button"
              className="text-brand hover:underline"
              onClick={() => navigate(`/people/${id}`)}
            >
              {token}
            </button>
          ) : (
            token
          )
        );
      } else {
        const tag = token.slice(1);
        parts.push(
          <button
            key={`h-${post.id}-${match.index}`}
            type="button"
            className="text-brand hover:underline"
            onClick={() =>
              navigate(
                `/courses/${post.course_id}/hashtags/${encodeURIComponent(tag)}`
              )
            }
          >
            {token}
          </button>
        );
      }
      last = re.lastIndex;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts;
  };

  const handleToggleLike = async (post) => {
    if (likeBusyId === post.id) return;
    setLikeBusyId(post.id);
    try {
      const endpoint = `/api/courses/${post.course_id}/posts/${post.id}/like/`;
      const data = post.liked_by_me
        ? await deleteJson(endpoint)
        : await postJson(endpoint);
      setPosts((prev) => prev.map((p) => (p.id === post.id ? data.item : p)));
    } catch {
    } finally {
      setLikeBusyId(null);
    }
  };

  const handleSaveDisplayName = async () => {
    if (!isSelf) return;
    if (!nameEditing) return;
    const trimmed = (nameDraft || "").trim();
    if (!trimmed) {
      setNameStatus({
        loading: false,
        error: "Name cannot be empty.",
        message: "",
      });
      return;
    }
    if (profile && trimmed === (profile.display_name || "")) {
      setNameStatus({
        loading: false,
        error: "Please update the name before saving.",
        message: "",
      });
      return;
    }
    setNameStatus({ loading: true, error: "", message: "" });
    try {
      const data = await postJson("/api/profile/display-name/", {
        display_name: trimmed,
      });
      setProfile((prev) =>
        prev ? { ...prev, display_name: data.display_name } : prev
      );
      if (data?.display_name && setAuthUser) {
        setAuthUser((prev) =>
          prev
            ? {
                ...prev,
                full_name: data.display_name,
                display_name: data.display_name,
              }
            : prev
        );
      }
      setNameStatus({ loading: false, error: "", message: "Saved" });
      setNameEditing(false);
    } catch (error) {
      setNameStatus({
        loading: false,
        error: error.message || "Unable to save name.",
        message: "",
      });
    }
  };

  // ---------- posts-only / likes-only ----------
  if (showPostsOnly || showLikesOnly) {
    return (
      <AuthenticatedShell title={pageTitle} subtitle={null}>
        {/* Top actions */}
        <div className="flex items-center justify-between">
          {/* <button
            type="button"
            className="rounded-full border border-orange-200 px-3 py-1 text-xs font-semibold text-brand transition hover:border-brand"
            onClick={() => navigate("/courses")}
          >
            ← Back to Courses
          </button> */}
          {/* {isSelf && (
            <button
              type="button"
              className="rounded-full border border-orange-200 px-3 py-1 text-xs font-semibold text-brand transition hover:border-brand"
              onClick={() => navigate("/profile/edit")}
            >
              Edit Profile
            </button>
          )} */}
        </div>

        {/* Tabs: Posts / Likes */}
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-orange-50 p-1 text-xs">
          <button
            type="button"
            className={`rounded-full px-3 py-1 font-semibold ${
              !showLikesOnly ? "bg-white text-brand" : "text-slate-600"
            }`}
            onClick={() => setSearchParams({ tab: "posts" })}
          >
            Posts
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1 font-semibold ${
              showLikesOnly ? "bg-white text-brand" : "text-slate-600"
            }`}
            onClick={() => setSearchParams({ tab: "likes" })}
          >
            Likes
          </button>
        </div>

        {/* List */}
        {status.loading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : status.error ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {status.error}
          </p>
        ) : (
          <section className="space-y-3">
            <ul className="space-y-3">
              {posts.length === 0 ? (
                <li className="text-xs text-slate-500">No data yet.</li>
              ) : (
                posts.map((post) => (
                  <li key={post.id}>
                    <PostCard
                      post={post}
                      courseId={post.course_id}
                      navigate={navigate}
                      onToggleLike={handleToggleLike}
                      likeBusyId={likeBusyId}
                      renderContent={renderPostContent}
                    />
                  </li>
                ))
              )}
            </ul>
          </section>
        )}
      </AuthenticatedShell>
    );
  }

  // ---------- full profile ----------
  return (
    <AuthenticatedShell title={null} subtitle={null}>
      <div className="flex items-center justify-between">{/* spacer */}</div>

      {profile && (
        <div className="mt-4 flex items-center gap-4">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-orange-100 text-lg font-bold text-brand">
              {profile.profile?.avatar_url ? (
                <img
                  src={profile.profile.avatar_url}
                  alt={profile.display_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                (profile.display_name || "?").charAt(0).toUpperCase()
              )}
            </div>

            {isSelf && (
              <label className="absolute -bottom-1 -right-1 inline-flex cursor-pointer items-center rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-brand shadow">
                {avatarUploading ? "Uploading..." : "Change"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setAvatarUploading(true);
                    try {
                      const form = new FormData();
                      form.append("file", file);
                      const res = await fetch("/api/messages/files/", {
                        method: "POST",
                        body: form,
                        credentials: "include",
                      });
                      const data = await res.json();
                      if (!res.ok)
                        throw new Error(data?.error || "Upload failed");
                      const publicUrl = data.public_url || data.storage_url;

                      await fetch("/api/profile/avatar/", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ avatar_url: publicUrl }),
                      });

                      const refreshed = await getJson(
                        `/api/users/${userId}/profile/`
                      );
                      setProfile(refreshed);
                      if (isSelf && refreshed?.profile?.avatar_url) {
                        await loadMyProfile().catch(() => {});
                        setAuthUser((prev) => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            avatar_url: refreshed.profile.avatar_url,
                            profile: {
                              ...(prev.profile || {}),
                              avatar_url: refreshed.profile.avatar_url,
                            },
                          };
                        });
                      }
                    } catch {
                    } finally {
                      setAvatarUploading(false);
                    }
                  }}
                />
              </label>
            )}
          </div>

          <div>
            <p className="text-lg font-semibold text-slate-900">
              {profile.display_name}
            </p>
            <p className="text-xs text-slate-500">@{profile.username}</p>

            <div className="mt-2 inline-flex items-center gap-4 text-xs text-slate-600">
              <button
                type="button"
                className="hover:underline"
                onClick={() =>
                  navigate(`/people/${userId}/follows?tab=following`)
                }
              >
                Following {profile.following_count || 0}
              </button>
              <button
                type="button"
                className="hover:underline"
                onClick={() =>
                  navigate(`/people/${userId}/follows?tab=followers`)
                }
              >
                Followers {profile.followers_count || 0}
              </button>
            </div>

            {canViewStudentAnalytics ? (
              <div className="mt-3 flex flex-col gap-2 text-xs">
                <button
                  type="button"
                  className="inline-flex w-fit items-center gap-2 rounded-full border border-orange-200 bg-white px-3 py-1 font-semibold text-brand transition hover:border-brand"
                  disabled={studentCourseStatus.loading || studentCourses.length === 0}
                  onClick={() => setShowCourseModal(true)}
                >
                  {studentCourseStatus.loading
                    ? "Loading analytics..."
                    : studentCourses.length === 0
                    ? "No courses to analyse"
                    : "View course analytics"}
                </button>
                {studentCourseStatus.error ? (
                  <span className="text-red-500">{studentCourseStatus.error}</span>
                ) : null}
              </div>
            ) : null}

            {!isSelf && (
              <div className="mt-2">
                <button
                  type="button"
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    profile.is_following
                      ? "border-brand bg-orange-100 text-brand"
                      : "border-orange-200 text-slate-600 hover:border-brand hover:text-brand"
                  }`}
                  disabled={followBusy}
                  onClick={async () => {
                    setFollowBusy(true);
                    try {
                      if (profile.is_following) {
                        await deleteJson(`/api/users/${userId}/follow/`);
                        setProfile((p) => ({
                          ...p,
                          is_following: false,
                          followers_count: Math.max(
                            0,
                            (p.followers_count || 0) - 1
                          ),
                        }));
                      } else {
                        await postJson(`/api/users/${userId}/follow/`, {});
                        setProfile((p) => ({
                          ...p,
                          is_following: true,
                          followers_count: (p.followers_count || 0) + 1,
                        }));
                      }
                    } catch {
                    } finally {
                      setFollowBusy(false);
                    }
                  }}
                >
                  <span>
                    {followBusy
                      ? "Updating..."
                      : profile.is_following
                      ? "Following"
                      : "Follow"}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {status.loading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : status.error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {status.error}
        </p>
      ) : profile ? (
        <div className="space-y-5">
          <section className="rounded-3xl border border-orange-100 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800">
              Account details
            </h3>
            <div className="mt-3 space-y-3">
              <div className="rounded-2xl border border-orange-50 bg-orange-50/30 px-3 py-2">
                <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <span>Name</span>
                  {isSelf && (
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-md bg-white/0 text-slate-400 transition hover:text-brand"
                      onClick={() => {
                        setNameDraft(profile.display_name || "");
                        setNameEditing(true);
                      }}
                      aria-label="Edit name"
                    >
                      <Edit3 size={18} strokeWidth={2.2} />
                    </button>
                  )}
                </div>
                <p className="text-sm text-slate-800">
                  {profile.display_name || "—"}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-orange-50 bg-orange-50/30 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Email
                  </p>
                  <p className="text-sm text-slate-800">{profile.email || "—"}</p>
                </div>
                <div className="rounded-2xl border border-orange-50 bg-orange-50/30 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Institution
                  </p>
                  <p className="text-sm text-slate-800">
                    {profile.institution || "—"}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {nameEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-md rounded-3xl border border-orange-100 bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-800">
              Update display name
            </h3>
            <p className="text-xs text-slate-500">
              This name appears on your posts and profile.
            </p>
            <div className="mt-4 space-y-3">
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="w-full rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                placeholder="Enter your name"
                autoFocus
              />
              {nameStatus.error ? (
                <p className="text-xs text-red-600">{nameStatus.error}</p>
              ) : nameStatus.message ? (
                <p className="text-xs text-emerald-600">{nameStatus.message}</p>
              ) : null}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <button
                  type="button"
                  className="rounded-full border border-orange-200 px-4 py-1.5 font-semibold text-brand transition hover:border-brand disabled:opacity-60"
                  onClick={handleSaveDisplayName}
                  disabled={disableNameSave}
                >
                  {nameStatus.loading ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-4 py-1.5 font-semibold text-slate-500 transition hover:border-slate-300"
                  onClick={() => {
                    setNameDraft(profile?.display_name || "");
                    setNameEditing(false);
                    setNameStatus({ loading: false, error: "", message: "" });
                  }}
                  disabled={nameStatus.loading}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCourseModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[80vh] w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-orange-100 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">
                  Select a course
                </h3>
                <p className="text-xs text-slate-500">
                  Choose a course to view this student's analytics.
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-orange-200 px-3 py-1 text-xs font-semibold text-slate-500 transition hover:border-brand hover:text-brand"
                onClick={() => setShowCourseModal(false)}
              >
                Close
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {studentCourseStatus.loading ? (
                <p className="px-5 py-4 text-sm text-slate-500">
                  Loading courses...
                </p>
              ) : studentCourses.length === 0 ? (
                <p className="px-5 py-4 text-sm text-slate-500">
                  No courses available for analytics.
                </p>
              ) : (
                <ul className="divide-y divide-orange-50">
                  {studentCourses.map((course) => (
                    <li key={course.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-orange-50"
                        onClick={() => {
                          setShowCourseModal(false);
                          navigate(
                            `/dashboard/courses/${course.id}/students/${userId}`
                          );
                        }}
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {course.course_code} · {course.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {course.term} · Role: {course.role}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </AuthenticatedShell>
  );
}
