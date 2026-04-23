import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import CourseManagePage from "../../frontend/src/pages/admin/CourseManagePage.jsx";
import { useApp } from "../../frontend/src/context/AppContext";
import { useAuth } from "../../frontend/src/context/AuthContext";
import { getJson, deleteJson, patchJson } from "../../frontend/src/lib/api";

vi.mock("../../frontend/src/context/AppContext", () => ({
  useApp: vi.fn(),
}));

vi.mock("../../frontend/src/context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../frontend/src/lib/api", () => ({
  getJson: vi.fn(),
  deleteJson: vi.fn(),
  patchJson: vi.fn(),
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

vi.mock("../../frontend/src/pages/components/Feedback", () => ({
  default: ({ error }) => <div>{error}</div>,
}));

const mockedUseApp = useApp;
const mockedUseAuth = useAuth;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/courses/manage"]}>
      <CourseManagePage />
    </MemoryRouter>
  );
}

describe("CourseManagePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseApp.mockReturnValue({
      pushToast: vi.fn(),
    });
    getJson.mockResolvedValue({
      items: [
        {
          id: 1,
          course_name: "Bread Studio",
          course_code: "COMP9900",
          join_code: "ABC123",
          term: "2025T1",
        },
      ],
    });
    deleteJson.mockResolvedValue({});
    patchJson.mockResolvedValue({});
  });

  test("does not reload managed courses when authUser object refreshes with the same id", async () => {
    let authValue = {
      authUser: { id: 7, is_staff: true, is_superuser: false, full_name: "Teacher" },
      authCheckComplete: true,
    };
    mockedUseAuth.mockImplementation(() => authValue);

    const view = renderPage();

    await screen.findByText(/bread studio/i);
    expect(getJson).toHaveBeenCalledTimes(1);
    expect(getJson).toHaveBeenCalledWith("/api/courses/managed/");

    authValue = {
      authUser: {
        id: 7,
        is_staff: true,
        is_superuser: false,
        full_name: "Teacher Updated",
      },
      authCheckComplete: true,
    };

    view.rerender(
      <MemoryRouter initialEntries={["/courses/manage"]}>
        <CourseManagePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getJson).toHaveBeenCalledTimes(1);
    });
  });
});
