import {
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowRight,
  Clock3,
  Flame,
  Loader2,
  Search as SearchIcon,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import AuthenticatedShell from "./components/AuthenticatedShell";
import { getJson } from "../lib/api";
import { HOT_SEARCHES } from "./searchData";

const HISTORY_STORAGE_KEY = "bread:global-search-history";
const MAX_HISTORY_ITEMS = 10;

function readHistory() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean)
      .slice(0, MAX_HISTORY_ITEMS);
  } catch {
    return [];
  }
}

function writeHistory(items) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    HISTORY_STORAGE_KEY,
    JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS))
  );
}

function normalizeQuery(value) {
  return value.trim().replace(/\s+/g, " ");
}

function highlightText(text, query) {
  if (!query) return text;
  const tokens = Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean)
    )
  );
  if (!tokens.length) return text;

  const escaped = tokens.map((token) =>
    token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const pattern = new RegExp(`(${escaped.join("|")})`, "ig");
  const parts = String(text).split(pattern);

  return parts.map((part, index) => {
    const matched = tokens.some((token) => token === part.toLowerCase());
    if (!matched) return <span key={`${part}-${index}`}>{part}</span>;
    return (
      <mark
        key={`${part}-${index}`}
        className="rounded bg-accent-100 px-0.5 text-inherit"
      >
        {part}
      </mark>
    );
  });
}

function formatResultTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-AU", {
    month: "short",
    day: "numeric",
  });
}

function buildCourseResults(query, courses) {
  const normalized = normalizeQuery(query).toLowerCase();
  if (!normalized) return [];
  const tokens = normalized.split(" ").filter(Boolean);

  return (courses || [])
    .map((course) => ({
      id: `course-${course.id}`,
      type: "course",
      title: `${course.course_code} ${course.name}`.trim(),
      snippet: course.profile_completed
        ? "Open the course community and continue browsing discussions."
        : "Complete your course profile first, then continue into the class feed.",
      href: course.profile_completed
        ? `/courses/${course.id}`
        : `/courses/${course.id}/profile`,
      courseName: course.term || "Course",
      authorName: course.role || "Member",
      createdAt: "",
      rankLabel: "From your courses",
    }))
    .filter((item) => {
      const haystack = [item.title, item.courseName, item.authorName, "course"]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return tokens.some((token) => haystack.includes(token));
    });
}

function SearchResultCard({ item, query }) {
  const typeLabel =
    item.type === "course" ? "Course" : item.type === "tag" ? "Tag" : "Post";

  return (
    <Link
      to={item.href}
      className="group block rounded-[1.6rem] border border-brand-100 bg-white px-4 py-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[0_12px_28px_rgba(249,115,22,0.12)] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 sm:px-5"
      aria-label={`Open search result ${item.title}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-[28px] items-center rounded-full bg-brand-50 px-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700">
              {typeLabel}
            </span>
            {item.rankLabel ? (
              <span className="inline-flex min-h-[28px] items-center rounded-full bg-accent-50 px-2.5 text-[11px] font-semibold text-accent-700">
                {item.rankLabel}
              </span>
            ) : null}
          </div>
          <h2 className="text-base font-semibold leading-6 text-slate-900 sm:text-lg">
            {highlightText(item.title, query)}
          </h2>
        </div>
        <ArrowRight
          className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand"
          aria-hidden="true"
        />
      </div>

      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
        {highlightText(item.snippet, query)}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-500">
        {item.courseName ? (
          <span className="truncate">
            {highlightText(item.courseName, query)}
          </span>
        ) : null}
        {item.authorName ? (
          <span className="truncate">
            {highlightText(item.authorName, query)}
          </span>
        ) : null}
        {item.createdAt ? <span>{formatResultTime(item.createdAt)}</span> : null}
      </div>
    </Link>
  );
}

export default function SearchPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { authUser, authCheckComplete, courses, fetchCourses } = useApp();

  const inputId = useId();
  const inputRef = useRef(null);
  const queryFromUrl = searchParams.get("q") || "";
  const [inputValue, setInputValue] = useState(queryFromUrl);
  const [historyItems, setHistoryItems] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hotSearches, setHotSearches] = useState(HOT_SEARCHES);

  useEffect(() => {
    if (!authCheckComplete) return;
    if (!authUser) {
      navigate("/login", { replace: true });
      return;
    }
    fetchCourses().catch(() => {});
  }, [authCheckComplete, authUser, fetchCourses, navigate]);

  useEffect(() => {
    setInputValue(queryFromUrl);
  }, [queryFromUrl]);

  useEffect(() => {
    setHistoryItems(readHistory());
  }, []);

  useEffect(() => {
    if (!authCheckComplete || !authUser) return;
    inputRef.current?.focus();
  }, [authCheckComplete, authUser]);

  // Context: Compute shared values once so all branches use the same normalized inputs.
  useEffect(() => {
    if (!authUser) return;
    getJson("/api/search/suggestions/")
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setHotSearches(data);
      })
      .catch(() => {});
  }, [authUser]);

  // Context: Compute shared values once so all branches use the same normalized inputs.
  useEffect(() => {
    if (!queryFromUrl || !authUser) {
      setSearchResults([]);
      return;
    }
    const controller = new AbortController();
    setIsSearching(true);

    getJson(`/api/search/?q=${encodeURIComponent(queryFromUrl)}`)
      .then((data) => {
        if (controller.signal.aborted) return;
        const courseResults = buildCourseResults(queryFromUrl, courses.joined);
        setSearchResults([...courseResults, ...(data.results || [])]);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        // Context: Compute shared values once so all branches use the same normalized inputs.
        setSearchResults(buildCourseResults(queryFromUrl, courses.joined));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsSearching(false);
      });

    return () => controller.abort();
  }, [queryFromUrl, authUser, courses.joined]);

  const hasCommittedQuery = normalizeQuery(queryFromUrl).length > 0;

  const updateHistory = (value) => {
    const normalized = normalizeQuery(value);
    if (!normalized) return;
    const nextItems = [
      normalized,
      ...historyItems.filter(
        (item) => item.toLowerCase() !== normalized.toLowerCase()
      ),
    ].slice(0, MAX_HISTORY_ITEMS);
    setHistoryItems(nextItems);
    writeHistory(nextItems);
  };

  const commitSearch = (nextValue) => {
    const normalized = normalizeQuery(nextValue);
    const nextParams = new URLSearchParams(location.search);

    if (!normalized) {
      nextParams.delete("q");
      setSearchParams(nextParams, { replace: false });
      setInputValue("");
      return;
    }

    nextParams.set("q", normalized);
    setSearchParams(nextParams, { replace: false });
    setInputValue(normalized);
    updateHistory(normalized);
  };

  const removeHistoryItem = (value) => {
    const nextItems = historyItems.filter(
      (item) => item.toLowerCase() !== value.toLowerCase()
    );
    setHistoryItems(nextItems);
    writeHistory(nextItems);
  };

  const clearHistory = () => {
    setHistoryItems([]);
    writeHistory([]);
  };

  const handleInputKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitSearch(inputValue);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setInputValue("");
    }
  };

  if (!authCheckComplete || !authUser) {
    return null;
  }

  return (
    <AuthenticatedShell
      title="Global Search"
      subtitle="Quickly find discussions, course spaces, and trending topics across Bread."
    >
      <div className="space-y-6 sm:space-y-7">
        <section
          aria-labelledby="global-search-heading"
          className="overflow-hidden rounded-[1.8rem] border border-brand-100 bg-[linear-gradient(180deg,rgba(255,250,245,0.98)_0%,rgba(255,255,255,0.98)_100%)] px-4 py-4 shadow-[0_18px_38px_rgba(249,115,22,0.08)] sm:px-5 sm:py-5"
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1">
                <p
                  id="global-search-heading"
                  className="text-lg font-semibold tracking-tight text-slate-900 sm:text-[1.4rem]"
                >
                  Search the community in one place
                </p>
                
              </div>
              {hasCommittedQuery ? (
                <p
                  aria-live="polite"
                  className="flex items-center gap-2 text-sm font-medium text-slate-500"
                >
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin text-brand-500" />
                  ) : (
                    <>
                      {searchResults.length} result
                      {searchResults.length === 1 ? "" : "s"} for &ldquo;{queryFromUrl}&rdquo;
                    </>
                  )}
                </p>
              ) : null}
            </div>

            <div className="rounded-[1.7rem] border border-brand-200 bg-white p-2 shadow-[0_12px_30px_rgba(249,115,22,0.10)]">
              <form
                role="search"
                aria-label="Global search form"
                onSubmit={(event) => {
                  event.preventDefault();
                  commitSearch(inputValue);
                }}
                className="flex flex-col gap-2 sm:flex-row"
              >
                <label htmlFor={inputId} className="sr-only">
                  Search site content
                </label>
                <div className="flex min-h-[56px] flex-1 items-center gap-3 rounded-[1.2rem] px-3 sm:min-h-[60px] sm:px-4">
                  <SearchIcon
                    className="h-5 w-5 shrink-0 text-brand-500"
                    aria-hidden="true"
                  />
                  <input
                    id={inputId}
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                    onKeyDown={handleInputKeyDown}
                    placeholder="Search posts, course spaces, hashtags, or recurring topics"
                    className="w-full bg-transparent text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none sm:text-base"
                    autoComplete="off"
                    enterKeyHint="search"
                    aria-describedby="search-helper-text"
                  />
                  {inputValue ? (
                    <button
                      type="button"
                      onClick={() => {
                        setInputValue("");
                        if (hasCommittedQuery) {
                          commitSearch("");
                        }
                        inputRef.current?.focus();
                      }}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-brand-50 hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                      aria-label="Clear search query"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                <button
                  type="submit"
                  className="inline-flex min-h-[52px] items-center justify-center rounded-[1.2rem] bg-brand px-5 text-sm font-semibold text-white shadow-brand transition hover:bg-brand-dark focus:outline-none sm:min-h-[60px] sm:px-6"
                >
                  Search
                </button>
              </form>
            </div>
          </div>
        </section>

        {hasCommittedQuery ? (
          <section aria-labelledby="search-results-heading" className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2
                id="search-results-heading"
                className="text-base font-semibold text-slate-800 sm:text-lg"
              >
                Results
              </h2>
              {historyItems.length > 0 ? (
                <button
                  type="button"
                  onClick={clearHistory}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-brand-200 bg-white px-4 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear history
                </button>
              ) : null}
            </div>

            {isSearching ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
              </div>
            ) : searchResults.length > 0 ? (
              <div className="grid gap-3">
                {searchResults.map((item) => (
                  <SearchResultCard
                    key={item.id}
                    item={item}
                    query={queryFromUrl}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-[1.7rem] border border-dashed border-brand-200 bg-brand-50/70 px-5 py-8 text-center sm:px-8">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                  <Sparkles
                    className="h-5 w-5 text-brand-500"
                    aria-hidden="true"
                  />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-slate-900">
                  No direct matches yet
                </h2>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
                  Try a shorter phrase, a hashtag, or jump back in through one of the
                  trending community topics below.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  {hotSearches.slice(0, 4).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => commitSearch(item.keyword)}
                      className="inline-flex min-h-[40px] items-center rounded-full border border-brand-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                    >
                      {item.keyword}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        ) : (
          <div className="space-y-5">
            <section
              aria-labelledby="search-history-heading"
              className="rounded-[1.7rem] border border-brand-100 bg-white px-4 py-4 shadow-sm sm:px-5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <h2
                    id="search-history-heading"
                    className="text-base font-semibold text-slate-900"
                  >
                    Recent searches
                  </h2>
                  <p className="text-sm text-slate-500">
                    Pick up where you left off.
                  </p>
                </div>
                {historyItems.length > 0 ? (
                  <button
                    type="button"
                    onClick={clearHistory}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-brand-200 bg-white px-4 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear all
                  </button>
                ) : null}
              </div>

              {historyItems.length === 0 ? (
                <div className="mt-5 rounded-[1.4rem] border border-dashed border-brand-200 bg-brand-50/70 px-4 py-6 text-sm leading-6 text-slate-500">
                  Search once and your recent topics will show up here for fast re-entry.
                </div>
              ) : (
                <ul
                  className="mt-5 grid gap-2 sm:grid-cols-2"
                  aria-label="Recent search list"
                >
                  {historyItems.map((item) => (
                    <li key={item}>
                      <div className="flex min-h-[52px] items-center gap-2 rounded-2xl border border-brand-100 bg-brand-50/50 p-1">
                        <button
                          type="button"
                          onClick={() => commitSearch(item)}
                          title={item}
                          aria-label={`Search again for ${item}`}
                          className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3 rounded-[1rem] px-3 text-left text-sm text-slate-700 transition hover:bg-white hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                        >
                          <Clock3
                            className="h-4 w-4 shrink-0 text-slate-400"
                            aria-hidden="true"
                          />
                          <span className="truncate">{item}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeHistoryItem(item)}
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-white hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                          aria-label={`Remove recent search ${item}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section
              aria-labelledby="hot-search-heading"
              className="rounded-[1.7rem] border border-brand-100 bg-[linear-gradient(180deg,rgba(255,247,237,0.96)_0%,rgba(255,255,255,0.98)_100%)] px-4 py-4 shadow-sm sm:px-5"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-500 shadow-sm">
                  <Flame className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <h2
                    id="hot-search-heading"
                    className="text-base font-semibold text-amber-700"
                  >
                    Hot right now
                  </h2>
                  <p className="text-sm text-slate-500">
                    Fast paths into the most active community topics.
                  </p>
                </div>
              </div>

              <ol className="mt-5 space-y-2">
                {hotSearches.map((item, index) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => commitSearch(item.keyword)}
                      className="group flex min-h-[64px] w-full items-start gap-3 rounded-[1.2rem] border border-transparent px-3 py-3 text-left transition hover:border-brand-200 hover:bg-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                      aria-label={`Search hot topic ${item.keyword}`}
                    >
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-brand-600 shadow-sm">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-semibold text-slate-900">
                            {item.keyword}
                          </span>
                          <span className="shrink-0 text-xs font-medium text-slate-400">
                            {item.hitCount} hits
                          </span>
                        </span>
                        <span className="mt-1 line-clamp-2 block text-sm leading-5 text-slate-500">
                          {item.blurb}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </div>
    </AuthenticatedShell>
  );
}
