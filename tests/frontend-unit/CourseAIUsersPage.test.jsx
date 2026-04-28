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

  test("renders guided and smart generate entries and keeps advanced create flow", async () => {
    renderPage();

    expect(await screen.findByRole("button", { name: /guided generate/i })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /smart generate/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ai bulk generate/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /advanced create/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /advanced create/i }));

    expect(await screen.findByRole("heading", { name: /create ai user/i })).toBeInTheDocument();

    fireEvent.change(screen.getAllByPlaceholderText(/unique username for this course/i)[0], {
      target: { value: "manual-user" },
    });
    fireEvent.change(screen.getAllByPlaceholderText(/optional display name/i)[0], {
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

  test("does not reload course ai users or profile options when authUser object refreshes with the same id", async () => {
    const fetchProfileOptions = vi.fn().mockResolvedValue(profileOptions);
    let appValue = {
      authUser: { id: 1, is_staff: true, is_superuser: false, full_name: "Teacher" },
      authCheckComplete: true,
      profileOptions,
      fetchProfileOptions,
    };
    mockedUseApp.mockImplementation(() => appValue);

    const view = renderPage();

    await screen.findByText(/legacy user/i);
    expect(getJson).toHaveBeenCalledTimes(1);
    expect(fetchProfileOptions).toHaveBeenCalledTimes(1);

    appValue = {
      ...appValue,
      authUser: {
        id: 1,
        is_staff: true,
        is_superuser: false,
        full_name: "Teacher Updated",
        avatar_url: "/avatar.png",
      },
    };

    view.rerender(
      <MemoryRouter initialEntries={["/courses/9/ai-users"]}>
        <Routes>
          <Route path="/courses/:courseId/ai-users" element={<CourseAIUsersPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getJson).toHaveBeenCalledTimes(1);
      expect(fetchProfileOptions).toHaveBeenCalledTimes(1);
    });
  });

  test("renders AI users inside a scrollable table container", async () => {
    renderPage();

    await screen.findByText("legacy-user");

    const table = screen.getByRole("table");
    const scrollContainer = table.parentElement;

    expect(scrollContainer).toHaveClass("max-h-[70vh]");
    expect(scrollContainer).toHaveClass("overflow-y-auto");
    expect(screen.getByRole("columnheader", { name: /username/i })).toHaveClass(
      "sticky"
    );
  });

  test("guided generate previews broad audience coverage and commits", async () => {
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
          { id: 2, username: "coverage-tech-1", display_name: "Tech Explorer 1" },
        ],
        count: 2,
      });
    postJson
      .mockResolvedValueOnce({
        items: [
          {
            username: "coverage-tech-1",
            display_name: "Tech Explorer 1",
            age_group: "Gen Z (16-28)",
            content_preference: "Pictures or videos",
            digital_time: "Several times a day",
            interests: ["Technology & Gaming"],
            interaction_style: "Comment on posts",
            decision_factor: "Convenience",
            notes: "Rule-generated broad coverage persona",
            warnings: [],
          },
          {
            username: "coverage-life-2",
            display_name: "Lifestyle Browser 2",
            age_group: "Gen Y (29-44)",
            content_preference: "Thoughtful opinions",
            digital_time: "About once a day",
            interests: ["Travel & Food"],
            interaction_style: "Like/react to posts",
            decision_factor: "Price",
            notes: "Rule-generated broad coverage persona",
            warnings: [],
          },
          {
            username: "coverage-arts-3",
            display_name: "Creative Observer 3",
            age_group: "Gen Z (16-28)",
            content_preference: "Thoughtful opinions",
            digital_time: "About once a day",
            interests: ["Arts & Culture"],
            interaction_style: "Like/react to posts",
            decision_factor: "Convenience",
            notes: "Rule-generated broad coverage persona",
            warnings: [],
          },
        ],
        count: 3,
        warnings: ["Preview warning"],
        limits: { max_count: 100, mode: "guided" },
      })
      .mockResolvedValueOnce({
        created: 3,
        items: [{ id: 2, username: "coverage-tech-1", display_name: "Tech Explorer 1" }],
        errors: [],
      });

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /guided generate/i }));

    fireEvent.change(screen.getByLabelText(/number of users/i, { selector: "input" }), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: /explore broad audience/i }));
    fireEvent.change(screen.getByLabelText(/coverage/i), {
      target: { value: "wide" },
    });
    fireEvent.change(screen.getByLabelText(/activity level/i), {
      target: { value: "high" },
    });
    fireEvent.change(screen.getByLabelText(/interest lean/i), {
      target: { value: "tech" },
    });

    fireEvent.click(screen.getByRole("button", { name: /generate preview/i }));

    expect(await screen.findByText(/preview warning/i)).toBeInTheDocument();
    expect(postJson).toHaveBeenCalledWith(
      "/api/courses/9/ai-users/guided-preview/",
      expect.objectContaining({
        goal: "broad_audience",
        count: 3,
        coverage: "wide",
        activity_level: "high",
        interest_lean: "tech",
      })
    );
    expect(postJson).toHaveBeenCalledWith(
      "/api/courses/9/ai-users/guided-preview/",
      expect.not.objectContaining({
        age_group: expect.anything(),
      })
    );

    expect(await screen.findByRole("heading", { name: /audience segment snapshot/i })).toBeInTheDocument();
    expect(screen.getByText(/Representative audience archetypes/i)).toBeInTheDocument();
    expect(screen.getByText(/^Explore Broad Audience$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create users/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /regenerate/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /adjust settings/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /create users/i }));

    await waitFor(() => {
      expect(postJson).toHaveBeenCalledWith(
        "/api/courses/9/ai-users/guided-commit/",
        {
          items: expect.arrayContaining([
            expect.objectContaining({
              username: "coverage-tech-1",
              display_name: "Tech Explorer 1",
            }),
          ]),
        }
      );
    });

    expect(await screen.findByText(/Created 3 AI personas\./i)).toBeInTheDocument();
    expect(await screen.findByText("Tech Explorer 1")).toBeInTheDocument();
  });

  test("guided generate requires theme card for theme goal", async () => {
    postJson.mockRejectedValueOnce(makeApiError("Field `theme_card` is required for theme goal.", 400));

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /guided generate/i }));
    fireEvent.click(screen.getByRole("button", { name: /focus on a theme/i }));
    fireEvent.click(screen.getByRole("button", { name: /generate preview/i }));

    expect(await screen.findByText(/theme_card/i)).toBeInTheDocument();
  });

  test("guided generate theme goal previews and supports regenerate", async () => {
    postJson
      .mockResolvedValueOnce({
        items: [
          {
            username: "tech-gaming-1",
            display_name: "Tech Trend 1",
            age_group: "Gen Z (16-28)",
            content_preference: "Pictures or videos",
            digital_time: "Several times a day",
            interests: ["Technology & Gaming"],
            interaction_style: "Comment on posts",
            notes: "v1",
            warnings: [],
          },
        ],
        count: 1,
        warnings: ["Focused theme warning"],
        limits: { max_count: 100, mode: "guided" },
        smart_profile: {
          goal: "theme",
          goal_label: "Focus on a Theme",
          theme_card: "tech_gaming",
          theme_label: "Tech & Gaming",
        },
      })
      .mockResolvedValueOnce({
        items: [
          {
            username: "tech-gaming-2",
            display_name: "Tech Trend 2",
            age_group: "Gen Y (29-44)",
            content_preference: "Pictures or videos",
            digital_time: "Several times a day",
            interests: ["Technology & Gaming"],
            interaction_style: "Like/react to posts",
            notes: "v2",
            warnings: [],
          },
        ],
        count: 1,
        warnings: [],
        limits: { max_count: 100, mode: "guided" },
        smart_profile: {
          goal: "theme",
          goal_label: "Focus on a Theme",
          theme_card: "tech_gaming",
          theme_label: "Tech & Gaming",
        },
      });

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /guided generate/i }));
    fireEvent.click(screen.getByRole("button", { name: /focus on a theme/i }));
    fireEvent.change(screen.getByLabelText(/theme card/i), {
      target: { value: "tech_gaming" },
    });
    fireEvent.change(screen.getByLabelText(/number of users/i, { selector: "input" }), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate preview/i }));

    expect(await screen.findByText(/Tech Trend 1/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Tech & Gaming/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /regenerate/i }));

    expect(await screen.findByText(/Tech Trend 2/i)).toBeInTheDocument();
    expect(postJson).toHaveBeenNthCalledWith(
      1,
      "/api/courses/9/ai-users/guided-preview/",
      expect.objectContaining({ goal: "theme", theme_card: "tech_gaming", count: 1 })
    );
    expect(postJson).toHaveBeenNthCalledWith(
      2,
      "/api/courses/9/ai-users/guided-preview/",
      expect.objectContaining({ goal: "theme", theme_card: "tech_gaming", count: 1 })
    );
  });

  test("guided generate engagement goal supports advanced demographic filters", async () => {
    postJson.mockResolvedValueOnce({
      items: [
        {
          username: "engage-1",
          display_name: "Engagement Reader 1",
          age_group: "Gen Z (16-28)",
          education_level: "University Education",
          income_level: "$50K - $89,999 /year",
          gender: "Female",
          content_preference: "Thoughtful opinions",
          digital_time: "Several times a day",
          interests: ["Arts & Culture"],
          interaction_style: "Comment on posts",
          decision_factor: "Convenience",
          notes: "Rule-generated engagement persona",
          warnings: [],
        },
      ],
      count: 1,
      warnings: [],
      limits: { max_count: 100, mode: "guided" },
      smart_profile: {
        goal: "engagement_style",
        goal_label: "Focus on Engagement Style",
      },
    });

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /guided generate/i }));
    fireEvent.click(screen.getByRole("button", { name: /focus on engagement style/i }));
    fireEvent.change(screen.getByLabelText(/content preference bias/i), {
      target: { value: "Thoughtful opinions" },
    });
    fireEvent.change(screen.getByLabelText(/interaction intensity/i), {
      target: { value: "high" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /advanced/i })[1]);
    fireEvent.change(screen.getByLabelText(/^gender$/i), {
      target: { value: "Female" },
    });
    fireEvent.change(screen.getByLabelText(/age group/i), {
      target: { value: "Gen Z (16-28)" },
    });

    fireEvent.click(screen.getByRole("button", { name: /generate preview/i }));

    await waitFor(() => {
      expect(postJson).toHaveBeenCalledWith(
        "/api/courses/9/ai-users/guided-preview/",
        expect.objectContaining({
          goal: "engagement_style",
          content_preference_bias: "Thoughtful opinions",
          interaction_intensity: "high",
          gender: "Female",
          age_group: "Gen Z (16-28)",
        })
      );
    });

    expect(await screen.findByText(/Engagement Reader 1/i)).toBeInTheDocument();
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
