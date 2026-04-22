import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import CourseDashboardPage from "../../frontend/src/pages/admin/CourseDashboardPage.jsx";
import { useApp } from "../../frontend/src/context/AppContext";
import { getJson } from "../../frontend/src/lib/api";

vi.mock("../../frontend/src/context/AppContext", () => ({
  useApp: vi.fn(),
}));

vi.mock("../../frontend/src/lib/api", () => ({
  getJson: vi.fn(),
}));

vi.mock("../../frontend/src/pages/components/AuthenticatedShell", () => ({
  default: ({ title, subtitle, children }) => (
    <div>
      <div>{title}</div>
      <div>{subtitle}</div>
      <div>{children}</div>
    </div>
  ),
}));

const mockedUseApp = useApp;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/dashboard/courses/9"]}>
      <Routes>
        <Route
          path="/dashboard/courses/:courseId"
          element={<CourseDashboardPage />}
        />
        <Route path="/courses/:courseId" element={<div>Course Detail Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("CourseDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseApp.mockReturnValue({
      authUser: { id: 1, is_staff: true, is_superuser: false },
      authCheckComplete: true,
    });
    getJson.mockImplementation((url) => {
      if (url.includes("/segmentation")) {
        return Promise.resolve({
          segmentation: {
            available_lenses: [{ key: "interests", label: "Interests" }],
            insights: {
              summary_text:
                "Practical learners showed the strongest engagement for this course audience, while News responded least under the interests lens.",
              top_segment: {
                key: "practical",
                label: "Practical Learners",
                audience_count: 12,
                engaged_user_count: 8,
                metrics: { engagement_rate: 0.82 },
              },
              under_engaged_segment: {
                key: "news",
                label: "News",
                audience_count: 9,
                engaged_user_count: 2,
                metrics: { engagement_rate: 0.11 },
              },
            },
            segments: [
              {
                key: "practical",
                label: "Practical Learners",
                audience_count: 12,
                engaged_user_count: 8,
                metrics: { engagement_rate: 0.82 },
              },
              {
                key: "news",
                label: "News",
                audience_count: 9,
                engaged_user_count: 2,
                metrics: { engagement_rate: 0.11 },
              },
            ],
            posts: [
              {
                post_id: 101,
                label: "Case study: strong CTA",
                summary_text: "High response from practical learners.",
                likes: 4,
                comments: 3,
                views: 20,
                interactions: 7,
                top_segment: {
                  key: "practical",
                  label: "Practical Learners",
                  metrics: { likes: 50, comments: 40, engagement_rate: 0.82 },
                },
              },
              {
                post_id: 102,
                label: "Launch teaser with urgency",
                summary_text: "Strong response from deadline-driven audiences.",
                likes: 6,
                comments: 5,
                views: 18,
                interactions: 11,
                top_segment: {
                  key: "news",
                  label: "News",
                  metrics: { likes: 2, comments: 1, engagement_rate: 0.11 },
                },
              },
              {
                post_id: 103,
                label: "Student ambassador story",
                summary_text: "Good traction from community-oriented segments.",
                likes: 2,
                comments: 2,
                views: 15,
                interactions: 4,
                top_segment: {
                  key: "viral",
                  label: "Viral Segment",
                  metrics: { likes: 99, comments: 99, engagement_rate: 9.99 },
                },
              },
              {
                post_id: 104,
                label: "Behind the scenes edit",
                summary_text: "Moderate response from curious viewers.",
                likes: 5,
                comments: 4,
                views: 22,
                interactions: 9,
                top_segment: {
                  key: "curious",
                  label: "Curious Viewers",
                  metrics: { likes: 3, comments: 2, engagement_rate: 0.44 },
                },
              },
            ],
          },
        });
      }

      return Promise.resolve({
        course: {
          calculated_at: "2026-04-17T10:00:00Z",
          range_days: 111,
          range_start: "2026-01-01",
          range_end: "2026-04-22",
          course: {
            id: 9,
            course_code: "COMP9900",
            name: "Social Media Lab",
            term: "2026T1",
          },
          summary: {
            total_posts: 12,
            total_interactions: 100,
            registered_students: 35,
          },
          sentiment: {
            top_label: "positive",
            top_percent: 64.5,
            total_comments: 20,
            breakdown: {
              positive: 64.5,
              neutral: 25,
              negative: 10.5,
            },
          },
          students: [
            {
              user_id: 12,
              name: "Ada Lovelace",
              posts_total: 3,
              interactions_total: 18,
              change_percent: 22.5,
            },
            {
              user_id: 13,
              name: "Grace Hopper",
              posts_total: 2,
              interactions_total: 17,
              change_percent: 10,
            },
            {
              user_id: 14,
              name: "Alan Turing",
              posts_total: 2,
              interactions_total: 16,
              change_percent: 8,
            },
            {
              user_id: 15,
              name: "Katherine Johnson",
              posts_total: 2,
              interactions_total: 15,
              change_percent: 6,
            },
            {
              user_id: 16,
              name: "Donald Knuth",
              posts_total: 1,
              interactions_total: 14,
              change_percent: 4,
            },
            {
              user_id: 17,
              name: "Edsger Dijkstra",
              posts_total: 1,
              interactions_total: 10,
              change_percent: 2,
            },
          ],
          hashtags: [
            {
              hashtag: "campaign",
              total_posts: 4,
              total_interactions: 30,
              change_percent: 14.2,
            },
          ],
        },
      });
    });
  });

  test("renders a single-course dashboard layout while keeping drill-down sections", async () => {
    renderPage();

    expect(await screen.findByText("Course Dashboard")).toBeInTheDocument();
    expect(
      screen.getByText(/social media lab · comp9900 · 2026t1/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/entire course period/i)).toBeInTheDocument();
    expect(screen.getByText(/jan 1 - apr 22/i)).toBeInTheDocument();
    expect(screen.getByText(/^35$/)).toBeInTheDocument();
    expect(screen.getByText(/^8.3x$/)).toBeInTheDocument();
    expect(screen.getByText(/^1$/)).toBeInTheDocument();
    expect(screen.getByText(/^20$/)).toBeInTheDocument();
    expect(screen.getByText(/course activity overview/i)).toBeInTheDocument();
    expect(screen.getByText(/teaching highlights/i)).toBeInTheDocument();
    expect(screen.getByText(/student response concentration/i)).toBeInTheDocument();
    expect(screen.getByText(/audience response/i)).toBeInTheDocument();
    expect(screen.queryByText(/sentiment overview/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/recent activity/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ai summary/i)).not.toBeInTheDocument();
    expect(await screen.findByText(/representative posts/i)).toBeInTheDocument();
    expect(screen.getByText(/response leaders by student/i)).toBeInTheDocument();
    expect(screen.getByText(/response leaders by topic/i)).toBeInTheDocument();
    expect(screen.getByText(/view post analysis/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/dashboard date range/i)).not.toBeInTheDocument();
  });

  test("back button returns to the course page", async () => {
    renderPage();

    const backButton = await screen.findByRole("button", { name: /back/i });
    fireEvent.click(backButton);

    expect(await screen.findByText("Course Detail Page")).toBeInTheDocument();
  });

  test("shows the top three representative posts by top-level interactions and surfaces the totals on each card", async () => {
    renderPage();

    expect(await screen.findByText(/representative posts/i)).toBeInTheDocument();
    expect(screen.getByText(/launch teaser with urgency/i)).toBeInTheDocument();
    expect(screen.getByText(/behind the scenes edit/i)).toBeInTheDocument();
    expect(screen.getByText(/case study: strong cta/i)).toBeInTheDocument();
    expect(screen.queryByText(/student ambassador story/i)).not.toBeInTheDocument();
    expect(screen.getByText(/11 interactions/i)).toBeInTheDocument();
    expect(screen.getByText(/6 likes · 5 comments/i)).toBeInTheDocument();
    expect(screen.getByText(/9 interactions/i)).toBeInTheDocument();
    expect(screen.getByText(/5 likes · 4 comments/i)).toBeInTheDocument();
    expect(screen.getByText(/7 interactions/i)).toBeInTheDocument();
    expect(screen.getByText(/4 likes · 3 comments/i)).toBeInTheDocument();
    expect(screen.queryByText(/99 likes/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/view post analysis/i)).toHaveLength(3);
  });

  test("shows audience-fit insights from segmentation and removes grading-style labels", async () => {
    renderPage();

    expect(await screen.findByText(/audience response/i)).toBeInTheDocument();
    expect(screen.getByText(/practical learners/i)).toBeInTheDocument();
    expect(screen.getByText(/news/i)).toBeInTheDocument();
    expect(screen.getByText(/strongest match/i)).toBeInTheDocument();
    expect(screen.getByText(/needs attention/i)).toBeInTheDocument();
    expect(
      screen.getByText(/practical learners showed the strongest engagement/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/top student/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/top topic/i)).not.toBeInTheDocument();
  });

  test("uses the top five students plus Other in student response concentration", async () => {
    renderPage();

    expect(await screen.findByText(/student response concentration/i)).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
    expect(screen.getByText("Alan Turing")).toBeInTheDocument();
    expect(screen.getByText("Katherine Johnson")).toBeInTheDocument();
    expect(screen.getByText("Donald Knuth")).toBeInTheDocument();
    expect(screen.getByText("Other")).toBeInTheDocument();
    expect(screen.queryByText("Edsger Dijkstra")).not.toBeInTheDocument();
  });

  test("renders safe zero states for derived metrics and hides audience response when segmentation is unavailable", async () => {
    getJson.mockImplementation((url) => {
      if (url.includes("/segmentation")) {
        return Promise.reject(new Error("Failed to load representative posts."));
      }

      return Promise.resolve({
        course: {
          calculated_at: "2026-04-17T10:00:00Z",
          range_days: 111,
          range_start: "2026-01-01",
          range_end: "2026-04-22",
          course: {
            id: 9,
            course_code: "COMP9900",
            name: "Social Media Lab",
            term: "2026T1",
          },
          summary: {
            total_posts: 0,
            total_interactions: 0,
            registered_students: 35,
          },
          sentiment: {
            top_label: "neutral",
            top_percent: 0,
            total_comments: 0,
            breakdown: {
              positive: 0,
              neutral: 0,
              negative: 0,
            },
          },
          students: [],
          hashtags: [],
        },
      });
    });

    renderPage();

    expect(await screen.findByText("Course Dashboard")).toBeInTheDocument();
    expect(screen.getByText(/^0.0x$/)).toBeInTheDocument();
    expect(screen.getAllByText(/^0$/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/audience response/i)).not.toBeInTheDocument();
    expect(screen.getByText(/failed to load representative posts\./i)).toBeInTheDocument();
  });
});
