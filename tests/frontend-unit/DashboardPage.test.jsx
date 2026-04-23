import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import DashboardPage from "../../frontend/src/pages/admin/DashboardPage.jsx";
import { useAuth } from "../../frontend/src/context/AuthContext";
import { getJson } from "../../frontend/src/lib/api";

vi.mock("../../frontend/src/context/AuthContext", () => ({
  useAuth: vi.fn(),
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

const mockedUseAuth = useAuth;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      authUser: { id: 1, is_staff: true, is_superuser: false },
      authCheckComplete: true,
    });
    getJson.mockResolvedValue({
      summary: {
        total_courses: 2,
        registered_students: 80,
        total_posts: 42,
        total_interactions: 210,
        sentiment: {
          positive: 40,
          neutral: 45,
          negative: 15,
        },
        calculated_at: "2026-04-17T10:00:00Z",
        courses: [
          {
            id: 9,
            course_code: "COMP9900",
            name: "Social Media Lab",
            total_posts: 20,
            total_interactions: 140,
            registered_students: 40,
          },
          {
            id: 11,
            course_code: "COMP1234",
            name: "Digital Strategy",
            total_posts: 22,
            total_interactions: 70,
            registered_students: 40,
          },
        ],
      },
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        summary:
          "Overview: 2 courses, 80 students, 42 posts, and 210 interactions were recorded.\n" +
          "Analysis: Activity is concentrated in COMP9900, so the engagement pattern is uneven across courses.\n" +
          "Sentiment: The mix is mostly neutral, suggesting discussion is informative rather than highly emotional.\n" +
          "Recommendation: Reuse the strongest COMP9900 post formats in lower-engagement courses next week.",
      }),
    });
  });

  test("auto-generates AI summary after dashboard data loads", async () => {
    renderPage();

    expect(await screen.findByText(/AI Summary/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/ai/analyze/",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Activity is concentrated in COMP9900/i)
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Reuse the strongest COMP9900 post formats/i)
    ).toBeInTheDocument();
  });
});
