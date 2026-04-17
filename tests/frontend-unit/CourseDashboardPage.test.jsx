import { render, screen } from "@testing-library/react";
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
            posts: [
              {
                post_id: 101,
                label: "Case study: strong CTA",
                summary_text: "High response from practical learners.",
              },
            ],
          },
        });
      }

      return Promise.resolve({
        course: {
          calculated_at: "2026-04-17T10:00:00Z",
          course: {
            id: 9,
            course_code: "COMP9900",
            name: "Social Media Lab",
          },
          summary: {
            total_posts: 12,
            total_interactions: 100,
            registered_students: 35,
          },
          students: [
            {
              user_id: 12,
              name: "Ada Lovelace",
              posts_total: 3,
              interactions_total: 18,
            },
          ],
          hashtags: [
            {
              hashtag: "campaign",
              total_posts: 4,
              total_interactions: 30,
            },
          ],
        },
      });
    });
  });

  test("centers representative posts and exploration entry points instead of course-level explanation", async () => {
    renderPage();

    expect(await screen.findByText(/representative posts/i)).toBeInTheDocument();
    expect(screen.getByText(/explore by student/i)).toBeInTheDocument();
    expect(screen.getByText(/explore by hashtag/i)).toBeInTheDocument();
    expect(screen.getByText(/view post analysis/i)).toBeInTheDocument();
    expect(screen.queryByText(/audience segmentation/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/course actions/i)).not.toBeInTheDocument();
  });
});
