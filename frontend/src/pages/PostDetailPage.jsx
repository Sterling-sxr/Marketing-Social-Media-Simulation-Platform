import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { deleteJson, getJson, postJson } from "../lib/api";
import { useApp } from "../context/AppContext";
import Feedback from "./components/Feedback";
import ConfirmDialog from "./components/ConfirmDialog";
import PostCard from "./components/PostCard";
import { hasProfanity } from "../lib/profanity";
import ProfanityHint from "./components/ProfanityHint";
import AuthenticatedShell from "./components/AuthenticatedShell";

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

  // Context: Compute shared values once so all branches use the same normalized inputs.
  const isOwner = useMemo(() => {
    if (!authUser || !post) return false;
    const uid = Number(authUser.id);

    // Context: Compute shared values once so all branches use the same normalized inputs.
    const possibleIds = [
      post.author_id,
      post?.author?.id,
      post.user_id,
      post.created_by_id,
      post.owner_id,
      post.author_user_id,
    ].filter((v) => Number.isFinite(v));

    if (possibleIds.some((v) => Number(v) === uid)) return true;

    // Context: Compute shared values once so all branches use the same normalized inputs.
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

  return (
    <AuthenticatedShell
      title="Post Detail"
      subtitle={
        courseInfo
          ? `${courseInfo.course_code || ""} · ${courseInfo.name || ""}`.trim()
          : "Post Detail"
      }
    >
      {/* Context: Keep related UI rendering and event handlers together for predictable updates. Reason: Grouping this logic makes interaction flows easier to debug and extend. */}
      <main className="space-y-4">
        {/* Context: Keep related UI rendering and event handlers together for predictable updates. Reason: Grouping this logic makes interaction flows easier to debug and extend. */}
        <div className="z-20">
          <div className="rounded-2xl border border-brand-100 bg-white px-3 py-3 shadow-sm sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <h1 className="text-lg sm:text-xl font-semibold text-slate-900">
                Post Detail
              </h1>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {canViewAnalytics && (
                  <button
                    onClick={() =>
                      navigate(`/courses/${courseId}/posts/${postId}/analytics`)
                    }
                    className="inline-flex h-9 items-center gap-2 rounded-full border-2 bg-white px-4 text-xs font-semibold
                               text-accent-700 border-accent-400/80 transition hover:bg-accent-50 hover:shadow-md sm:h-10 sm:px-5 sm:text-sm
                               text-accent-700 border-accent-400/80 transition hover:bg-accent-50 hover:shadow-md"
                    title="View post analysis"
                  >
                    View Post Analysis
                  </button>
                )}

                <button
                  onClick={() => navigate(`/courses/${courseId}`)}
                  className="inline-flex h-9 items-center gap-2 rounded-full border-2 bg-white px-4 text-xs font-semibold
                             text-brand-600 border-brand-400/80 transition hover:bg-brand-50 hover:shadow-md sm:h-10 sm:px-5 sm:text-sm
                             text-brand-600 border-brand-400/80 transition hover:bg-brand-50 hover:shadow-md"
                  aria-label="Back to course"
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
                  className="inline-flex h-9 items-center gap-2 rounded-full border-2 bg-white px-4 text-xs font-semibold
                             text-accent-700 border-accent-400/80 transition hover:bg-accent-50 hover:shadow-md disabled:opacity-70 sm:h-10 sm:px-5 sm:text-sm
                             text-accent-700 border-accent-400/80 transition hover:bg-accent-50 hover:shadow-md disabled:opacity-70"
                  aria-label="Refresh post detail"
                >
                  {status.loading ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {status.error && <Feedback error={status.error} />}

        {isReadOnly && (
          <div className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-600">
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

        {/* Context: Keep related UI rendering and event handlers together for predictable updates. Reason: Grouping this logic makes interaction flows easier to debug and extend. */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Comments</h3>
          <ul className="divide-y divide-brand-50 rounded-2xl border border-brand-100 bg-white">
            {comments.length === 0 ? (
              <li className="p-4 text-xs text-slate-500">No comments yet.</li>
            ) : (
              comments.map((c) => (
                <li key={c.id} className="flex items-start gap-2 px-3 py-3 sm:gap-3 sm:px-4">
                  <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-xs font-bold text-brand">
                    {String(c.user?.name || c.user?.display_name || "?")
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-xs font-semibold text-slate-800">
                      {c.user?.name || c.user?.display_name || "Unknown"}
                    </p>
                    <p className="break-words [overflow-wrap:anywhere] text-sm text-slate-700">
                      {c.content}
                    </p>
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

          <form className="mt-2 hidden w-full flex-col gap-2 sm:flex" onSubmit={handleSubmitComment}>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 rounded-full border border-brand-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand focus:outline-none"
              />
              <button
                type="submit"
                disabled={!commentText.trim() || commentBusy}
                className="rounded-full border border-brand-200 bg-white px-4 py-2 text-xs font-semibold text-brand transition hover:border-brand disabled:opacity-60"
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

      <form
        className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-100 bg-white/95 px-3 py-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] shadow-[0_-10px_24px_rgba(148,163,184,0.16)] backdrop-blur sm:hidden"
        onSubmit={handleSubmitComment}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Write a comment..."
            className="flex-1 rounded-full border border-brand-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand focus:outline-none"
            aria-label="Write a comment"
          />
          <button
            type="submit"
            disabled={!commentText.trim() || commentBusy}
            className="rounded-full border border-brand-200 bg-white px-4 py-2 text-xs font-semibold text-brand transition hover:border-brand disabled:opacity-60"
            aria-label="Send comment"
          >
            {commentBusy ? "Sending..." : "Send"}
          </button>
        </div>
        {commentScan.has ? (
          <ProfanityHint word={commentScan.word} type="comment" className="ml-1 mt-1" />
        ) : null}
      </form>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete Post"
        message="Are you sure you want to delete this post? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => {}}
        onCancel={() => setConfirmDeleteOpen(false)}
        processing={false}
        tone="danger"
      />
    </AuthenticatedShell>
  );
}
