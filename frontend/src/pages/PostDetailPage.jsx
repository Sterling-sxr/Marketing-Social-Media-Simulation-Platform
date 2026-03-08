import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { deleteJson, getJson, postJson, patchJson } from "../lib/api";
import { useApp } from "../context/AppContext";
import Feedback from "./components/Feedback";
import ConfirmDialog from "./components/ConfirmDialog";
import PostCard from "./components/PostCard";
import { hasProfanity } from "../lib/profanity";
import ProfanityHint from "./components/ProfanityHint";

export default function PostDetailPage() {
  const { courseId: courseIdParam, postId: postIdParam } = useParams();
  const courseId = Number(courseIdParam);
  const postId = Number(postIdParam);
  const navigate = useNavigate();
  const { authUser, authCheckComplete } = useApp();

  const [post, setPost] = useState(null);
  const [courseInfo, setCourseInfo] = useState(null);
  const [comments, setComments] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [likeBusy, setLikeBusy] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [commentScan, setCommentScan] = useState({ has: false, word: "" });

  const load = useCallback(async () => {
    setStatus({ loading: true, error: "" });
    try {
      const data = await getJson(`/api/courses/${courseId}/posts/${postId}/`);
      setPost(data.item || null);
      setCourseInfo(data.course || null);
      const c = await getJson(
        `/api/courses/${courseId}/posts/${postId}/comments/`
      );
      setComments(c.items || []);
      setStatus({ loading: false, error: "" });
    } catch (error) {
      setStatus({ loading: false, error: error.message || "Failed to load." });
    }
  }, [courseId, postId]);

  useEffect(() => {
    if (!authCheckComplete) return;
    if (!authUser) {
      navigate("/login", { replace: true });
      return;
    }
    load();
  }, [authUser, authCheckComplete, load, navigate]);

  const isReadOnly = Boolean(courseInfo?.read_only);
  const courseEndDate = courseInfo?.end_date || null;

  // —— Owner detection: tolerate different backend field names —— //
  const isOwner = useMemo(() => {
    if (!authUser || !post) return false;
    const uid = Number(authUser.id);

    // Direct author ID fields
    const possibleIds = [
      post.author_id,
      post?.author?.id,
      post.user_id,
      post.created_by_id,
      post.owner_id,
      post.author_user_id,
    ].filter((v) => Number.isFinite(v));

    if (possibleIds.some((v) => Number(v) === uid)) return true;

    // Fall back to username/email matching
    const meUname = String(authUser.username || "").toLowerCase();
    const meEmail = String(authUser.email || "").toLowerCase();

    const authorCandidates = [
      post?.author?.username,
      post.author_username,
      post?.author?.email,
      post.author_email,
      post?.author?.identifier,
    ]
      .filter(Boolean)
      .map((s) => String(s).toLowerCase());

    if (meUname && authorCandidates.includes(meUname)) return true;
    if (meEmail && authorCandidates.includes(meEmail)) return true;

    return false;
  }, [authUser, post]);

  const isAdminUser = useMemo(
    () => Boolean(authUser && (authUser.is_superuser || authUser.is_staff)),
    [authUser]
  );
  const canViewAnalytics = isOwner || isAdminUser;

  const handleToggleLike = async (targetPost) => {
    const working = targetPost || post;
    if (!working || likeBusy) return;
    setLikeBusy(true);
    try {
      const endpoint = `/api/courses/${courseId}/posts/${working.id}/like/`;
      const data = working.liked_by_me
        ? await deleteJson(endpoint)
        : await postJson(endpoint);
      setPost(data.item);
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        error: error.message || "Action failed.",
      }));
    } finally {
      setLikeBusy(false);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    const trimmed = (commentText || "").trim();
    if (!trimmed || commentBusy) return;

    try {
      const scan = hasProfanity?.(trimmed);
      if (scan && scan.ok === false) {
        setCommentScan({ has: true, word: scan.word || "" });
        return;
      }
    } catch {}

    setCommentBusy(true);
    try {
      const data = await postJson(
        `/api/courses/${courseId}/posts/${postId}/comments/`,
        { content: trimmed }
      );
      setComments((prev) => [...prev, data]);
      setCommentText("");
      setCommentScan({ has: false, word: "" });
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        error: error.message || "Failed to comment.",
      }));
    } finally {
      setCommentBusy(false);
    }
  };

  // —— Reuse the Donut header pattern —— //
  const HeaderBar = () => (
    <header className="border-b border-fuchsia-100/60 bg-white/70 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <button
          type="button"
          onClick={() => navigate("/studenthome")}
          aria-label="Return to home"
          className="flex items-center gap-2.5 text-xl font-bold"
        >
          <img
            src="/logo.jpg"
            alt="Donut"
            className="h-10 w-10 sm:h-11 sm:w-11 lg:h-12 lg:w-12 rounded-lg object-cover"
          />
          <span className="bg-gradient-to-r from-orange-500 via-pink-400 to-purple-500 bg-clip-text text-transparent">
            Donut
          </span>
        </button>

        <div className="flex items-center gap-5">
          <div className="flex items-center gap-3 rounded-full border border-fuchsia-200/70 bg-white/90 px-4 py-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-300 via-pink-200 to-amber-200 text-base font-semibold text-slate-800">
              {(authUser?.full_name || authUser?.username || "A")
                .charAt(0)
                .toUpperCase()}
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-800">
                {authUser?.full_name || authUser?.username || "User"}
              </p>
              <p className="text-xs text-slate-500">
                {authUser?.email || "zxxxxxxx@ad.unsw.edu.au"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate("/", { replace: true })}
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-100 to-pink-100 px-4 py-2 text-sm font-semibold text-orange-600"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M13 3a1 1 0 0 1 1 1v4h-2V5H6v14h6v-3h2v4a1 1 0 0 1-1 1H5a2 2 0 0 1 2-2V5a2 2 0 0 1 2-2h8z" />
              <path d="M21 12a1 1 0 0 0-1-1h-7v2h7a1 1 0 0 0 1-1zm-3.707-4.707-1.414 1.414L18.586 11H13v2h5.586l-2.707 2.293 1.414 1.414L22 12l-4.707-4.707z" />
            </svg>
            Logout
          </button>
        </div>
      </div>
    </header>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-fuchsia-50 via-white to-sky-100">
      <HeaderBar />

      {/* Main content */}
      <main className="mx-auto w-full max-w-6xl px-6 py-8 space-y-4">
        {/* Sticky toolbar: title + right-side actions (Analyze button is conditional) */}
        <div className="sticky top-24 z-20">
          <div className="rounded-2xl border border-orange-100 bg-white px-5 py-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-lg sm:text-xl font-semibold text-slate-900">
                Post Detail
              </h1>
              <div className="flex flex-nowrap items-center gap-3">
                {canViewAnalytics && (
                  <button
                    onClick={() =>
                      navigate(`/courses/${courseId}/posts/${postId}/analytics`)
                    }
                    className="inline-flex h-10 items-center gap-2 rounded-full border-2 bg-white px-5 text-sm font-semibold
                               text-sky-700 border-sky-400/80 transition hover:bg-sky-50 hover:shadow-md"
                    title="View analytics of this post"
                  >
                    Analyze
                  </button>
                )}

                <button
                  onClick={() => navigate(`/courses/${courseId}`)}
                  className="inline-flex h-10 items-center gap-2 rounded-full border-2 bg-white px-5 text-sm font-semibold
                             text-orange-600 border-orange-400/80 transition hover:bg-orange-50 hover:shadow-md"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                    <path
                      fill="currentColor"
                      d="M11.7 5.3 5 12l6.7 6.7 1.4-1.4L8.8 13H20v-2H8.8l4.3-4.3-1.4-1.4z"
                    />
                  </svg>
                  Back to course
                </button>

                <button
                  onClick={load}
                  disabled={status.loading}
                  className="inline-flex h-10 items-center gap-2 rounded-full border-2 bg-white px-5 text-sm font-semibold
                             text-fuchsia-700 border-fuchsia-400/80 transition hover:bg-fuchsia-50 hover:shadow-md disabled:opacity-70"
                >
                  {status.loading ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {status.error && <Feedback error={status.error} />}

        {isReadOnly && (
          <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-600">
            {courseEndDate
              ? `This course ended on ${courseEndDate}. Posts are read-only.`
              : "This course has ended. Posts are read-only."}
          </div>
        )}

        {post && (
          <div className="mt-4">
            <PostCard
              post={post}
              courseId={courseId}
              navigate={navigate}
              onToggleLike={handleToggleLike}
              likeBusyId={likeBusy && post ? post.id : null}
              readOnly={isReadOnly}
            />
          </div>
        )}

        {/* Comments */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Comments</h3>
          <ul className="divide-y divide-orange-50 rounded-2xl border border-orange-100 bg-white">
            {comments.length === 0 ? (
              <li className="p-4 text-xs text-slate-500">No comments yet.</li>
            ) : (
              comments.map((c) => (
                <li key={c.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-orange-100 text-xs font-bold text-brand">
                    {String(c.user?.name || c.user?.display_name || "?")
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-800">
                      {c.user?.name || c.user?.display_name || "Unknown"}
                    </p>
                    <p className="text-sm text-slate-700">{c.content}</p>
                    <p className="text-[11px] text-slate-400">
                      {new Date(c.created_at).toLocaleString("en-US", {
                        hour12: false,
                      })}
                    </p>
                  </div>
                </li>
              ))
            )}
          </ul>

          <form
            className="mt-2 flex w-full flex-col gap-2"
            onSubmit={handleSubmitComment}
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 rounded-full border border-orange-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand focus:outline-none"
              />
              <button
                type="submit"
                disabled={!commentText.trim() || commentBusy}
                className="rounded-full border border-orange-200 bg-white px-4 py-2 text-xs font-semibold text-brand transition hover:border-brand disabled:opacity-60"
              >
                {commentBusy ? "Sending..." : "Send"}
              </button>
            </div>

            {commentScan.has && (
              <ProfanityHint
                word={commentScan.word}
                type="comment"
                className="ml-2"
              />
            )}
          </form>
        </section>
      </main>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete Post"
        message="Are you sure you want to delete this post? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => {}}
        onCancel={() => setConfirmDeleteOpen(false)}
        processing={deleteBusy}
        tone="danger"
      />
    </div>
  );
}
