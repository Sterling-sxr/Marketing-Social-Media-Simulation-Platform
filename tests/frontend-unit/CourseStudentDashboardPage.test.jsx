import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import CourseStudentDashboardPage from "../../frontend/src/pages/admin/CourseStudentDashboardPage.jsx";
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
    <MemoryRouter initialEntries={["/dashboard/courses/9/students/12"]}>
      <Routes>
        <Route
          path="/dashboard/courses/:courseId/students/:studentId"
          element={<CourseStudentDashboardPage />}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("CourseStudentDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseApp.mockReturnValue({
      authUser: { id: 1, is_staff: true, is_superuser: false },
      authCheckComplete: true,
    });
    getJson.mockResolvedValue({
      student: {
        calculated_at: "2026-04-10T09:00:00Z",
        course: { id: 9, course_code: "COMP9900", name: "Social Media Lab" },
        student: { id: 12, name: "Ada Lovelace" },
        summary: {
          total_posts: 2,
          total_likes: 30,
          total_comments: 10,
          total_views: 120,
        },
        sentiment: {
          breakdown: {
            positive: 60,
            neutral: 25,
            negative: 15,
          },
        },
        top_posts: [
          {
            post_id: 101,
            preview: "First post",
            likes: 10,
            comments: 4,
            views: 50,
            interactions: 14,
            created_at: "2026-04-10T09:00:00Z",
          },
          {
            post_id: 102,
            preview: "Second post",
            likes: 20,
            comments: 6,
            views: 70,
            interactions: 26,
            created_at: "2026-04-10T10:00:00Z",
          },
        ],
      },
    });
  });

  test("renders top posts inside a scrollable table container", async () => {
    renderPage();

    await screen.findByText("First post");

    const table = screen.getByRole("table");
    const scrollContainer = table.parentElement;

    expect(scrollContainer).toHaveClass("max-h-[70vh]");
    expect(scrollContainer).toHaveClass("overflow-y-auto");
    expect(
      screen.getByRole("columnheader", { name: /post/i })
    ).toHaveClass("sticky");
  });
});
