import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  let confirmSpy;
  let pushToast;

  beforeEach(() => {
    vi.clearAllMocks();
    pushToast = vi.fn();
    mockedUseApp.mockReturnValue({ pushToast });
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
    confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    confirmSpy?.mockRestore();
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

  test("deletes a course from the management list after confirmation", async () => {
    mockedUseAuth.mockReturnValue({
      authUser: { id: 7, is_staff: true, is_superuser: false, full_name: "Teacher" },
      authCheckComplete: true,
    });

    renderPage();

    expect(await screen.findByText(/bread studio/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /delete course/i }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
      expect(deleteJson).toHaveBeenCalledWith("/api/courses/1/");
    });
    await waitFor(() => {
      expect(screen.queryByText(/bread studio/i)).not.toBeInTheDocument();
    });
    expect(pushToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Course deleted",
      })
    );
  });

  test("shows a failure toast when deleting a course fails", async () => {
    mockedUseAuth.mockReturnValue({
      authUser: { id: 7, is_staff: true, is_superuser: false, full_name: "Teacher" },
      authCheckComplete: true,
    });
    deleteJson.mockRejectedValue(new Error("Method not allowed"));

    renderPage();

    expect(await screen.findByText(/bread studio/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /delete course/i }));

    await waitFor(() => {
      expect(deleteJson).toHaveBeenCalledWith("/api/courses/1/");
    });
    expect(pushToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Delete failed",
        message: "Method not allowed",
      })
    );
    expect(screen.getByText(/bread studio/i)).toBeInTheDocument();
  });
});
