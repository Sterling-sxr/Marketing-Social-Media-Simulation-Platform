import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import CourseAIUsersPage from "../../frontend/src/pages/admin/CourseAIUsersPage.jsx";
import { useApp } from "../../frontend/src/context/AppContext";
import { getJson, postJson, patchJson, deleteJson, uploadFile } from "../../frontend/src/lib/api";

vi.mock("../../frontend/src/context/AppContext", () => ({
  useApp: vi.fn(),
}));

vi.mock("../../frontend/src/lib/api", () => ({
  getJson: vi.fn(),
  postJson: vi.fn(),
  patchJson: vi.fn(),
  deleteJson: vi.fn(),
  uploadFile: vi.fn(),
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

vi.mock("../../frontend/src/pages/components/ConfirmDialog", () => ({
  default: () => null,
}));

const mockedUseApp = useApp;

const profileOptions = {
  genders: ["Male", "Female", "Prefer not to say"],
  cities: ["Sydney", "Melbourne"],
  age_groups: ["Gen Z (16-28)", "Gen Y (29-44)"],
  education_levels: ["University Education", "Post-graduate Education"],
  income_levels: ["Under $30K /year", "$50K - $89,999 /year"],
  content_preference: ["Pictures or videos", "Thoughtful opinions"],
  interests: ["Technology & Gaming", "Travel & Food", "Arts & Culture"],
  shopping_frequency: ["Sometimes", "Often"],
  buying_behavior: ["Switcher", "Brand loyal"],
  decision_factors: ["Convenience", "Price"],
  shopping_preference: ["Online only", "Both online and in stores"],
  digital_time: ["Several times a day", "About once a day"],
  interaction_style: ["Like/react to posts", "Comment on posts"],
  influencer_type: ["Entertainment", "Tech & Gaming"],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/courses/9/ai-users"]}>
      <Routes>
        <Route path="/courses/:courseId/ai-users" element={<CourseAIUsersPage />} />
      </Routes>
    </MemoryRouter>
  );
}

function makeApiError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

describe("CourseAIUsersPage persona creation flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseApp.mockReturnValue({
      authUser: { id: 1, is_staff: true, is_superuser: false },
      authCheckComplete: true,
      profileOptions,
      fetchProfileOptions: vi.fn().mockResolvedValue(profileOptions),
    });
    getJson.mockResolvedValue({
      course: { id: 9, course_code: "COMP9900", name: "Social Media Lab" },
      items: [
        {
          id: 1,
          username: "legacy-user",
          display_name: "Legacy User",
          city: "Sydney",
          gender: "Female",
          social_value: 5,
          sociability: 6,
          openness: 7,
          interests: ["Technology & Gaming"],
        },
      ],
      count: 1,
    });
  });

  test("renders unified creation entry buttons and keeps advanced create flow", async () => {
    renderPage();

    expect(await screen.findByRole("button", { name: /create with guide/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate with ai/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /advanced create/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /advanced create/i }));

    expect(await screen.findByRole("heading", { name: /create ai user/i })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/unique username for this course/i), {
      target: { value: "manual-user" },
    });
    fireEvent.change(screen.getByPlaceholderText(/optional display name/i), {
      target: { value: "Manual User" },
    });

    postJson.mockResolvedValueOnce({
      item: { id: 5, username: "manual-user", display_name: "Manual User" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(postJson).toHaveBeenCalledWith("/api/courses/9/ai-users/", expect.objectContaining({
        username: "manual-user",
        display_name: "Manual User",
      }));
    });
  });

  test("guided flow previews, allows edits/removal, commits, and refreshes list", async () => {
    getJson
      .mockResolvedValueOnce({
        course: { id: 9, course_code: "COMP9900", name: "Social Media Lab" },
        items: [{ id: 1, username: "legacy-user", display_name: "Legacy User" }],
        count: 1,
      })
      .mockResolvedValueOnce({
        course: { id: 9, course_code: "COMP9900", name: "Social Media Lab" },
        items: [
          { id: 1, username: "legacy-user", display_name: "Legacy User" },
          { id: 2, username: "guided-1", display_name: "Edited Guided Persona" },
        ],
        count: 2,
      });
    postJson
      .mockResolvedValueOnce({
        items: [
          {
            username: "guided-1",
            display_name: "Guided Persona 1",
            age_group: "Gen Z (16-28)",
            content_preference: "Pictures or videos",
            digital_time: "Several times a day",
            interests: ["Technology & Gaming"],
            notes: "one",
            warnings: [],
          },
          {
            username: "guided-2",
            display_name: "Guided Persona 2",
            age_group: "Gen Y (29-44)",
            content_preference: "Thoughtful opinions",
            digital_time: "About once a day",
            interests: ["Travel & Food"],
            notes: "two",
            warnings: [],
          },
        ],
        count: 2,
        warnings: ["Preview warning"],
        limits: { max_count: 100, mode: "guided" },
      })
      .mockResolvedValueOnce({
        created: 1,
        items: [{ id: 2, username: "guided-1", display_name: "Edited Guided Persona" }],
        errors: [],
      });

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /create with guide/i }));

    fireEvent.change(screen.getByLabelText(/template/i), {
      target: { value: "mixed-interests" },
    });
    fireEvent.change(screen.getByLabelText(/count/i, { selector: "input" }), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText(/audience theme/i, { selector: "input" }), {
      target: { value: "Demo Cohort" },
    });

    fireEvent.click(screen.getByRole("button", { name: /preview personas/i }));

    expect(await screen.findByText(/preview warning/i)).toBeInTheDocument();
    expect(postJson).toHaveBeenCalledWith(
      "/api/courses/9/ai-users/guided-preview/",
      expect.objectContaining({
        template_id: "mixed-interests",
        count: 2,
        audience_theme: "Demo Cohort",
      })
    );

    const draftCards = await screen.findAllByTestId("persona-draft-card");
    expect(draftCards).toHaveLength(2);

    fireEvent.change(
      within(draftCards[0]).getByLabelText(/display name/i, { selector: "input" }),
      { target: { value: "Edited Guided Persona" } }
    );
    fireEvent.click(within(draftCards[1]).getByRole("button", { name: /remove from commit/i }));

    fireEvent.click(screen.getByRole("button", { name: /commit personas/i }));

    await waitFor(() => {
      expect(postJson).toHaveBeenCalledWith(
        "/api/courses/9/ai-users/guided-commit/",
        {
          items: [
            expect.objectContaining({
              username: "guided-1",
              display_name: "Edited Guided Persona",
            }),
          ],
        }
      );
    });

    expect(await screen.findByText(/Created 1 AI personas\./i)).toBeInTheDocument();
    expect(await screen.findByText("Edited Guided Persona")).toBeInTheDocument();
  });

  test("generate flow shows warnings and AI unavailable message", async () => {
    postJson.mockRejectedValueOnce(makeApiError("AI persona generation is unavailable.", 503));

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /generate with ai/i }));
    fireEvent.change(screen.getByLabelText(/^count$/i, { selector: "input" }), {
      target: { value: "4" },
    });
    fireEvent.change(screen.getByLabelText(/scenario description/i, { selector: "textarea" }), {
      target: { value: "Simulate a demo cohort" },
    });
    fireEvent.click(screen.getByRole("button", { name: /preview personas/i }));

    expect(await screen.findByText(/AI persona generation is currently unavailable/i)).toBeInTheDocument();
  });

  test("generate flow previews drafts and supports regenerate", async () => {
    postJson
      .mockResolvedValueOnce({
        items: [
          {
            username: "gen-1",
            display_name: "Generated One",
            age_group: "Gen Z (16-28)",
            content_preference: "Pictures or videos",
            digital_time: "Several times a day",
            interests: ["Technology & Gaming"],
            notes: "v1",
            warnings: [],
          },
        ],
        count: 1,
        warnings: ["Generated warning"],
        limits: { max_count: 100, mode: "generated" },
      })
      .mockResolvedValueOnce({
        items: [
          {
            username: "gen-2",
            display_name: "Generated Two",
            age_group: "Gen Y (29-44)",
            content_preference: "Thoughtful opinions",
            digital_time: "About once a day",
            interests: ["Travel & Food"],
            notes: "v2",
            warnings: [],
          },
        ],
        count: 1,
        warnings: [],
        limits: { max_count: 100, mode: "generated" },
      });

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /generate with ai/i }));
    fireEvent.change(screen.getByLabelText(/^count$/i, { selector: "input" }), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /preview personas/i }));

    expect(await screen.findByText(/generated warning/i)).toBeInTheDocument();
    expect(
      await screen.findByDisplayValue("Generated One")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /regenerate/i }));

    expect(
      await screen.findByDisplayValue("Generated Two")
    ).toBeInTheDocument();
    expect(postJson).toHaveBeenNthCalledWith(
      1,
      "/api/courses/9/ai-users/generate-preview/",
      expect.objectContaining({ count: 1 })
    );
    expect(postJson).toHaveBeenNthCalledWith(
      2,
      "/api/courses/9/ai-users/generate-preview/",
      expect.objectContaining({ count: 1 })
    );
  });

  test("csv import still works from the unified actions bar", async () => {
    uploadFile.mockResolvedValueOnce({ created: 1, updated: 0, errors: [] });
    renderPage();

    const fileInput = document.querySelector('input[type="file"]');
    const file = new File(["username"], "sample.csv", { type: "text/csv" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(uploadFile).toHaveBeenCalledWith("/api/courses/9/ai-users/import/", file);
    });
    expect(await screen.findByText(/Import finished: 1 created, 0 updated\./i)).toBeInTheDocument();
  });
});
