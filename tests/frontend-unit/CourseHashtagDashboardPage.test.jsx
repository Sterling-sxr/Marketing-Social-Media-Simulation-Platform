import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import CourseHashtagDashboardPage from "../../frontend/src/pages/admin/CourseHashtagDashboardPage.jsx";
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
    <MemoryRouter initialEntries={["/dashboard/courses/9/hashtags/campaign"]}>
      <Routes>
        <Route
          path="/dashboard/courses/:courseId/hashtags/:hashtag"
          element={<CourseHashtagDashboardPage />}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("CourseHashtagDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseApp.mockReturnValue({
      authUser: { id: 1, is_staff: true, is_superuser: false },
      authCheckComplete: true,
    });
    getJson.mockResolvedValue({
      hashtag: {
        calculated_at: "2026-04-17T10:00:00Z",
        course: { id: 9, course_code: "COMP9900", name: "Social Media Lab" },
        summary: {
          total_posts: 2,
          total_likes: 30,
          total_comments: 10,
          total_views: 120,
        },
        top_posts: [
          {
            post_id: 101,
            preview: "Campaign post",
            author_name: "Ada Lovelace",
            likes: 10,
            comments: 4,
            views: 50,
            interactions: 14,
            created_at: "2026-04-10T09:00:00Z",
          },
        ],
      },
    });
  });

  test("removes hashtag-level sentiment and routes posts to post analysis", async () => {
    renderPage();

    expect(await screen.findByText(/campaign post/i)).toBeInTheDocument();
    expect(screen.queryByText(/student post sentiment distribution/i)).not.toBeInTheDocument();
    expect(screen.getByText(/view post analysis/i)).toBeInTheDocument();
  });
});
