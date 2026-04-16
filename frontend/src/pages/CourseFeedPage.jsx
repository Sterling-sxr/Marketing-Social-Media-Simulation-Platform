import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../context/AppContext";
import {
  deleteJson,
  getJson,
  postJson,
  patchJson,
  uploadFile,
} from "../lib/api";
import PostCard from "./components/PostCard";
import ConfirmDialog from "./components/ConfirmDialog";
import Feedback from "./components/Feedback";
import { hasProfanity } from "../lib/profanity";
import ProfanityHint from "./components/ProfanityHint";

/** 
 * Initial state for composer feedback.
 * It stores loading state, error text, and success message.
 */
const initialComposerStatus = { loading: false, error: "", message: "" };

/** 
 * Initial state for upload feedback.
 * It is used when uploading attachments.
 */
const initialUploadStatus = { loading: false, error: "", message: "" };

/** 
 * Maximum number of attachments allowed in one post.
 */
const MAX_ATTACHMENTS = 4;

/** 
 * Preset emoji options for quick insert.
 */
const emojiPalette = ["😀", "🎉", "🔥", "👏", "🤔", "❤️"];

/** 
 * Initial state for suggestion dropdown.
 * It stores items, loading state, and error text.
 */
const initialSuggestionsState = { items: [], loading: false, error: "" };

/** 
 * Delay for mention and hashtag suggestion requests.
 * This helps reduce too many API calls while typing.
 */
const SUGGESTION_DEBOUNCE_MS = 180;

/** 
 * Used to decide where a word ends.
 * It helps detect whether typing is still inside a mention or hashtag.
 */
const WORD_BOUNDARY_REGEX = /[\s.,!?()[\]{}"']/;

/** 
 * Used to check whether the character before @ or # is part of a word.
 * If it is, then the trigger should not be activated.
 */
const WORD_CHAR_REGEX = /[A-Za-z0-9_]/;

/**
 * Detect whether the current cursor position is inside a mention or hashtag trigger.
 * Return null if no valid trigger is found.
 * Return an object if a trigger is found.
 */
function findTrigger(value, caret) {
  if (!value || caret < 0) return null;

  let i = caret - 1;

  while (i >= 0) {
    const char = value[i];

    if (char === "@" || char === "#") {
      const triggerChar = char;
      const prevChar = i > 0 ? value[i - 1] : " ";

      // If the trigger is attached to a normal word character,
      // do not treat it as a valid trigger.
      if (i > 0 && WORD_CHAR_REGEX.test(prevChar)) return null;

      const query = value.slice(i + 1, caret);

      return {
        type: triggerChar === "@" ? "mention" : "hashtag",
        trigger: triggerChar,
        start: i,
        query,
      };
    }

    // Stop searching if a boundary character is found.
    if (
      WORD_BOUNDARY_REGEX.test(char) ||
      char === "\n" ||
      char === "\r" ||
      char === "\t"
    )
      break;

    i -= 1;
  }

  return null;
}

/**
 * Build avatar display data from a user object.
 * Fallback to initials if there is no image.
 */
function useAvatar(user) {
  if (!user) return { initials: "?", displayName: "un login", photoUrl: "" };

  const photoUrl =
    user?.avatar_url || user?.profile?.avatar_url || user?.avatar || "";

  const displayName =
    user?.full_name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() ||
    user?.nickname ||
    user?.username ||
    user?.email ||
    `user${user?.id ?? ""}`;

  const initials = displayName ? displayName.charAt(0).toUpperCase() : "?";

  return { initials, displayName, photoUrl };
}

/**
 * Main page component for the course feed.
 * It controls feed loading, filtering, composer, suggestions, profile modal,
 * post editing, deleting, liking, and mobile filter UI.
 */
export default function CourseFeedPage() {
  /**
   * Read route params from URL.
   * courseIdParam comes from the route.
   * routeHashtagParam is used when browsing a hashtag page.
   */
  const { courseId: courseIdParam, hashtag: routeHashtagParam } = useParams();

  /**
   * Convert route course id to number.
   */
  const courseId = Number(courseIdParam);

  /**
   * Router helpers.
   * navigate is used for page jump.
   * location is used to read query string and current path.
   */
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * Global app context values.
   * authUser stores current logged-in user.
   * authCheckComplete tells whether auth checking finished.
   * courses stores joined courses.
   * fetchCourses refreshes course list.
   * logout logs the user out.
   * loadCourseProfile loads course-specific profile data.
   */
  const {
    authUser,
    authCheckComplete,
    courses,
    fetchCourses,
    logout,
    loadCourseProfile,
  } = useApp();

  /**
   * Read query string.
   * Used for the "following" tab state.
   */
  const searchParams = new URLSearchParams(location.search);
  const followingFromUrl = searchParams.get("tab") === "following";

  /**
   * Local keyword filter for posts.
   * This only filters current feed items on the client side.
   */
  const [keyword, setKeyword] = useState("");

  /**
   * Current left filter state.
   * It can be:
   * all
   * tag
   * following
   */
  const [leftFilter, setLeftFilter] = useState(() =>
    followingFromUrl
      ? { type: "following" }
      : routeHashtagParam
      ? {
          type: "tag",
          tag: decodeURIComponent(routeHashtagParam).toLowerCase(),
        }
      : { type: "all" }
  );

  /**
   * Tag list and loading state for tag section.
   */
  const [tags, setTags] = useState([]);
  const [tagsStatus, setTagsStatus] = useState({ loading: false, error: "" });

  /**
   * Feed items and feed loading state.
   */
  const [feedItems, setFeedItems] = useState([]);
  const [feedStatus, setFeedStatus] = useState({ loading: true, error: "" });

  /**
   * Course summary returned by feed API.
   * Used to build title and subtitle.
   */
  const [courseSummary, setCourseSummary] = useState(null);

  /**
   * Composer states.
   * showComposer controls modal display.
   * composerContent stores textarea text.
   * composerStatus stores submit status.
   * attachments stores uploaded files.
   * uploadStatus stores attachment upload status.
   */
  const [showComposer, setShowComposer] = useState(false);
  const [composerContent, setComposerContent] = useState("");
  const [composerStatus, setComposerStatus] = useState(initialComposerStatus);
  const [attachments, setAttachments] = useState([]);
  const [uploadStatus, setUploadStatus] = useState(initialUploadStatus);

  /**
   * profanityMsg stores warning message for offensive content.
   */
  const [profanityMsg, setProfanityMsg] = useState("");

  /**
   * likeBusyId stores the post id currently processing like/unlike.
   */
  const [likeBusyId, setLikeBusyId] = useState(null);

  /**
   * deleteState controls the delete confirmation dialog.
   */
  const [deleteState, setDeleteState] = useState({ open: false, post: null });

  /**
   * deleteBusy prevents duplicate delete operations.
   */
  const [deleteBusy, setDeleteBusy] = useState(false);

  /**
   * profileModal controls the course profile popup.
   */
  const [profileModal, setProfileModal] = useState({
    open: false,
    loading: false,
    profile: null,
    error: "",
  });

  /**
   * mobileFilterOpen controls the mobile side drawer.
   */
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  /**
   * editingPost stores the post being edited.
   * If null, composer is in create mode.
   */
  const [editingPost, setEditingPost] = useState(null);

  /**
   * isEditing is true when editingPost exists.
   */
  const isEditing = Boolean(editingPost);

  /**
   * Refs for file input and textarea.
   * fileInputRef is used to open file picker.
   * textareaRef is used to manage cursor and focus.
   */
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  /**
   * Suggestion states for mention and hashtag completion.
   * activeTrigger stores current trigger info.
   * suggestionsState stores matched items.
   * highlightIndex stores current highlighted suggestion.
   * fetchSeqRef helps ignore old async responses.
   * mentionSelections stores selected mention metadata.
   */
  const [activeTrigger, setActiveTrigger] = useState(null);
  const [suggestionsState, setSuggestionsState] = useState(
    initialSuggestionsState
  );
  const [highlightIndex, setHighlightIndex] = useState(0);
  const fetchSeqRef = useRef(0);
  const [mentionSelections, setMentionSelections] = useState({});

  /**
   * Reset composer status to its default state.
   */
  const resetComposerStatus = useCallback(
    () => setComposerStatus({ ...initialComposerStatus }),
    []
  );

  /**
   * Find current course info from joined courses.
   * useMemo is used to avoid recalculating unnecessarily.
   */
  const contextCourse = useMemo(() => {
    if (!Number.isFinite(courseId)) return null;
    return courses.joined.find((c) => c.id === courseId) || null;
  }, [courses.joined, courseId]);

  /**
   * Decide which course info should be shown in the header.
   * courseSummary has priority if loaded from API.
   * Otherwise use contextCourse from global state.
   */
  const headerCourse = courseSummary || contextCourse;

  /**
   * True if course is read-only.
   */
  const courseReadOnly = Boolean(headerCourse?.read_only);

  /**
   * Course end date.
   */
  const courseEndDate = headerCourse?.end_date || null;

  /**
   * Build page title.
   */
  const pageTitle = headerCourse
    ? `${headerCourse.course_code} · ${headerCourse.name}`
    : "Course Dynamics";

  /**
   * Build page subtitle.
   * It may include term, ended state, end date, and active filter info.
   */
  const subtitleParts = [];
  if (headerCourse) {
    if (headerCourse.term) subtitleParts.push(`${headerCourse.term}`);
    if (courseReadOnly) {
      subtitleParts.push(
        courseEndDate ? `Ended · Ended on ${courseEndDate}` : "Ended"
      );
    } else if (courseEndDate) {
      subtitleParts.push(`Ends on ${courseEndDate}`);
    }
  }
  if (leftFilter.type === "tag" && leftFilter.tag) {
    subtitleParts.push(`Topic #${leftFilter.tag}`);
  } else if (leftFilter.type === "following") {
    subtitleParts.push("Followed");
  }

  const pageSubtitle = subtitleParts.length
    ? subtitleParts.join(" · ")
    : "Catch up with the latest class discussions.";

  /**
   * Build title for course profile modal.
   */
  const courseProfileTitle = useMemo(() => {
    if (headerCourse) {
      return `${headerCourse.course_code || ""} ${
        headerCourse.name || ""
      }`.trim();
    }
    return courseId ? `Course ${courseId}` : "Course profile";
  }, [headerCourse, courseId]);

  /**
   * Auth guard.
   * Wait until auth check is complete.
   * If there is no user, redirect to login.
   */
  useEffect(() => {
    if (!authCheckComplete) return;
    if (!authUser) navigate("/login", { replace: true });
  }, [authUser, authCheckComplete, navigate]);

  /**
   * When user exists, refresh course list.
   */
  useEffect(() => {
    if (authUser) fetchCourses().catch(() => {});
  }, [authUser, fetchCourses]);

  /**
   * Sync left filter with current route and query string.
   * This keeps UI state consistent with shared links.
   */
  useEffect(() => {
    const following =
      new URLSearchParams(location.search).get("tab") === "following";

    if (following) {
      setLeftFilter({ type: "following" });
      return;
    }

    if (routeHashtagParam) {
      setLeftFilter({
        type: "tag",
        tag: decodeURIComponent(routeHashtagParam).toLowerCase(),
      });
    } else {
      setLeftFilter({ type: "all" });
    }
  }, [routeHashtagParam, location.search]);

  /**
   * Prevent entering the course feed if profile is incomplete.
   * Redirect user to course profile page if needed.
   */
  useEffect(() => {
    if (
      !authCheckComplete ||
      !authUser ||
      !Number.isFinite(courseId) ||
      !courses.joined.length
    ) {
      return;
    }

    const membership = courses.joined.find((c) => c.id === courseId);

    if (membership && membership.profile_completed === false) {
      navigate(`/courses/${courseId}/profile`, {
        replace: true,
        state: { from: location.pathname + location.search },
      });
    }
  }, [
    authCheckComplete,
    authUser,
    courses.joined,
    courseId,
    navigate,
    location.pathname,
    location.search,
  ]);

  /**
   * Load posts based on current filter.
   * Supports all, following, and hashtag mode.
   */
  const loadFeed = useCallback(async () => {
    if (!Number.isFinite(courseId)) {
      setFeedStatus({ loading: false, error: "Course not found." });
      return;
    }

    setFeedStatus({ loading: true, error: "" });

    try {
      const params = new URLSearchParams();

      if (leftFilter.type === "following") params.set("tab", "following");
      if (leftFilter.type === "tag" && leftFilter.tag)
        params.set("hashtag", leftFilter.tag);

      const endpoint = params.toString()
        ? `/api/courses/${courseId}/posts/?${params.toString()}`
        : `/api/courses/${courseId}/posts/`;

      const data = await getJson(endpoint);

      setCourseSummary(data.course);
      setFeedItems(data.items || []);
      setFeedStatus({ loading: false, error: "" });

      /**
       * If no tag list is available from backend,
       * derive tag counts from current feed items.
       */
      if (leftFilter.type === "all") {
        try {
          const tagCounts = {};

          for (const p of data.items || []) {
            (p.hashtags || []).forEach((t) => {
              const key = String(t).toLowerCase();
              tagCounts[key] = (tagCounts[key] || 0) + 1;
            });
          }

          const derived = Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([value, count]) => ({ value, count }));

          if (derived.length) setTags((prev) => (prev.length ? prev : derived));
        } catch {}
      }
    } catch (error) {
      setFeedItems([]);
      setFeedStatus({
        loading: false,
        error: error.message || "Unable to load course posts.",
      });
    }
  }, [courseId, leftFilter]);

  /**
   * Load feed when user, course membership, and profile state are valid.
   */
  useEffect(() => {
    if (!authUser) return;
    const membership = courses.joined.find((c) => c.id === courseId);
    if (!membership) return;
    if (membership.profile_completed === false) return;
    loadFeed();
  }, [authUser, courses.joined, courseId, loadFeed]);

  /**
   * If the course becomes read-only,
   * close composer and stop editing.
   */
  useEffect(() => {
    if (courseReadOnly) {
      setShowComposer(false);
      setEditingPost(null);
    }
  }, [courseReadOnly]);

  /**
   * Load tag suggestions from backend.
   */
  const loadTags = useCallback(async () => {
    if (!Number.isFinite(courseId)) return;

    setTagsStatus({ loading: true, error: "" });

    try {
      const data = await getJson(
        `/api/courses/${courseId}/posts/suggestions/?type=hashtag&q=`
      );

      const items = (data.items || []).map((it) => ({
        value: (it.insert || it.value || "").toLowerCase(),
        count: it.count || undefined,
      }));

      setTags(items);
      setTagsStatus({ loading: false, error: "" });
    } catch (e) {
      setTagsStatus({ loading: false, error: "" });
    }
  }, [courseId]);

  /**
   * Load tags on mount or when course changes.
   */
  useEffect(() => {
    loadTags();
  }, [loadTags]);

  /**
   * Close mobile filter drawer when route changes.
   */
  useEffect(() => {
    setMobileFilterOpen(false);
  }, [location.pathname, location.search]);

  /**
   * Refresh button handler.
   */
  const handleRefresh = () => loadFeed();

  /**
   * Open course profile modal and load profile data.
   */
  const openProfileModal = useCallback(async () => {
    if (!Number.isFinite(courseId)) return;

    setProfileModal({ open: true, loading: true, profile: null, error: "" });

    try {
      const data = await loadCourseProfile(courseId);
      setProfileModal({
        open: true,
        loading: false,
        profile: data?.profile || null,
        error: "",
      });
    } catch (error) {
      setProfileModal({
        open: true,
        loading: false,
        profile: null,
        error: error?.message || "Unable to load this course profile.",
      });
    }
  }, [courseId, loadCourseProfile]);

  /**
   * Close profile modal.
   */
  const closeProfileModal = () => {
    setProfileModal((prev) => ({ ...prev, open: false }));
  };

  /**
   * Navigate to edit profile page.
   */
  const handleEditProfile = () => {
    closeProfileModal();
    if (Number.isFinite(courseId)) {
      navigate(`/courses/${courseId}/profile`);
    }
  };

  /**
   * Switch to "all" filter.
   * Also update the route.
   */
  const handleFilterAll = useCallback(() => {
    setLeftFilter({ type: "all" });
    navigate(`/courses/${courseId}`, { replace: true });
    setMobileFilterOpen(false);
  }, [courseId, navigate]);

  /**
   * Switch to "following" filter.
   * Also update the route.
   */
  const handleFilterFollowing = useCallback(() => {
    setLeftFilter({ type: "following" });
    navigate(`/courses/${courseId}?tab=following`, { replace: true });
    setMobileFilterOpen(false);
  }, [courseId, navigate]);

  /**
   * Switch to a specific tag filter.
   * Also update the route.
   */
  const handleFilterTag = useCallback(
    (value) => {
      setLeftFilter({ type: "tag", tag: value });
      navigate(`/courses/${courseId}/hashtags/${encodeURIComponent(value)}`, {
        replace: true,
      });
      setMobileFilterOpen(false);
    },
    [courseId, navigate]
  );

  /**
   * Open composer for creating a new post.
   * Reset edit mode and related states.
   */
  const openComposer = () => {
    if (courseReadOnly) return;
    setEditingPost(null);
    setComposerContent("");
    setAttachments([]);
    setUploadStatus({ ...initialUploadStatus });
    setComposerStatus({ ...initialComposerStatus });
    setMentionSelections({});
    setProfanityMsg("");
    setShowComposer(true);
  };

  /**
   * Close composer and reset temporary UI states.
   */
  const closeComposer = () => {
    setShowComposer(false);
    setEditingPost(null);
    setComposerStatus({ ...initialComposerStatus });
    setUploadStatus({ ...initialUploadStatus });
    setActiveTrigger(null);
    setSuggestionsState({ ...initialSuggestionsState });
    setHighlightIndex(0);
    fetchSeqRef.current += 1;
  };

  /**
   * Clear suggestion list and reset highlight index.
   */
  const clearSuggestions = useCallback(() => {
    setSuggestionsState({ ...initialSuggestionsState });
    setHighlightIndex(0);
  }, []);

  /**
   * Update trigger state based on current textarea value and caret position.
   * It checks if user is typing after @ or #.
   */
  const updateTrigger = useCallback(
    (value, caret) => {
      const next = findTrigger(value, caret);
      const had = Boolean(activeTrigger);

      setActiveTrigger((prev) => {
        if (!next) return prev ? null : prev;

        if (
          prev &&
          prev.type === next.type &&
          prev.start === next.start &&
          prev.query === next.query
        )
          return prev;

        return next;
      });

      if (!next) {
        if (had) fetchSeqRef.current += 1;
        clearSuggestions();
      }
    },
    [activeTrigger, clearSuggestions]
  );

  /**
   * Insert text at current cursor position in textarea.
   * Keep cursor after inserted text.
   */
  const insertTextAtCursor = useCallback(
    (text) => {
      const textarea = textareaRef.current;

      if (!textarea) {
        setComposerContent((prev) => `${prev}${text}`);
        return;
      }

      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? textarea.value.length;

      const schedule =
        typeof window !== "undefined" &&
        typeof window.requestAnimationFrame === "function"
          ? window.requestAnimationFrame
          : (cb) => setTimeout(cb, 0);

      setComposerContent((prev) => {
        const before = prev.slice(0, start);
        const after = prev.slice(end);
        const next = `${before}${text}${after}`;

        schedule(() => {
          const pos = start + text.length;
          textarea.selectionStart = pos;
          textarea.selectionEnd = pos;
          textarea.focus();
          updateTrigger(next, pos);
        });

        return next;
      });
    },
    [updateTrigger]
  );

  /**
   * Insert emoji into textarea.
   */
  const handleAddEmoji = useCallback(
    (e) => {
      resetComposerStatus();
      insertTextAtCursor(e);
    },
    [insertTextAtCursor, resetComposerStatus]
  );

  /**
   * Insert @ into textarea.
   */
  const handleAddMention = useCallback(() => {
    resetComposerStatus();
    insertTextAtCursor("@");
  }, [insertTextAtCursor, resetComposerStatus]);

  /**
   * Insert # into textarea.
   */
  const handleAddHashtag = useCallback(() => {
    resetComposerStatus();
    insertTextAtCursor("#");
  }, [insertTextAtCursor, resetComposerStatus]);

  /**
   * Open file picker for attachments.
   * Stop if editing mode or max attachments reached.
   */
  const handleAttachmentButton = useCallback(() => {
    if (isEditing) return;

    if (attachments.length >= MAX_ATTACHMENTS) {
      setUploadStatus({
        loading: false,
        error: `You can add up to ${MAX_ATTACHMENTS} attachments.`,
        message: "",
      });
      return;
    }

    setUploadStatus({ ...initialUploadStatus });
    fileInputRef.current?.click();
  }, [attachments.length, isEditing]);

  /**
   * Remove one uploaded attachment by id.
   */
  const handleRemoveAttachment = useCallback((assetId) => {
    setAttachments((prev) => prev.filter((i) => i.id !== assetId));
    setUploadStatus({ ...initialUploadStatus });
  }, []);

  /**
   * Handle selected files from file input.
   * Upload images and videos only.
   * Enforce max attachment limit.
   */
  const handleSelectFiles = useCallback(
    async (event) => {
      if (isEditing) return;

      const files = Array.from(event.target.files || []);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (!files.length) return;

      const remaining = MAX_ATTACHMENTS - attachments.length;

      if (remaining <= 0) {
        setUploadStatus({
          loading: false,
          error: `You can add up to ${MAX_ATTACHMENTS} attachments.`,
          message: "",
        });
        return;
      }

      const allowed = files.filter(
        (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
      );

      if (!allowed.length) {
        setUploadStatus({
          loading: false,
          error: "Only image or video files are supported.",
          message: "",
        });
        return;
      }

      const filesToUpload = allowed.slice(0, remaining);

      setUploadStatus({ loading: true, error: "", message: "" });

      try {
        const uploaded = [];

        for (const f of filesToUpload) {
          const asset = await uploadFile("/api/messages/files/", f);
          uploaded.push(asset);
        }

        setAttachments((prev) => [...prev, ...uploaded]);

        const skipped = allowed.length - filesToUpload.length;

        setUploadStatus({
          loading: false,
          error: "",
          message:
            skipped > 0
              ? `Uploaded ${filesToUpload.length} file(s); ${skipped} more were skipped.`
              : `Uploaded ${filesToUpload.length} attachment(s).`,
        });
      } catch (err) {
        setUploadStatus({
          loading: false,
          error:
            err.message || "Attachment upload failed. Please try again later.",
          message: "",
        });
      }
    },
    [attachments.length, isEditing]
  );

  /**
   * Fetch mention or hashtag suggestions with debounce.
   * Ignore stale responses with fetchSeqRef.
   */
  useEffect(() => {
    if (!activeTrigger || !Number.isFinite(courseId)) return;

    const handler = setTimeout(() => {
      const requestId = ++fetchSeqRef.current;

      setSuggestionsState((prev) => ({ ...prev, loading: true, error: "" }));

      const params = new URLSearchParams({
        type: activeTrigger.type,
        q: activeTrigger.query || "",
      });

      getJson(
        `/api/courses/${courseId}/posts/suggestions/?${params.toString()}`
      )
        .then((data) => {
          if (requestId !== fetchSeqRef.current) return;
          setSuggestionsState({
            items: data.items || [],
            loading: false,
            error: "",
          });
          setHighlightIndex(0);
        })
        .catch((error) => {
          if (requestId !== fetchSeqRef.current) return;
          setSuggestionsState({
            items: [],
            loading: false,
            error: error.message,
          });
        });
    }, SUGGESTION_DEBOUNCE_MS);

    return () => clearTimeout(handler);
  }, [activeTrigger, courseId]);

  /**
   * Update composer content while typing.
   * Keep mentionSelections only for mentions still present in text.
   * Re-check profanity.
   */
  const handleComposerChange = useCallback(
    (e) => {
      const { value, selectionStart } = e.target;

      const mentionKeys = new Set(
        (value.match(/@([^\s@#]+)/g) || []).map((i) =>
          i.replace(/^@+/, "").toLowerCase()
        )
      );

      setComposerContent(value);
      resetComposerStatus();

      setMentionSelections((prev) => {
        const next = {};
        mentionKeys.forEach((k) => {
          if (prev[k]) next[k] = prev[k];
        });
        return next;
      });

      const caret = Number.isInteger(selectionStart)
        ? selectionStart
        : value.length;

      updateTrigger(value, caret);

      const check = hasProfanity(value);
      setProfanityMsg(check.ok ? "" : check.message);
    },
    [resetComposerStatus, updateTrigger]
  );

  /**
   * Update trigger when cursor position changes.
   */
  const handleComposerSelect = useCallback(
    (e) => {
      const { value, selectionStart } = e.target;
      const caret = Number.isInteger(selectionStart)
        ? selectionStart
        : value.length;
      updateTrigger(value, caret);
    },
    [updateTrigger]
  );

  /**
   * Hide suggestions when textarea loses focus.
   */
  const handleComposerBlur = useCallback(() => {
    setActiveTrigger(null);
    clearSuggestions();
    fetchSeqRef.current += 1;
  }, [clearSuggestions]);

  /**
   * Apply selected mention or hashtag suggestion into textarea.
   * Replace trigger text with the selected value plus a trailing space.
   */
  const applySuggestion = useCallback(
    (item) => {
      if (!activeTrigger) return;

      const textarea = textareaRef.current;
      const fallbackLen = textarea?.value?.length ?? 0;
      const caret = textarea?.selectionStart ?? fallbackLen;

      const triggerChar =
        activeTrigger.trigger || (activeTrigger.type === "mention" ? "@" : "#");

      const insertValue = item.insert || item.value || "";
      const replacement = `${triggerChar}${insertValue} `;

      if (activeTrigger.type === "mention") {
        setMentionSelections((prev) => ({
          ...prev,
          [insertValue.toLowerCase()]: {
            id: item.id ?? null,
            value: insertValue,
            display: item.display || insertValue,
          },
        }));
      }

      setComposerContent((prev) => {
        const before = prev.slice(0, activeTrigger.start);
        const after = prev.slice(caret);
        return `${before}${replacement}${after}`;
      });

      fetchSeqRef.current += 1;
      setActiveTrigger(null);
      clearSuggestions();
      resetComposerStatus();

      const nextCaret = activeTrigger.start + replacement.length;

      const schedule =
        typeof window !== "undefined" &&
        typeof window.requestAnimationFrame === "function"
          ? window.requestAnimationFrame
          : (cb) => setTimeout(cb, 0);

      schedule(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = nextCaret;
          textareaRef.current.selectionEnd = nextCaret;
          textareaRef.current.focus();
        }
      });
    },
    [activeTrigger, clearSuggestions, resetComposerStatus]
  );

  /**
   * Handle keyboard actions in composer.
   * ArrowDown moves to next suggestion.
   * ArrowUp moves to previous suggestion.
   * Enter selects highlighted suggestion.
   * Escape closes suggestion dropdown.
   */
  const handleComposerKeyDown = useCallback(
    (e) => {
      if (!activeTrigger) return;

      const items = suggestionsState.items || [];

      if (e.key === "ArrowDown" && items.length) {
        e.preventDefault();
        setHighlightIndex((p) => (p + 1) % items.length);
        return;
      }

      if (e.key === "ArrowUp" && items.length) {
        e.preventDefault();
        setHighlightIndex((p) => (p - 1 + items.length) % items.length);
        return;
      }

      if (e.key === "Enter" && !e.shiftKey && items.length) {
        e.preventDefault();
        applySuggestion(items[highlightIndex] || items[0]);
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        setActiveTrigger(null);
        clearSuggestions();
        fetchSeqRef.current += 1;
        return;
      }
    },
    [
      activeTrigger,
      suggestionsState.items,
      highlightIndex,
      applySuggestion,
      clearSuggestions,
    ]
  );

  /**
   * Filter feed items locally by keyword.
   * Search in content, hashtags, and author name.
   */
  const visibleFeedItems = useMemo(() => {
    if (!keyword.trim()) return feedItems;

    const kw = keyword.trim().toLowerCase();

    return feedItems.filter((p) => {
      const text = (p.content || "").toLowerCase();
      const tags = (p.hashtags || []).join(" ").toLowerCase();
      const author = (
        p.author_display_name ||
        p.author_username ||
        ""
      ).toLowerCase();

      return text.includes(kw) || tags.includes(kw) || author.includes(kw);
    });
  }, [feedItems, keyword]);

  /**
   * Submit post or edit existing post.
   * Validate content.
   * Validate profanity.
   * Build mentions and hashtags.
   * Send create or update request.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (courseReadOnly) {
      setComposerStatus({
        loading: false,
        error: "This course has ended. New posts are disabled.",
        message: "",
      });
      return;
    }

    if (uploadStatus.loading) {
      setComposerStatus({
        loading: false,
        error: "Attachments are still uploading. Please wait...",
        message: "",
      });
      return;
    }

    let trimmed = composerContent.trim();

    if (!trimmed) {
      setComposerStatus({
        loading: false,
        error: "Please enter post content.",
        message: "",
      });
      return;
    }

    const profanityCheck = hasProfanity(trimmed);

    if (!profanityCheck.ok) {
      setProfanityMsg(profanityCheck.message);
      setComposerStatus({
        loading: false,
        error: `${profanityCheck.message} Posting is not permitted.`,
        message: "",
      });
      return;
    }

    setComposerStatus({ loading: true, error: "", message: "" });

    try {
      /**
       * Extract mentions from text.
       */
      const mentions = Array.from(
        new Set(
          (trimmed.match(/@([^\s@#]+)/g) || []).map((i) => i.replace(/^@+/, ""))
        )
      );

      /**
       * Extract hashtags from text.
       */
      const hashtagsSet = new Set(
        (trimmed.match(/#([^\s@#]+)/g) || []).map((i) =>
          i.replace(/^#+/, "").toLowerCase()
        )
      );

      /**
       * If user is posting under a tag filter,
       * ensure that tag is included in payload.
       */
      if (
        leftFilter.type === "tag" &&
        leftFilter.tag &&
        !hashtagsSet.has(leftFilter.tag.toLowerCase())
      ) {
        hashtagsSet.add(leftFilter.tag.toLowerCase());
        trimmed = `${trimmed} #${leftFilter.tag}`.trim();
      }

      const hashtags = Array.from(hashtagsSet);

      /**
       * Build mention_entities with resolved user ids if available.
       */
      const mentionEntities = mentions.map((v) => {
        const key = v.toLowerCase();
        const info = mentionSelections[key];
        return { value: v, user_id: info?.id ?? null };
      });

      /**
       * Build request payload.
       */
      const payload = {
        content: trimmed,
        mentions,
        mention_entities: mentionEntities,
        hashtags,
      };

      /**
       * Add attachment ids only when creating a new post.
       * Editing mode does not upload attachments here.
       */
      if (!isEditing) {
        payload.attachments = attachments.map((i) => i.id);
      }

      /**
       * Edit existing post.
       */
      if (isEditing && editingPost) {
        const data = await patchJson(
          `/api/courses/${courseId}/posts/${editingPost.id}/`,
          payload
        );

        const updatedItem = { ...(data.item || {}) };

        setFeedItems((prev) => {
          const lowerTag =
            leftFilter.type === "tag" && leftFilter.tag
              ? leftFilter.tag.toLowerCase()
              : null;

          const hasTag = lowerTag
            ? (updatedItem.hashtags || [])
                .map((h) => String(h).toLowerCase())
                .includes(lowerTag)
            : true;

          const next = prev.map((it) =>
            it.id === editingPost.id ? updatedItem : it
          );

          /**
           * If current tag filter no longer matches after edit,
           * remove the post from visible list.
           */
          if (lowerTag && !hasTag) {
            return next.filter((it) => it.id !== editingPost.id);
          }

          return next;
        });

        await loadTags();

        setComposerStatus({
          loading: false,
          error: "",
          message: "Updated successfully!",
        });
      } else {
        /**
         * Create new post.
         */
        await postJson(`/api/courses/${courseId}/posts/`, payload);

        setComposerStatus({
          loading: false,
          error: "",
          message: "Published successfully！",
        });

        await loadFeed();
      }

      /**
       * Reset composer after successful submit.
       */
      setComposerContent("");
      setAttachments([]);
      setUploadStatus({ ...initialUploadStatus });
      setProfanityMsg("");
      setActiveTrigger(null);
      clearSuggestions();
      setMentionSelections({});
      fetchSeqRef.current += 1;
      setEditingPost(null);
      setShowComposer(false);
    } catch (error) {
      setComposerStatus({
        loading: false,
        error: error.message || "Failed to publish. Please try again later.",
        message: "",
      });
    }
  };

  /**
   * Toggle like on a post.
   * Use deleteJson for unlike.
   * Use postJson for like.
   */
  const handleToggleLike = async (post) => {
    if (courseReadOnly) return;
    if (likeBusyId === post.id) return;

    setLikeBusyId(post.id);

    try {
      const endpoint = `/api/courses/${courseId}/posts/${post.id}/like/`;
      const data = post.liked_by_me
        ? await deleteJson(endpoint)
        : await postJson(endpoint);

      setFeedItems((prev) =>
        prev.map((it) => (it.id === post.id ? data.item : it))
      );

      setFeedStatus((prev) => ({ ...prev, error: "" }));
    } catch (error) {
      setFeedStatus((prev) => ({
        ...prev,
        error: error.message || "Action failed. Please try again later.",
      }));
    } finally {
      setLikeBusyId(null);
    }
  };

  /**
   * Start edit mode for a post.
   * Load post content into composer.
   * Rebuild mention selection map.
   */
  const handleStartEdit = useCallback(
    (post) => {
      if (!post) return;
      if (courseReadOnly) return;

      setEditingPost(post);
      setComposerContent(post.content || "");
      setAttachments([]);
      setUploadStatus({ ...initialUploadStatus });
      setComposerStatus({ ...initialComposerStatus });

      const preset = {};

      (post.mentions_detail || []).forEach((detail) => {
        const raw =
          detail.username || detail.identifier || detail.display || "";
        if (!raw) return;

        const key = raw.toLowerCase();

        preset[key] = {
          id: detail.id ?? null,
          value: raw,
          display: detail.display || detail.username || raw,
        };
      });

      setMentionSelections(preset);
      setShowComposer(true);
    },
    [courseReadOnly]
  );

  /**
   * Open delete confirmation dialog.
   */
  const handleDeletePost = useCallback((post) => {
    if (!post) return;
    setFeedStatus((prev) => ({ ...prev, error: "" }));
    setDeleteState({ open: true, post });
  }, []);

  /**
   * Cancel delete dialog.
   */
  const cancelDeletePost = useCallback(() => {
    if (deleteBusy) return;
    setDeleteState({ open: false, post: null });
  }, [deleteBusy]);

  /**
   * Confirm delete action.
   * Remove post from feed after successful delete.
   * Also close composer if the deleted post was being edited.
   */
  const confirmDeletePost = useCallback(async () => {
    if (!deleteState.post || deleteBusy) return;

    setDeleteBusy(true);

    try {
      await deleteJson(
        `/api/courses/${courseId}/posts/${deleteState.post.id}/`
      );

      setFeedItems((prev) =>
        prev.filter((item) => item.id !== deleteState.post.id)
      );

      if (editingPost && editingPost.id === deleteState.post.id) {
        setEditingPost(null);
        setShowComposer(false);
      }

      await loadTags();
      setDeleteState({ open: false, post: null });
    } catch (error) {
      setFeedStatus((prev) => ({
        ...prev,
        error: error.message || "Failed to delete post.",
      }));
    } finally {
      setDeleteBusy(false);
    }
  }, [courseId, deleteState.post, deleteBusy, editingPost, loadTags]);

  /**
   * Render post content with clickable mentions and hashtags.
   * Mentions link to people pages when a user id is known.
   * Hashtags link to course hashtag route.
   */
  const renderPostContent = useCallback(
    (post) => {
      const text = post.content || "";

      const postMentions = post.mentions_detail?.length
        ? post.mentions_detail
        : (post.mentions || []).map((v) => ({
            id: null,
            display: v,
            username: v,
          }));

      /**
       * Build lookup map from mention text to user id.
       */
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
        } else if (token.startsWith("#")) {
          const tag = token.slice(1);

          parts.push(
            <button
              key={`h-${post.id}-${match.index}`}
              type="button"
              className="text-brand hover:underline"
              onClick={() => {
                navigate(
                  `/courses/${courseId}/hashtags/${encodeURIComponent(tag)}`
                );
              }}
            >
              {token}
            </button>
          );
        }

        last = re.lastIndex;
      }

      if (last < text.length) parts.push(text.slice(last));

      return parts;
    },
    [navigate, courseId]
  );

  /**
   * Build avatar display for current user.
   */
  const { initials, displayName, photoUrl } = useAvatar(authUser);

  /**
   * Compact fallback display name.
   */
  const compactName = displayName || "User";

  /**
   * Base class name for left filter buttons.
   */
  const leftItemBase =
    "w-full rounded-xl px-3 py-2 text-sm font-medium text-left transition flex items-center justify-between";

  /**
   * Small reusable component for left filter items.
   */
  const LeftItem = ({ active, children, onClick }) => (
    <button
      type="button"
      className={
        active
          ? `${leftItemBase} bg-brand-100 text-brand`
          : `${leftItemBase} text-slate-600 hover:bg-brand-50`
      }
      onClick={onClick}
    >
      {children}
    </button>
  );

  /**
   * Render feed area.
   * Handle loading state, empty state, keyword no-result state, and normal list.
   */
  const renderFeed = () => {
    if (feedStatus.loading) {
      return <p className="text-sm text-slate-500">Loading...</p>;
    }

    const list = visibleFeedItems;

    if (list.length === 0) {
      if (keyword.trim()) {
        return (
          <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50 px-4 py-3 text-sm text-slate-600">
            No results for “<span className="font-semibold">{keyword}</span>”.
          </div>
        );
      }

      return (
        <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50 px-4 py-3 text-sm text-slate-600">
          {leftFilter.type === "following"
            ? "There is no new activity for the people you follow, or you haven't followed any classmates yet."
            : "There are no posts yet. Be the first to post!"}
        </div>
      );
    }

    return (
      <ul className="space-y-4">
        {list.map((post) => (
          <li key={post.id}>
            <PostCard
              post={post}
              courseId={courseId}
              navigate={navigate}
              onToggleLike={handleToggleLike}
              likeBusyId={likeBusyId}
              renderContent={renderPostContent}
              readOnly={courseReadOnly}
              readOnlyTooltip={
                courseReadOnly
                  ? courseEndDate
                    ? `This course ended on ${courseEndDate}. Likes are disabled.`
                    : "This course has ended. Likes are disabled."
                  : undefined
              }
              onEdit={handleStartEdit}
              onDelete={handleDeletePost}
            />
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-accent-50">
      {/* 
        Top header section.
        It shows logo, user card, and logout button.
      */}
      <header className="border-b border-brand-100/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3 lg:px-6 lg:py-4">
          {/* Left side logo button. */}
          <button
            type="button"
            onClick={() => navigate("/studenthome")}
            aria-label="Return to student home"
            className="group relative flex items-center gap-2.5 text-xl font-bold rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/30 transition"
          >
            <img
              src="/logo.jpg"
              alt="Bread logo"
              className="shrink-0 h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 rounded-lg object-cover transition-transform duration-200 group-hover:scale-105"
            />
            <span
              className="bg-[linear-gradient(90deg,#1B596E_0%,#206F88_38%,#1DAF92_100%)]
                            bg-clip-text text-lg text-transparent drop-shadow-[0_1px_1px_rgba(255,255,255,0.3)] sm:text-xl"
            >
              Bread
            </span>
          </button>

          {/* Right side user info and logout button. */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-3 lg:gap-5">
            <div
              className="flex min-w-0 items-center gap-2 rounded-full border border-brand-200/80
                         bg-white/95 px-2.5 py-1.5 shadow-soft sm:gap-3 sm:px-4 sm:py-2
                         transition-all duration-200 hover:shadow-brand hover:border-brand-300"
            >
              {/* User avatar or initials. */}
              <div
                className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full
                           bg-gradient-to-br from-brand-300 via-brand-200 to-accent-200
                           text-sm font-semibold text-slate-800 sm:h-10 sm:w-10 sm:text-base
                           shadow-[inset_0_1px_2px_rgba(255,255,255,0.65),0_2px_8px_rgba(32,111,136,0.16)]"
              >
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>

              {/* User name and email. */}
              <div className="min-w-0 leading-tight">
                <p className="max-w-[120px] truncate text-xs font-semibold text-slate-800 sm:max-w-[12rem] sm:text-sm">
                  {compactName}
                </p>
                <p className="hidden max-w-[12rem] truncate text-xs text-slate-500 sm:block">
                  {authUser?.email || authUser?.username || "Welcome back"}
                </p>
              </div>
            </div>

            {/* Logout button. */}
            <button
              type="button"
              className="group inline-flex items-center gap-2 rounded-2xl border border-brand-200 bg-white
                        px-2.5 py-1.5 text-xs font-semibold text-brand-700 sm:px-4 sm:py-2 sm:text-sm
                        shadow-soft transition-all duration-200 hover:border-brand-300 hover:bg-brand-50/70
                        hover:shadow-brand hover:scale-[1.02] active:scale-[0.99]
                        focus:outline-none focus:ring-2 focus:ring-brand/30"
              onClick={async () => {
                try {
                  await logout();
                } finally {
                  navigate("/", { replace: true });
                }
              }}
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-4 w-4 transition-transform duration-150 group-hover:-translate-x-0.5"
              >
                <path
                  fill="currentColor"
                  d="M13 3a1 1 0 0 1 1 1v4h-2V5H6v14h6v-3h2v4a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8z"
                />
                <path
                  fill="currentColor"
                  d="M21 12a1 1 0 0 0-1-1h-7v2h7a1 1 0 0 0 1-1zm-3.707-4.707-1.414 1.414L18.586 11H13v2h5.586l-2.707 2.293 1.414 1.414L22 12l-4.707-4.707z"
                />
              </svg>
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* 
        Main two-column layout.
        Left side is filters.
        Right side is feed content.
      */}
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-3 py-3 sm:gap-4 sm:px-4 sm:py-4 lg:flex-row lg:gap-6 lg:px-6 lg:py-8">
        {/* Desktop left sidebar. */}
        <aside className="hidden w-64 flex-shrink-0 rounded-3xl border border-brand-100 bg-white p-4 shadow-lg shadow-brand-100 lg:block">
          {/* Course title and subtitle. */}
          <div className="mb-4">
            <h1 className="text-base font-bold text-slate-900 truncate">
              {pageTitle}
            </h1>
            <p className="mt-0.5 text-xs text-slate-500 truncate">
              {pageSubtitle}
            </p>
          </div>

          {/* Profile section. */}
          <div className="mb-4">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Profile
            </label>
            <div className="relative rounded-full p-[2px] bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200">
              <button
                type="button"
                onClick={openProfileModal}
                className="flex h-10 w-full items-center justify-between rounded-full bg-white px-4 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                <span>View course profile</span>
                <span className="text-slate-400">↗</span>
              </button>
            </div>
          </div>

          {/* Materials shortcut. */}
          <div className="mb-4">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Resources
            </label>
            <a
              href={`/courses/${courseId}/materials`}
              className="flex h-10 w-full items-center justify-between rounded-full border border-brand-200 bg-brand-50/60 px-4 text-sm font-semibold text-brand-700 transition hover:bg-brand-100"
            >
              <span>📂 Course Materials</span>
              <span className="text-brand-400">↗</span>
            </a>
          </div>

          {/* Local search field. */}
          <div className="mb-4">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Search
            </label>
            <div className="relative rounded-full p-[2px] bg-gradient-to-r from-brand-400 via-accent-300 to-accent-500">
              <input
                type="text"
                placeholder="🔍  Search posts"
                className="h-10 w-full rounded-full border-2 border-white bg-white px-5 text-sm text-slate-800 placeholder-slate-400 shadow-sm
                           focus:outline-none focus:ring-2 focus:ring-accent-400 focus:border-accent-400 transition-all duration-200"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                aria-label="Search posts"
              />
            </div>
          </div>

          {/* Main filter section. */}
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Filter
          </div>
          <div className="space-y-2">
            <LeftItem
              active={leftFilter.type === "all"}
              onClick={handleFilterAll}
            >
              <span>All</span>
            </LeftItem>
            <LeftItem
              active={leftFilter.type === "following"}
              onClick={handleFilterFollowing}
            >
              <span>Followed</span>
            </LeftItem>
          </div>

          {/* Community hashtag filter section. */}
          <div className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Community
          </div>

          {tagsStatus.loading ? (
            <p className="text-xs text-slate-400">Load Community...</p>
          ) : (
            <div className="space-y-1">
              {(tags || []).map((t) => {
                const value = typeof t === "string" ? t : t.value;
                const count = typeof t === "string" ? undefined : t.count;
                const active =
                  leftFilter.type === "tag" && leftFilter.tag === value;

                return (
                  <LeftItem
                    key={value}
                    active={active}
                    onClick={() => handleFilterTag(value)}
                  >
                    <span>#{value}</span>
                    {count ? (
                      <span className="text-[10px] text-slate-400">
                        {count}
                      </span>
                    ) : null}
                  </LeftItem>
                );
              })}

              {(tags || []).length === 0 ? (
                <p className="text-xs text-slate-400">No tag</p>
              ) : null}
            </div>
          )}
        </aside>

        {/* Right side main content area. */}
        <main className="flex-1 space-y-4 rounded-2xl border border-brand-100 bg-white/90 p-4 pb-24 shadow-lg shadow-brand-100/80 sm:space-y-5 sm:p-5 lg:space-y-6 lg:rounded-3xl lg:p-6 lg:pb-6 lg:shadow-xl lg:shadow-brand-100">
          {/* Mobile title block. */}
          <div className="space-y-2 lg:hidden">
            <h1 className="break-words text-base font-bold text-slate-900">
              {pageTitle}
            </h1>
            <p className="break-words text-xs text-slate-500">{pageSubtitle}</p>
          </div>

          {/* Mobile quick action buttons. */}
          <div className="flex flex-wrap items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileFilterOpen(true)}
              className="inline-flex h-9 items-center rounded-full border border-brand-300 bg-white px-4 text-xs font-semibold text-brand-700 transition hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-300"
              aria-label="Open feed filters"
            >
              Filters
            </button>
            <button
              type="button"
              onClick={() => navigate("/studenthome")}
              className="inline-flex h-9 items-center rounded-full border border-brand-300 bg-white px-4 text-xs font-semibold text-brand-700 transition hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-300"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex h-9 items-center rounded-full border border-accent-300 bg-white px-4 text-xs font-semibold text-accent-700 transition hover:bg-accent-50 focus:outline-none focus:ring-2 focus:ring-accent-300"
            >
              Refresh
            </button>
            <a
              href={`/courses/${courseId}/materials`}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-brand-400 bg-brand-50 px-4 text-xs font-semibold text-brand-800 transition hover:bg-brand-100 focus:outline-none focus:ring-2 focus:ring-brand-300"
            >
              📂 Materials
            </a>
          </div>

          {/* Read-only warning. */}
          {courseReadOnly ? (
            <div className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-600">
              {courseEndDate
                ? `This course ended on ${courseEndDate}. Posts are read-only.`
                : "This course has ended. Posts are read-only."}
            </div>
          ) : null}

          {/* Feed error message. */}
          {feedStatus.error ? <Feedback error={feedStatus.error} /> : null}

          {/* Desktop sticky action bar. */}
          <div className="sticky top-0 z-20 -mx-6 hidden px-6 pt-2 lg:block">
            <div className="flex items-center justify-end gap-3 rounded-b-2xl border-b border-brand-100/60 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60 py-3">
              <button
                type="button"
                onClick={() => navigate("/studenthome")}
                className="inline-flex h-10 items-center gap-2 rounded-full border-2 bg-white px-5 text-sm font-semibold
                 text-brand-600 border-brand-400/80 transition-all duration-200 hover:bg-brand-50 hover:shadow-md"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                  <path
                    fill="currentColor"
                    d="M11.7 5.3 5 12l6.7 6.7 1.4-1.4L8.8 13H20v-2H8.8l4.3-4.3-1.4-1.4z"
                  />
                </svg>
                Back to homepage
              </button>

              <button
                type="button"
                onClick={handleRefresh}
                className="inline-flex h-10 items-center gap-2 rounded-full border-2 bg-white px-5 text-sm font-semibold
                 text-accent-700 border-accent-400/80 transition-all duration-200 hover:bg-accent-50 hover:shadow-md"
                title="Refresh"
              >
                Refresh
              </button>

              <button
                type="button"
                onClick={openComposer}
                className={`inline-flex h-10 items-center gap-2 rounded-full px-7 text-sm font-semibold text-white shadow-md
                  bg-gradient-to-r from-brand-500 via-accent-400 to-accent-500
                  hover:from-brand-600 hover:via-accent-500 hover:to-accent-500
                  transition-all duration-200 hover:shadow-[0_8px_24px_-6px_rgba(236,72,153,0.45)] active:scale-[0.97]
                  border-2 border-white/40 ${
                    !showComposer ? "animate-pulse" : ""
                  }`}
              >
                Create Post
              </button>
            </div>
          </div>

          {/* Feed list area. */}
          {renderFeed()}
        </main>
      </div>

      {/* Mobile filter drawer. */}
      {mobileFilterOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Feed filters">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setMobileFilterOpen(false)}
            aria-label="Close filters"
          />
          <div className="absolute inset-y-0 right-0 w-[86%] max-w-sm overflow-y-auto border-l border-brand-100 bg-white p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Feed Filters</h2>
              <button
                type="button"
                className="rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
                onClick={() => setMobileFilterOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="mb-4 space-y-1">
              <p className="text-sm font-semibold text-slate-900">{pageTitle}</p>
              <p className="text-xs text-slate-500">{pageSubtitle}</p>
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Quick Links
              </label>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileFilterOpen(false);
                    openProfileModal();
                  }}
                  className="flex h-10 w-full items-center justify-between rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  <span>View course profile</span>
                  <span className="text-slate-400">↗</span>
                </button>
                <a
                  href={`/courses/${courseId}/materials`}
                  onClick={() => setMobileFilterOpen(false)}
                  className="flex h-10 w-full items-center justify-between rounded-full border border-brand-200 bg-brand-50 px-4 text-sm font-semibold text-brand-700 shadow-sm transition hover:bg-brand-100 focus:outline-none focus:ring-2 focus:ring-brand-200"
                >
                  <span>📂 Course Materials</span>
                  <span className="text-brand-400">↗</span>
                </a>
              </div>
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Search
              </label>
              <input
                type="text"
                placeholder="Search posts"
                className="h-10 w-full rounded-full border border-brand-200 bg-brand-50 px-4 text-sm text-slate-800 placeholder-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-100"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                aria-label="Search posts"
              />
            </div>

            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Filter
            </div>
            <div className="space-y-2">
              <LeftItem active={leftFilter.type === "all"} onClick={handleFilterAll}>
                <span>All</span>
              </LeftItem>
              <LeftItem
                active={leftFilter.type === "following"}
                onClick={handleFilterFollowing}
              >
                <span>Followed</span>
              </LeftItem>
            </div>

            <div className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Community
            </div>
            {tagsStatus.loading ? (
              <p className="text-xs text-slate-400">Load Community...</p>
            ) : (
              <div className="space-y-1">
                {(tags || []).map((t) => {
                  const value = typeof t === "string" ? t : t.value;
                  const count = typeof t === "string" ? undefined : t.count;
                  const active =
                    leftFilter.type === "tag" && leftFilter.tag === value;
                  return (
                    <LeftItem
                      key={`mobile-${value}`}
                      active={active}
                      onClick={() => handleFilterTag(value)}
                    >
                      <span>#{value}</span>
                      {count ? (
                        <span className="text-[10px] text-slate-400">{count}</span>
                      ) : null}
                    </LeftItem>
                  );
                })}
                {(tags || []).length === 0 ? (
                  <p className="text-xs text-slate-400">No tag</p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Mobile floating create-post button. */}
      {!courseReadOnly ? (
        <button
          type="button"
          onClick={openComposer}
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 z-30 inline-flex h-14 items-center justify-center rounded-full bg-gradient-to-r from-brand-500 via-accent-400 to-accent-500 px-5 text-sm font-semibold text-white shadow-[0_14px_28px_-8px_rgba(236,72,153,0.5)] transition hover:scale-[1.02] hover:shadow-[0_18px_30px_-10px_rgba(236,72,153,0.55)] focus:outline-none focus:ring-2 focus:ring-accent-300 lg:hidden"
          aria-label="Create post"
        >
          + Post
        </button>
      ) : null}

      {/* Composer modal for creating or editing a post. */}
      {showComposer && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-0 sm:grid sm:place-items-center sm:p-4">
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-accent-100/70 bg-white/95 p-4 shadow-[0_32px_90px_-32px_rgba(91,33,182,0.45)] backdrop-blur sm:max-h-[86vh] sm:max-w-2xl sm:rounded-3xl sm:p-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                {isEditing ? "Edit Post" : "New Post"}
              </h3>
              <button
                type="button"
                className="rounded-full border border-accent-100 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-500 transition hover:bg-accent-50 hover:text-accent-600"
                onClick={closeComposer}
              >
                close
              </button>
            </div>

            <form className="space-y-3 sm:space-y-4" onSubmit={handleSubmit}>
              {/* Hidden file input. */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={handleSelectFiles}
              />

              {/* Quick tools row. */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 sm:gap-3">
                <span className="font-semibold text-slate-600">
                  Quick tools:
                </span>

                {/* Emoji buttons. */}
                <div className="flex items-center gap-1">
                  {emojiPalette.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="rounded-full border border-accent-100 bg-white/80 px-2 py-1 text-base transition hover:border-accent-300 hover:bg-accent-50 hover:text-accent-600"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleAddEmoji(emoji)}
                      title={`Insert emoji ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                {/* Insert mention shortcut. */}
                <button
                  type="button"
                  className="rounded-full border border-accent-100 px-3 py-1 font-semibold transition hover:border-accent-300 hover:text-accent-600"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleAddMention}
                >
                  @someone
                </button>

                {/* Insert hashtag shortcut. */}
                <button
                  type="button"
                  className="rounded-full border border-accent-100 px-3 py-1 font-semibold transition hover:border-accent-300 hover:text-accent-600"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleAddHashtag}
                >
                  # tag
                </button>

                {/* Attachment button only in create mode. */}
                {!isEditing ? (
                  <>
                    <button
                      type="button"
                      className="rounded-full border border-accent-100 px-3 py-1 font-semibold transition hover:border-accent-300 hover:text-accent-600 disabled:opacity-60"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleAttachmentButton}
                      disabled={uploadStatus.loading}
                    >
                      📎 add picture/video
                    </button>
                    <span className="text-slate-400">
                      {attachments.length}/{MAX_ATTACHMENTS}
                    </span>
                  </>
                ) : null}
              </div>

              {/* Attachment preview block. */}
              {!isEditing && attachments.length > 0 && (
                <div className="space-y-2 rounded-2xl border border-accent-100 bg-white/85 p-3 sm:p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-600">
                      Attachments added ({attachments.length}/{MAX_ATTACHMENTS})
                    </p>
                    <button
                      type="button"
                      className="text-xs text-brand hover:text-brand-dark"
                      onClick={() => {
                        setAttachments([]);
                        setUploadStatus({ ...initialUploadStatus });
                      }}
                    >
                      Clear attachments
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {attachments.map((a) => {
                      const ct = a.content_type || "";
                      const isImage = ct.startsWith("image/");
                      const isVideo = ct.startsWith("video/");

                      return (
                        <div
                          key={a.id}
                          className="group relative overflow-hidden rounded-2xl border border-accent-100 bg-white shadow-sm"
                        >
                          <button
                            type="button"
                            className="absolute right-2 top-2 hidden rounded-full bg-black/60 px-2 py-1 text-xs text-white transition group-hover:flex"
                            onClick={() => handleRemoveAttachment(a.id)}
                            aria-label="Remove attachment"
                          >
                            ✕
                          </button>

                          {isImage ? (
                            <img
                              src={a.public_url || a.storage_url}
                              alt={a.original_name}
                              className="h-40 w-full bg-white object-contain"
                              loading="lazy"
                            />
                          ) : isVideo ? (
                            <video
                              controls
                              className="h-40 w-full bg-black object-contain"
                              src={a.public_url || a.storage_url}
                            />
                          ) : (
                            <a
                              href={a.public_url || a.storage_url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex h-40 w-full items-center justify-center text-xs text-brand underline"
                            >
                              {a.original_name}
                            </a>
                          )}

                          <div className="px-3 py-2 text-xs text-slate-500">
                            {a.original_name}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Upload status messages. */}
              {uploadStatus.loading && (
                <p className="text-xs text-slate-500">
                  Uploading attachments...
                </p>
              )}
              {uploadStatus.error && (
                <p className="text-xs text-red-500">{uploadStatus.error}</p>
              )}
              {uploadStatus.message && (
                <p className="text-xs text-emerald-600">
                  {uploadStatus.message}
                </p>
              )}

              {/* Main composer textarea. */}
              <textarea
                rows={4}
                value={composerContent}
                ref={textareaRef}
                onChange={handleComposerChange}
                onSelect={handleComposerSelect}
                onKeyDown={handleComposerKeyDown}
                onBlur={handleComposerBlur}
                className="w-full rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand focus:bg-white focus:outline-none"
              />

              {/* Profanity hint message. */}
              <ProfanityHint message={profanityMsg} />

              {/* Suggestion dropdown. */}
              {activeTrigger && (
                <div className="max-h-60 w-full overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-lg shadow-brand-100">
                  {suggestionsState.loading ? (
                    <p className="px-4 py-3 text-xs text-slate-400">
                      Searching...
                    </p>
                  ) : suggestionsState.error ? (
                    <p className="px-4 py-3 text-xs text-red-500">
                      {suggestionsState.error}
                    </p>
                  ) : suggestionsState.items.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-slate-400">
                      No matches yet. Keep typing.
                    </p>
                  ) : (
                    <ul className="divide-y divide-brand-50">
                      {suggestionsState.items.map((item, index) => {
                        const isActive = index === highlightIndex;
                        const label =
                          item.display ||
                          (item.type === "hashtag"
                            ? `#${item.insert}`
                            : item.insert);

                        const subtitle =
                          item.type === "mention"
                            ? item.meta?.role || item.meta?.email || ""
                            : item.count
                            ? `${item.count} mention(s)`
                            : "";

                        return (
                          <li key={`${item.type}-${item.insert}-${index}`}>
                            <button
                              type="button"
                              className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition ${
                                isActive
                                  ? "bg-brand-100 text-brand"
                                  : "text-slate-600 hover:bg-brand-50"
                              }`}
                              onMouseDown={(ev) => {
                                ev.preventDefault();
                                applySuggestion(item);
                              }}
                              onMouseEnter={() => setHighlightIndex(index)}
                            >
                              <span className="font-medium">{label}</span>
                              {subtitle ? (
                                <span className="text-xs text-slate-400">
                                  {subtitle}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

              {/* Submit feedback message. */}
              {(composerStatus.error || composerStatus.message) && (
                <Feedback
                  message={composerStatus.message}
                  error={composerStatus.error}
                />
              )}

              {/* Action buttons. */}
              <div className="flex justify-end gap-2 pb-1">
                <button
                  type="button"
                  className="rounded-full border border-brand-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300"
                  onClick={closeComposer}
                  disabled={composerStatus.loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="brand-button min-w-[120px]"
                  disabled={composerStatus.loading || uploadStatus.loading}
                >
                  {composerStatus.loading ? "Publish..." : "Publish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog. */}
      <ConfirmDialog
        open={deleteState.open}
        title="Delete Post"
        message="Are you sure you want to delete this post? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDeletePost}
        onCancel={cancelDeletePost}
        processing={deleteBusy}
        tone="danger"
      />

      {/* Course profile modal. */}
      {profileModal.open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/70 px-0 py-0 sm:items-start sm:px-4 sm:py-10">
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-brand-100 bg-white p-4 shadow-2xl shadow-brand-200 sm:max-h-[85vh] sm:max-w-3xl sm:rounded-3xl sm:p-6">
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-brand-50 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Course profile
                </p>
                <h2 className="text-lg font-bold text-slate-900">
                  {courseProfileTitle}
                </h2>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-400"
                  onClick={closeProfileModal}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-white shadow hover:bg-brand-dark"
                  onClick={handleEditProfile}
                >
                  {profileModal.profile ? "Edit profile" : "Complete profile"}
                </button>
              </div>
            </header>

            <section className="mt-5 min-h-[180px]">
              {profileModal.loading ? (
                <p className="text-sm text-slate-500">Loading profile…</p>
              ) : profileModal.error ? (
                <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {profileModal.error}
                </p>
              ) : profileModal.profile ? (
                <div className="space-y-5">
                  {[
                    {
                      title: "Demographic",
                      items: [
                        ["Gender", profileModal.profile.gender],
                        ["City", profileModal.profile.city],
                        ["Age Group", profileModal.profile.age_group],
                        [
                          "Education Level",
                          profileModal.profile.education_level,
                        ],
                        ["Income Level", profileModal.profile.income_level],
                      ],
                    },
                    {
                      title: "Psychographic",
                      items: [
                        ["Social Value", profileModal.profile.social_value],
                        ["Sociability", profileModal.profile.sociability],
                        ["Openness", profileModal.profile.openness],
                        [
                          "Preferred Content",
                          profileModal.profile.content_preference,
                        ],
                        [
                          "Interests",
                          (profileModal.profile.interests || []).join(", "),
                        ],
                      ],
                    },
                    {
                      title: "Behavioural",
                      items: [
                        [
                          "Shopping Frequency",
                          profileModal.profile.shopping_frequency,
                        ],
                        [
                          "Buying Behaviour",
                          profileModal.profile.buying_behavior,
                        ],
                        [
                          "Decision Factor",
                          profileModal.profile.decision_factor,
                        ],
                        [
                          "Shopping Preference",
                          profileModal.profile.shopping_preference,
                        ],
                      ],
                    },
                    {
                      title: "Digital Habits",
                      items: [
                        ["Digital Time", profileModal.profile.digital_time],
                        [
                          "Interaction Style",
                          profileModal.profile.interaction_style,
                        ],
                        [
                          "Influencer Type",
                          profileModal.profile.influencer_type,
                        ],
                      ],
                    },
                  ].map((section) => (
                    <div
                      key={section.title}
                      className="rounded-2xl border border-brand-50 bg-brand-50/40 p-4"
                    >
                      <h3 className="text-sm font-semibold text-slate-800">
                        {section.title}
                      </h3>
                      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {section.items.map(([label, value]) => (
                          <div
                            key={label}
                            className="rounded-xl border border-white bg-white/80 px-3 py-2"
                          >
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                              {label}
                            </dt>
                            <dd className="text-sm text-slate-800">
                              {value !== undefined &&
                              value !== null &&
                              value !== ""
                                ? value
                                : "—"}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50 px-4 py-5 text-sm text-slate-600">
                  You have not completed this course profile yet. Click{" "}
                  <span className="font-semibold text-brand">
                    Complete profile
                  </span>{" "}
                  to fill it in now.
                </div>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
