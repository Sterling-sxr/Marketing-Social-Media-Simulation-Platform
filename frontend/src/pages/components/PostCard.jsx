import React, { useEffect, useRef, useState } from "react";

const CommentIcon = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 11.5a8.5 8.5 0 0 1-12.88 7.15L3 21l2.33-6.13A8.5 8.5 0 1 1 21 11.5z" />
  </svg>
);

const HeartIcon = ({ className, filled }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20.84 4.61A5.5 5.5 0 0 0 12 7.28a5.5 5.5 0 0 0-8.84-2.67C1.4 6.23 1 9.11 3.05 11.45L12 21l8.94-9.55c2.05-2.34 1.65-5.22-.1-6.84z" />
  </svg>
);

export default function PostCard({
  post,
  courseId,
  navigate,
  onToggleLike,
  likeBusyId,
  renderContent,
  readOnly = false,
  readOnlyTooltip,
  onEdit,
  onDelete,
}) {
  const createdAt = new Date(post.created_at);
  const formattedTime = createdAt.toLocaleString("zh-CN", { hour12: false });
  const postAttachments = post.attachments || [];
  const postHashtags = post.hashtags || [];
  const isBusy = likeBusyId === post.id;
  const disableLike = readOnly || isBusy;
  const likeTooltip = readOnly
    ? readOnlyTooltip || "This course has ended. Likes are disabled."
    : undefined;
  const commentCount =
    typeof post.comments_count === "number" ? post.comments_count : 0;
  const likeCount =
    typeof post.likes_count === "number" ? post.likes_count : 0;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (event) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  const defaultRenderContent = () => {
    const text = post.content || "";
    const parts = [];
    const regex = /(@[^\s@#]+|#[^\s@#]+)/g;
    let match;
    let lastIndex = 0;
    
    // Section note: groups related logic for readability.
    const mentionMap = {};
    if (post.mentions_detail && Array.isArray(post.mentions_detail)) {
      post.mentions_detail.forEach((m) => {
        const identifier = (m.identifier || m.username || "").toLowerCase();
        if (identifier && m.id) {
          mentionMap[identifier] = m.id;
        }
      });
    }
    
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      const token = match[0];
      if (token.startsWith("@")) {
        const mentionText = token.slice(1).toLowerCase();
        const userId = mentionMap[mentionText];
        if (userId) {
          parts.push(
            <button
              key={`m-${post.id}-${match.index}`}
              type="button"
              className="text-brand hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/people/${userId}`);
              }}
            >
              {token}
            </button>
          );
        } else {
          parts.push(token);
        }
      } else if (token.startsWith("#")) {
        const tag = token.slice(1);
        parts.push(
          <button
            key={`h-${post.id}-${match.index}`}
            type="button"
            className="text-brand hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/courses/${courseId}/hashtags/${encodeURIComponent(tag)}`);
            }}
          >
            {token}
          </button>
        );
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    return parts;
  };

  const canEdit = Boolean(post?.can_edit && typeof onEdit === "function");
  const canDelete = Boolean(post?.can_delete && typeof onDelete === "function");
  const hasActions = canEdit || canDelete;

  useEffect(() => {
    if (!hasActions && menuOpen) {
      setMenuOpen(false);
    }
  }, [hasActions, menuOpen]);

  return (
    <article className="card p-4">
      <header className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-sm font-bold text-brand"
            onClick={() => navigate(`/people/${post.author.id}`)}
            title={post.author.name}
          >
            {post.author.avatar_url ? (
              <img src={post.author.avatar_url} alt={post.author.name} className="h-full w-full object-cover" />
            ) : (
              (post.author.name || "?").charAt(0).toUpperCase()
            )}
          </button>
          <div>
            <button
              type="button"
              className="text-left text-sm font-semibold text-slate-800 hover:underline"
              onClick={() => navigate(`/people/${post.author.id}`)}
            >
              {post.author.name}
            </button>
            <p className="text-xs text-slate-400">{formattedTime}</p>
          </div>
        </div>
        {hasActions ? (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className="rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500 transition hover:border-brand hover:text-brand"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((prev) => !prev);
              }}
              aria-label="Post actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              ...
            </button>
            {menuOpen ? (
              <div className="absolute right-0 z-10 mt-2 w-36 rounded-xl border border-brand-100 bg-white py-1 shadow-lg">
                {canEdit ? (
                  <button
                    type="button"
                    className="flex w-full items-center justify-start px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-brand-50 hover:text-brand"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onEdit?.(post);
                    }}
                  >
                    Edit
                  </button>
                ) : null}
                {canDelete ? (
                  <button
                    type="button"
                    className="flex w-full items-center justify-start px-4 py-2 text-xs font-semibold text-red-500 transition hover:bg-red-50 hover:text-red-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onDelete?.(post);
                    }}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </header>
      <div className="mt-2">
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">{renderContent ? renderContent(post) : defaultRenderContent()}</p>
      </div>
      {postAttachments.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {postAttachments.map((attachment) => {
            const contentType = attachment.content_type || "";
            const isImage = contentType.startsWith("image/");
            const isVideo = contentType.startsWith("video/");
            return (
              <div
                key={attachment.attachment_id || attachment.id}
                className="overflow-hidden rounded-2xl border border-brand-100 bg-brand-50"
              >
                {isImage ? (
                  <img
                    src={attachment.public_url || attachment.storage_url}
                    alt={attachment.original_name}
                    className="h-48 w-full bg-white object-contain"
                    loading="lazy"
                  />
                ) : isVideo ? (
                  <video
                    controls
                    className="h-48 w-full rounded-2xl bg-black object-contain"
                    src={attachment.public_url || attachment.storage_url}
                  />
                ) : (
                  <a
                    href={attachment.public_url || attachment.storage_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-48 w-full items-center justify-center text-sm text-brand underline"
                  >
                    View attachment: {attachment.original_name}
                  </a>
                )}
                <div className="px-3 py-2 text-xs text-slate-500">{attachment.original_name}</div>
              </div>
            );
          })}
        </div>
      ) : null}
      {postHashtags.length > 0 ? (
        <div className="flex flex-wrap gap-2 text-xs">
          {postHashtags.map((tag) => (
            <button
              key={tag}
              type="button"
              className="rounded-full bg-brand-100 px-3 py-1 font-semibold text-brand transition hover:bg-brand-200"
              onClick={() => navigate(`/courses/${courseId}/hashtags/${encodeURIComponent(tag)}`)}
            >
              #{tag}
            </button>
          ))}
        </div>
      ) : null}
      <div className="mt-3 flex items-center justify-between text-xs font-medium text-slate-500">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full px-3 py-2 transition hover:bg-brand-50"
          onClick={() => navigate(`/courses/${courseId}/posts/${post.id}`)}
        >
          <CommentIcon className="h-4 w-4 text-slate-400" />
          <span>{commentCount > 0 ? commentCount : "Comments"}</span>
        </button>
        <button
          type="button"
          className={`inline-flex items-center gap-2 rounded-full px-3 py-2 transition hover:bg-brand-50 ${
            post.liked_by_me ? "text-brand" : ""
          } ${disableLike ? "cursor-not-allowed opacity-70" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            if (disableLike) return;
            onToggleLike?.(post);
          }}
          disabled={disableLike}
          title={likeTooltip}
        >
          <HeartIcon
            className={`h-4 w-4 ${post.liked_by_me ? "text-brand" : "text-slate-400"}`}
            filled={Boolean(post.liked_by_me)}
          />
          <span>{likeCount > 0 ? likeCount : "Likes"}</span>
        </button>
      </div>
    </article>
  );
}
