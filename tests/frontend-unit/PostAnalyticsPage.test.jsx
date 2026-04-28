import { fireEvent, render, screen, within } from "@testing-library/react";
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

const mockedAuthenticatedShell = vi.fn(({ title, subtitle, children }) => (
  <div>
    <div>{title}</div>
    <div>{subtitle}</div>
    <div>{children}</div>
  </div>
));

vi.mock("../../frontend/src/pages/components/AuthenticatedShell", () => ({
  default: (props) => (
    <div>
      {mockedAuthenticatedShell(props)}
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
                  post_metrics: { likes: 8, comments: 4, engagement_rate: 0.7 },
                  compare_metrics: { likes: 5, comments: 2, engagement_rate: 0.45 },
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
    expect(screen.getAllByRole("button", { name: /total engagement/i })).toHaveLength(2);
    screen.getAllByRole("button", { name: /total engagement/i }).forEach((button) => {
      expect(button).toHaveAttribute("aria-pressed", "true");
    });
    expect(screen.queryAllByRole("button", { name: /engagement rate/i })).toHaveLength(0);
    expect(screen.queryByRole("columnheader", { name: /engagement/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: /compare post/i })
    ).not.toBeInTheDocument();
    expect(mockedAuthenticatedShell).toHaveBeenCalledWith(
      expect.objectContaining({ hideSidebar: true, wideContent: true })
    );
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

    const comparisonCard = screen.getByText(/comparison evidence/i).closest("section");
    fireEvent.change(within(comparisonCard).getByRole("combobox"), { target: { value: "202" } });
    // The comparison summary renders after the compare selection is applied.
    expect(await screen.findByText(/biggest total engagement gap/i)).toBeInTheDocument();
    fireEvent.click(within(comparisonCard).getByRole("button", { name: /view comparison details/i }));
    expect(screen.getByRole("columnheader", { name: /compare post/i })).toBeInTheDocument();
  });

  test("renders a segment pie breakdown that follows the selected metric", async () => {
    renderPage();

    expect(await screen.findByText(/audience segment response/i)).toBeInTheDocument();
    const audienceCard = screen.getByText(/audience segment response/i).closest("section");
    expect(screen.getByText(/^segment share$/i)).toBeInTheDocument();
    expect(screen.getByText(/based on total engagement/i)).toBeInTheDocument();
    expect(screen.getByText(/^15$/i)).toBeInTheDocument();
    expect(screen.queryByText(/combined visible value/i)).not.toBeInTheDocument();

    // The card should surface the strongest/weakest segment labels.
    expect(within(audienceCard).getAllByText("Practical learners").length).toBeGreaterThan(0);

    fireEvent.click(within(audienceCard).getByRole("button", { name: /^likes$/i }));

    expect(screen.getByText(/based on likes/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^10$/i).length).toBeGreaterThan(0);
    expect(within(audienceCard).getAllByText("Practical learners").length).toBeGreaterThan(0);
  });

  test("uses total engagement as the default comparison metric and hides engagement rate", async () => {
    renderPage();

    expect(await screen.findByText(/comparison evidence/i)).toBeInTheDocument();
    const comparisonCard = screen.getByText(/comparison evidence/i).closest("section");
    expect(within(comparisonCard).getByRole("button", { name: /total engagement/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(within(comparisonCard).queryByRole("button", { name: /engagement rate/i })).not.toBeInTheDocument();

    fireEvent.change(within(comparisonCard).getByRole("combobox"), { target: { value: "202" } });

    expect(await screen.findByText(/biggest total engagement gap/i)).toBeInTheDocument();
    expect(screen.getByText(/drawing 5 more than the compare post/i)).toBeInTheDocument();
    expect(within(comparisonCard).getAllByText("+5").length).toBeGreaterThan(0);
  });
});
