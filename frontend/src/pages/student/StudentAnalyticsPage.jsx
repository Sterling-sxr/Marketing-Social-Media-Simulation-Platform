import AuthenticatedShell from "../components/AuthenticatedShell";

// ======================= Mock analytics data (MVP) =======================
// NOTE: All data is mocked on the frontend for demo purposes only.
// Structure:
// {
//   summary: { totalPosts, totalLikes, totalComments, totalShares },
//   engagementTrend: {...},
//   topPosts: [...],
//   audienceInsights: { targetAudience, strongestEngagedAudience, matchLevel, breakdown: [...] },
//   bestTimeToPost: {...},
//   contentPatterns: [...],
//   suggestions: [...],
//   aiInsight: {...},
// }
const mockAnalytics = {
  summary: {
    totalPosts: 18,
    totalLikes: 342,
    totalComments: 97,
    totalShares: 54,
  },
  engagementTrend: {
    changePercent: 12,
    direction: "up",
    windowLabel: "vs last week",
    narrative:
      "Your overall engagement is trending up compared with last week.",
    // Simple mock series for potential future sparkline use
    series: [4, 5, 6, 5, 7, 7.5, 8],
  },
  topPosts: [
    {
      id: 1,
      content:
        "Explaining gradient descent with a bread-slicing analogy. Short, visual and practical.",
      createdAt: "2025-09-10T10:15:00Z",
      likes: 120,
      comments: 34,
      shares: 18,
      engagementScore: 9.2,
    },
    {
      id: 2,
      content:
        "Reflection on our first group project using AI tools to coordinate tasks and brainstorm.",
      createdAt: "2025-09-08T09:32:00Z",
      likes: 86,
      comments: 28,
      shares: 12,
      engagementScore: 8.4,
    },
    {
      id: 3,
      content:
        "Three things I changed in my posts that instantly improved comments from classmates.",
      createdAt: "2025-09-04T14:40:00Z",
      likes: 64,
      comments: 19,
      shares: 9,
      engagementScore: 7.6,
    },
  ],
  audienceInsights: {
    targetAudience: "First– and second–year CS students interested in AI",
    strongestEngagedAudience:
      "AI‑curious undergrads who prefer concise, example‑driven posts",
    matchLevel: "High",
    breakdown: [
      { persona: "AI Explorer", percentage: 42 },
      { persona: "Time‑poor Student", percentage: 27 },
      { persona: "Theory Lover", percentage: 18 },
      { persona: "Career Planner", percentage: 13 },
    ],
  },
  bestTimeToPost: {
    bestHourLabel: "7 PM",
    summary: "Most engagement comes from posts published in the early evening.",
    slots: ["5–7 PM", "7–9 PM", "Noon break"],
  },
  contentPatterns: [
    {
      id: "short-examples",
      label: "Short, example‑driven posts",
      engagementDelta: "+32%",
      bestFor: ["AI Explorer", "Time‑poor Student"],
      note: "2–3 sentence scenario posts with a concrete takeaway perform significantly better than long theory dumps.",
    },
    {
      id: "reflection",
      label: "Personal reflections",
      engagementDelta: "+18%",
      bestFor: ["Theory Lover", "Career Planner"],
      note: "Posts that start with “What I learned when…” invite more thoughtful comments, especially from reflection‑oriented personas.",
    },
    {
      id: "questions",
      label: "Question‑first posts",
      engagementDelta: "+24%",
      bestFor: ["AI Explorer"],
      note: "Opening with a clear question (“What would you try next?”) leads to more replies than statements or announcements.",
    },
  ],
  suggestions: [
    {
      id: "short-form",
      title: "Keep posts short and skimmable",
      detail:
        "Your highest‑engagement posts are under 150 words and use bullet points. Turn long explanations into short, scannable sections.",
      focus: "Format",
    },
    {
      id: "examples",
      title: "Anchor concepts in concrete examples",
      detail:
        "Posts that open with a simple example or story get around 1.8× more comments from AI Explorer and Time‑poor personas.",
      focus: "Content structure",
    },
    {
      id: "call-to-action",
      title: "Finish with a clear question",
      detail:
        "Ending with a question like “What would you try next?” consistently increases comment rate for your audience personas.",
      focus: "Engagement",
    },
    {
      id: "persona-match",
      title: "Post more content for AI Explorers",
      detail:
        "Most engagement comes from the AI Explorer persona. Share more small experiments, tool comparisons and practical AI tips.",
      focus: "Audience",
    },
  ],
  aiInsight: {
    title: "AI Insight",
    message:
      "Your AI Explorer and Time‑poor Student personas engage most with concise, example‑driven posts published in the evening. Turning long notes into short, scenario‑based posts can unlock more comments.",
  },
};

// =============================== Helpers =================================
function formatDate(isoString) {
  if (!isoString) return "—";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ============================= UI components =============================
function SummaryCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-brand-100 bg-white px-4 py-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-brand">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-extrabold text-slate-900">{value}</p>
    </div>
  );
}

function EngagementTrendSection({ trend }) {
  const sign = trend.changePercent >= 0 ? "+" : "−";
  const absPercent = Math.abs(trend.changePercent);

  return (
    <section className="rounded-3xl border border-brand-100 bg-white p-5 shadow-soft">
      <header className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Engagement Trend
          </h2>
          <p className="text-xs text-slate-500">{trend.windowLabel}</p>
        </div>
        <div
          className={`inline-flex items-baseline gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
            trend.direction === "up"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-600"
          }`}
        >
          <span aria-hidden>{trend.direction === "up" ? "⬆️" : "⬇️"}</span>
          <span>
            {sign}
            {absPercent}%
          </span>
        </div>
      </header>
      <p className="mb-3 text-xs text-slate-600">{trend.narrative}</p>
      {/* Lightweight sparkline-style placeholder (no chart library) */}
      <div className="flex items-end gap-1.5 rounded-2xl bg-gradient-to-r from-brand-50 via-white to-accent-50 px-3 py-2">
        {trend.series.map((value, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <div
            key={index}
            className="flex-1 rounded-full bg-brand-200/70"
            style={{ height: `${20 + value * 6}px` }}
          />
        ))}
      </div>
    </section>
  );
}

function TopPostsSection({ posts }) {
  return (
    <section className="rounded-3xl border border-brand-100 bg-white p-6 shadow-soft">
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Top Performing Posts
        </h2>
        <p className="text-xs text-slate-500">
          Posts with the highest combination of likes, comments and shares.
        </p>
      </header>
      <div className="space-y-5">
        {posts.map((post) => (
          <article
            key={post.id}
            className="flex flex-col gap-3 rounded-2xl border border-brand-100/80 bg-gradient-to-r from-brand-50/80 via-white to-accent-50/80 p-5 md:p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-brand"
          >
            {/* 第一层：内容摘要（视觉主角） */}
            <div className="space-y-1.5 border-l-2 border-brand-200/70 pl-3">
              <p className="text-sm font-semibold text-slate-900 line-clamp-3">
                {post.content}
              </p>
              {/* 第二层：发布时间 */}
              <p className="text-xs text-slate-500">
                Posted on {formatDate(post.createdAt)}
              </p>
            </div>

            {/* 第三层：轻量 inline metrics（likes / comments / shares） */}
            <div className="mt-1 flex flex-wrap items-end gap-x-6 gap-y-2 text-xs text-slate-500 sm:text-[13px]">
              <div className="flex flex-col">
                <span className="flex items-center gap-1">
                  <span className="text-sm" aria-hidden>
                    👍
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {post.likes}
                  </span>
                </span>
                <span className="mt-0.5 text-[11px] uppercase tracking-wide">
                  Likes
                </span>
              </div>
              <div className="flex flex-col">
                <span className="flex items-center gap-1">
                  <span className="text-sm" aria-hidden>
                    💬
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {post.comments}
                  </span>
                </span>
                <span className="mt-0.5 text-[11px] uppercase tracking-wide">
                  Comments
                </span>
              </div>
              <div className="flex flex-col">
                <span className="flex items-center gap-1">
                  <span className="text-sm" aria-hidden>
                    🔁
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {post.shares}
                  </span>
                </span>
                <span className="mt-0.5 text-[11px] uppercase tracking-wide">
                  Shares
                </span>
              </div>
            </div>

            {/* 第四层：Engagement score 作为主要指标高亮展示 */}
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-gradient-to-r from-brand-100/90 via-accent-50/90 to-emerald-50/90 px-4 py-2">
              <span className="text-lg" aria-hidden>
                🔥
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">
                Score
              </span>
              <span className="text-2xl font-black leading-none text-brand-900">
                {post.engagementScore.toFixed(1)}
              </span>
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Engagement
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AudienceInsightsSection({ insights }) {
  const totalPercent = insights.breakdown.reduce(
    (sum, item) => sum + item.percentage,
    0
  );

  return (
    <section className="rounded-3xl border border-brand-100 bg-white p-6 shadow-soft">
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Audience Insights
        </h2>
        <p className="text-xs text-slate-500">
          AI audience / persona groups that are most engaged with your content.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-[1.1fr_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-brand-50 bg-brand-50/80 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">
              Target audience
            </p>
            <p className="mt-1 text-sm text-slate-900">
              {insights.targetAudience}
            </p>
          </div>
          <div className="rounded-2xl border border-accent-50 bg-accent-50/80 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-700">
              Strongest engaged audience
            </p>
            <p className="mt-1 text-sm text-slate-900">
              {insights.strongestEngagedAudience}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-50 bg-emerald-50/80 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
              Match level
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {insights.matchLevel}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Audience breakdown
          </p>
          <div className="space-y-2">
            {insights.breakdown.map((item) => {
              const widthPercent =
                totalPercent > 0
                  ? Math.max(6, (item.percentage / totalPercent) * 100)
                  : 0;
              return (
                <div
                  key={item.persona}
                  className="space-y-1 rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">
                      {item.persona}
                    </span>
                    <span className="font-semibold text-brand-700">
                      {item.percentage}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-300 via-accent-300 to-emerald-300"
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function StrategySuggestionsSection({ suggestions }) {
  return (
    <section className="rounded-3xl border border-brand-100 bg-white p-6 shadow-soft">
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Strategy Suggestions
        </h2>
        <p className="text-xs text-slate-500">
          Content optimisation ideas based on how your audience currently
          responds to different posts.
        </p>
      </header>
      <div className="grid gap-3 md:grid-cols-2">
        {suggestions.map((item) => (
          <article
            key={item.id}
            className="flex flex-col justify-between rounded-2xl border border-brand-100/80 bg-gradient-to-br from-white via-brand-50/70 to-accent-50/70 p-4"
          >
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                {item.focus}
              </p>
              <h3 className="text-sm font-semibold text-slate-900">
                {item.title}
              </h3>
              <p className="text-xs leading-relaxed text-slate-600">
                {item.detail}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ContentPerformancePatternsSection({ patterns }) {
  return (
    <section className="rounded-3xl border border-brand-100 bg-white p-6 shadow-soft">
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Content Performance Patterns
        </h2>
        <p className="text-xs text-slate-500">
          What types of posts currently resonate most with your audience.
        </p>
      </header>
      <ul className="space-y-3">
        {patterns.map((pattern) => (
          <li
            key={pattern.id}
            className="rounded-2xl border border-brand-100/80 bg-gradient-to-r from-white via-brand-50/60 to-accent-50/60 p-4"
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">
                  {pattern.label}
                </p>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Best for:{" "}
                  <span className="font-semibold text-brand-700">
                    {pattern.bestFor.join(", ")}
                  </span>
                </p>
              </div>
              <div className="mt-1 inline-flex items-baseline gap-2 rounded-full border border-emerald-100 bg-emerald-50/80 px-3 py-1.5 text-xs font-semibold text-emerald-700 md:mt-0">
                <span aria-hidden>📈</span>
                <span>{pattern.engagementDelta}</span>
                <span className="text-[10px] uppercase tracking-wide text-emerald-800/80">
                  vs your average
                </span>
              </div>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              {pattern.note}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ============================= Page component ============================
export default function StudentAnalyticsPage() {
  const {
    summary,
    engagementTrend,
    topPosts,
    audienceInsights,
    bestTimeToPost,
    contentPatterns,
    suggestions,
    aiInsight,
  } = mockAnalytics;

  return (
    <AuthenticatedShell
      title="My Analytics"
      subtitle="Understand how your posts perform and improve your engagement strategy."
    >
      {/* 1. Summary cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total Posts" value={summary.totalPosts} />
        <SummaryCard label="Total Likes" value={summary.totalLikes} />
        <SummaryCard label="Total Comments" value={summary.totalComments} />
        <SummaryCard label="Total Shares" value={summary.totalShares} />
      </section>

      {/* 1b. Engagement trend + Best time to post */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <EngagementTrendSection trend={engagementTrend} />
        <section className="rounded-3xl border border-brand-100 bg-white p-5 shadow-soft">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Best Time to Post
          </h2>
          <p className="mt-2 text-xs text-slate-500">
            Based on your recent high‑engagement posts.
          </p>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Best hour
            </span>
            <span className="text-xl font-extrabold text-brand-800">
              {bestTimeToPost.bestHourLabel}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-600">
            {bestTimeToPost.summary}
          </p>
          {bestTimeToPost.slots?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {bestTimeToPost.slots.map((slot) => (
                <span
                  key={slot}
                  className="inline-flex items-center rounded-full border border-brand-100 bg-brand-50/70 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-700"
                >
                  {slot}
                </span>
              ))}
            </div>
          ) : null}
        </section>
      </section>

      {/* 2 & 3. Top posts + audience insights */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <TopPostsSection posts={topPosts} />
        <AudienceInsightsSection insights={audienceInsights} />
      </section>

      {/* 3b. AI Insight */}
      <section className="rounded-3xl border border-brand-100 bg-gradient-to-r from-brand-50/80 via-white to-accent-50/80 p-5 shadow-soft">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-800">
          {aiInsight.title}
        </h2>
        <p className="mt-2 text-xs text-slate-700 leading-relaxed">
          {aiInsight.message}
        </p>
      </section>

      {/* 4. Content patterns */}
      <ContentPerformancePatternsSection patterns={contentPatterns} />

      {/* 5. Strategy suggestions */}
      <StrategySuggestionsSection suggestions={suggestions} />
    </AuthenticatedShell>
  );
}
