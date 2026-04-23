import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import AIUserCenterPage from "../../frontend/src/pages/admin/AIUserCenterPage.jsx";
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
    <MemoryRouter initialEntries={["/ai-users"]}>
      <AIUserCenterPage />
    </MemoryRouter>
  );
}

describe("AIUserCenterPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getJson.mockResolvedValue({
      items: [{ id: 9, course_code: "COMP9900", course_name: "Bread" }],
    });
  });

  test("does not reload managed courses when authUser object refreshes with the same id", async () => {
    let authValue = {
      authUser: { id: 7, is_staff: true, is_superuser: false, full_name: "Teacher" },
      authCheckComplete: true,
    };
    mockedUseAuth.mockImplementation(() => authValue);

    const view = renderPage();

    await screen.findByText(/comp9900/i);
    expect(getJson).toHaveBeenCalledTimes(1);
    expect(getJson).toHaveBeenCalledWith("/api/courses/managed/");

    authValue = {
      authUser: {
        id: 7,
        is_staff: true,
        is_superuser: false,
        full_name: "Teacher Updated",
        avatar_url: "/next.png",
      },
      authCheckComplete: true,
    };

    view.rerender(
      <MemoryRouter initialEntries={["/ai-users"]}>
        <AIUserCenterPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getJson).toHaveBeenCalledTimes(1);
    });
  });
});
