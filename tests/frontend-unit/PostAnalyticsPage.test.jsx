import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import PostAnalyticsPage from "../../frontend/src/pages/PostAnalyticsPage.jsx";
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
    <MemoryRouter initialEntries={["/courses/9/posts/101/analytics"]}>
      <Routes>
        <Route
          path="/courses/:courseId/posts/:postId/analytics"
          element={<PostAnalyticsPage />}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("PostAnalyticsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseApp.mockReturnValue({
      authUser: { id: 1, is_staff: true, is_superuser: false },
      authCheckComplete: true,
      pushToast: vi.fn(),
    });
    getJson.mockImplementation((url) => {
      if (url.includes("/segmentation")) {
        return Promise.resolve({
          segmentation: {
            available_lenses: [{ key: "interests", label: "Interests" }],
            coverage: { total_audience: 30 },
            lens_meta: { overlapping: true },
            compare_options: [{ post_id: 202, label: "Post #202" }],
            segments: [
              {
                key: "practical",
                label: "Practical learners",
                audience_count: 10,
                engaged_user_count: 7,
                metrics: { views: 20, likes: 8, comments: 4, engagement_rate: 0.7 },
              },
              {
                key: "theory",
                label: "Theory-first students",
                audience_count: 12,
                engaged_user_count: 3,
                metrics: { views: 12, likes: 2, comments: 1, engagement_rate: 0.25 },
              },
            ],
            insights: {
              summary_text: "Practical learners responded strongly.",
              top_segment: { label: "Practical learners" },
              under_engaged_segment: { label: "Theory-first students" },
              comparison_summary_text: "This post outperformed the comparison case for practical learners.",
            },
            comparison: {
              summary_text: "Practical learners engaged more with this post than the comparison post.",
              segments: [
                {
                  key: "practical",
                  label: "Practical learners",
                  post_metrics: { engagement_rate: 0.7 },
                  compare_metrics: { engagement_rate: 0.45 },
                  delta_engagement_rate: 0.25,
                },
              ],
            },
          },
        });
      }

      return Promise.resolve({
        totals: { likes: 10, comments: 5, views: 50 },
        range: { start: "2026-04-10", end: "2026-04-17" },
        series: {
          likes: [{ date: "2026-04-10", count: 1 }],
          comments: [{ date: "2026-04-10", count: 1 }],
          views: [{ date: "2026-04-10", count: 1 }],
        },
        sentiment: {
          counts: { positive: 2, neutral: 1, negative: 1 },
          percentages: { positive: 50, neutral: 25, negative: 25 },
          total_comments: 4,
        },
        hashtags: [
          {
            hashtag: "launch",
            cohort_size: 6,
            post: { likes: 10, comments: 5, views: 50 },
            average: { likes: 8, comments: 4, views: 40 },
          },
        ],
      });
    });
  });

  test("renders the explanation layer as stacked teaching modules with chart-first defaults", async () => {
    renderPage();

    expect(await screen.findByText(/why it performed this way/i)).toBeInTheDocument();
    expect(screen.getByText(/sentiment composition/i)).toBeInTheDocument();
    expect(screen.getByText(/audience segment response/i)).toBeInTheDocument();
    expect(screen.getByText(/relative performance/i)).toBeInTheDocument();
    expect(screen.getByText(/trend and momentum/i)).toBeInTheDocument();
    expect(screen.getByText(/comparison evidence/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /engagement rate/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.queryByRole("columnheader", { name: /engagement/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: /compare post/i })
    ).not.toBeInTheDocument();
  });

  test("reveals segment and comparison tables only when the local detail toggles are opened", async () => {
    renderPage();

    expect(await screen.findByText(/relative performance/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: /engagement/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: /compare post/i })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /view segment table/i }));
    expect(screen.getByRole("columnheader", { name: /engagement/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /view comparison details/i }));
    expect(screen.getByRole("columnheader", { name: /compare post/i })).toBeInTheDocument();
  });
});
