import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import DashboardPage from "../../frontend/src/pages/admin/DashboardPage.jsx";
import { useApp } from "../../frontend/src/context/AppContext";
import { useAuth } from "../../frontend/src/context/AuthContext";
import { getJson } from "../../frontend/src/lib/api";

vi.mock("recharts", () => ({
  BarChart: ({ children }) => <div>{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
}));

vi.mock("../../frontend/src/context/AppContext", () => ({
  useApp: vi.fn(),
}));

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

const mockedUseApp = useApp;
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
    mockedUseApp.mockReturnValue({
      pushToast: vi.fn(),
    });
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
  });

  test("shows a course-first priority list and removes AI summary", async () => {
    renderPage();

    expect(await screen.findByText(/course priority list/i)).toBeInTheDocument();
    expect(screen.getAllByText(/open course catalog/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/ai summary/i)).not.toBeInTheDocument();
  });
});
