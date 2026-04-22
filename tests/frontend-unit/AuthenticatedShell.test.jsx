import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import AuthenticatedShell from "../../frontend/src/pages/components/AuthenticatedShell.jsx";
import { useApp } from "../../frontend/src/context/AppContext";

vi.mock("../../frontend/src/context/AppContext", () => ({
  useApp: vi.fn(),
}));

vi.mock("../../frontend/src/components/ToastHost", () => ({
  default: () => null,
}));

const mockedUseApp = useApp;

function renderShell(initialEntry, extraProps = {}) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="*"
          element={
            <AuthenticatedShell title="Shell" subtitle="Test shell" {...extraProps}>
              <div>Body</div>
            </AuthenticatedShell>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("AuthenticatedShell teacher sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseApp.mockReturnValue({
      authUser: { id: 1, is_staff: true, is_superuser: false, full_name: "Teacher" },
      logout: vi.fn(),
      notifications: { unread: 0 },
      notificationStatus: { loading: false, error: "" },
      fetchNotifications: vi.fn(() => Promise.resolve()),
      courses: { joined: [], available: [] },
      fetchCourses: vi.fn(() => Promise.resolve()),
    });
  });

  test("uses the dashboard sidebar on dashboard course pages", () => {
    renderShell("/dashboard/courses/9");

    expect(screen.getByText("Course Manage")).toBeInTheDocument();
    expect(screen.getByText("AI User")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Analyze")).not.toBeInTheDocument();
  });

  test("removes analyze from teacher course-page sidebar", () => {
    renderShell("/courses/9");

    expect(screen.getByText("Course Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Community")).toBeInTheDocument();
    expect(screen.getByText("Materials")).toBeInTheDocument();
    expect(screen.getByText("Messages")).toBeInTheDocument();
    expect(screen.queryByText("Analyze")).not.toBeInTheDocument();
  });

  test("does not show course dashboard in course-page sidebar for students", () => {
    mockedUseApp.mockReturnValue({
      authUser: { id: 2, is_staff: false, is_superuser: false, full_name: "Student" },
      logout: vi.fn(),
      notifications: { unread: 0 },
      notificationStatus: { loading: false, error: "" },
      fetchNotifications: vi.fn(() => Promise.resolve()),
      courses: { joined: [], available: [] },
      fetchCourses: vi.fn(() => Promise.resolve()),
    });

    renderShell("/courses/9");

    expect(screen.queryByText("Course Dashboard")).not.toBeInTheDocument();
    expect(screen.getByText("Community")).toBeInTheDocument();
    expect(screen.getByText("Materials")).toBeInTheDocument();
    expect(screen.getByText("Messages")).toBeInTheDocument();
  });

  test("can hide the desktop sidebar for full-width pages", () => {
    renderShell("/courses/9/posts/101/analytics", { hideSidebar: true });

    expect(screen.queryByText("Navigation")).not.toBeInTheDocument();
    expect(screen.queryByText("Community")).not.toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
  });
});
