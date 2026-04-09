import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { postJson } from "../../lib/api";
import { useApp } from "../../context/AppContext";
import AuthenticatedShell from "../components/AuthenticatedShell";
import Feedback from "../components/Feedback";

const TEMPLATES = [
  {
    id: "campus_social",
    title: "Campus social discussion",
    desc: "Simulate a course community: posts, likes, comments, and topic hashtags.",
    suggested_ai: 30,
  },
  {
    id: "product_launch",
    title: "Product launch buzz",
    desc: "Explore how different student segments react to a new product idea.",
    suggested_ai: 40,
  },
  {
    id: "crisis_response",
    title: "Crisis response scenario",
    desc: "Test how sentiment and engagement change under negative events and interventions.",
    suggested_ai: 25,
  },
];

function clampInt(value, { min, max, fallback }) {
  const n = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(n)) return fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function toCsv(rows) {
  const escape = (v) => {
    const s = String(v ?? "");
    if (/[,"\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };
  return rows.map((row) => row.map(escape).join(",")).join("\n");
}

function downloadText(filename, text, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function isIsoDate(value) {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

export default function CreateCoursePage() {
  const navigate = useNavigate();
  const { authUser, authCheckComplete, profileOptions, fetchProfileOptions } =
    useApp();

  const isTeacher = Boolean(
    authUser && (authUser.is_superuser || authUser.is_staff)
  );

  const [step, setStep] = useState(1); // 1 template → 2 course → 3 audience → 4 export
  const [templateId, setTemplateId] = useState(TEMPLATES[0]?.id || "");
  const selectedTemplate = useMemo(
    () => TEMPLATES.find((t) => t.id === templateId) || TEMPLATES[0],
    [templateId]
  );

  const [form, setForm] = useState({
    course_code: "",
    course_name: "",
    term: "",
    start_date: "",
    end_date: "",
  });
  const [status, setStatus] = useState({
    loading: false,
    error: "",
    message: "",
  });
  const [createdCourse, setCreatedCourse] = useState(null);

  // Audience / persona inputs (keep simple; advanced fields are optional)
  const [audienceGoal, setAudienceGoal] = useState("");
  const [keyFields, setKeyFields] = useState(() => ({
    gender: true,
    city: true,
    age_group: true,
    interests: true,
    sociability: false,
    openness: false,
  }));
  const [audience, setAudience] = useState({
    gender: "",
    city: "",
    age_group: "",
    education_level: "",
    income_level: "",
    interests: [],
    social_value: 5,
    sociability: 5,
    openness: 5,
    content_preference: "",
    interaction_style: "",
  });
  const [aiCount, setAiCount] = useState(() =>
    clampInt(selectedTemplate?.suggested_ai, { min: 0, max: 300, fallback: 30 })
  );
  const [exportStatus, setExportStatus] = useState({ error: "", message: "" });

  useEffect(() => {
    if (!authCheckComplete) return;

    if (!authUser) {
      navigate("/login", { replace: true });
      return;
    }
    if (!isTeacher) {
      navigate("/courses", { replace: true });
    }
  }, [authUser, authCheckComplete, isTeacher, navigate]);

  useEffect(() => {
    if (authUser) {
      fetchProfileOptions().catch(() => {});
    }
  }, [authUser, fetchProfileOptions]);

  useEffect(() => {
    setAiCount((prev) => {
      if (typeof prev === "number" && prev > 0) return prev;
      return clampInt(selectedTemplate?.suggested_ai, {
        min: 0,
        max: 300,
        fallback: 30,
      });
    });
  }, [selectedTemplate?.suggested_ai]);

  if (!authCheckComplete || !authUser || !isTeacher) return null;

  const createCourseAndContinue = async () => {
    setStatus({ loading: true, error: "", message: "" });

    if (!form.start_date || !form.end_date) {
      setStatus({
        loading: false,
        error: "Please provide both the start and end date.",
        message: "",
      });
      return;
    }

    if (!isIsoDate(form.start_date) || !isIsoDate(form.end_date)) {
      setStatus({
        loading: false,
        error: "Please enter dates in English format: YYYY-MM-DD.",
        message: "",
      });
      return;
    }

    if (new Date(form.end_date) < new Date(form.start_date)) {
      setStatus({
        loading: false,
        error: "The course end date must be on or after the start date.",
        message: "",
      });
      return;
    }

    try {
      const payload = await postJson("/api/courses/create/", form);
      const course = payload?.course || payload?.item || payload || null;
      setCreatedCourse(course);
      setStatus({
        loading: false,
        error: "",
        message: "Course created. Continue to simulation setup.",
      });
      setStep(3);
    } catch (error) {
      setStatus({ loading: false, error: error.message, message: "" });
    }
  };

  const toggleKeyField = (field) => {
    setKeyFields((prev) => ({ ...prev, [field]: !prev[field] }));
  };
  const toggleInterest = (interest) => {
    setAudience((prev) => {
      const has = prev.interests.includes(interest);
      return {
        ...prev,
        interests: has
          ? prev.interests.filter((i) => i !== interest)
          : [...prev.interests, interest],
      };
    });
  };

  const csvHeader = useMemo(
    () => [
      "username",
      "display_name",
      "gender",
      "city",
      "age_group",
      "education_level",
      "income_level",
      "social_value",
      "sociability",
      "openness",
      "content_preference",
      "interests",
      "shopping_frequency",
      "buying_behavior",
      "decision_factor",
      "shopping_preference",
      "digital_time",
      "interaction_style",
      "influencer_type",
      "notes",
    ],
    []
  );

  const buildCsvRows = useCallbackCsvRows({
    aiCount,
    csvHeader,
    audience,
    template: selectedTemplate,
  });

  const promptText = useMemo(() => {
    const fields = [];
    if (keyFields.gender) fields.push(`gender: ${audience.gender || "any"}`);
    if (keyFields.city) fields.push(`city: ${audience.city || "any"}`);
    if (keyFields.age_group)
      fields.push(`age group: ${audience.age_group || "any"}`);
    if (keyFields.interests)
      fields.push(
        `interests: ${
          audience.interests.length ? audience.interests.join(", ") : "any"
        }`
      );
    if (keyFields.sociability) fields.push(`sociability: ${audience.sociability}`);
    if (keyFields.openness) fields.push(`openness: ${audience.openness}`);
    const courseLabel =
      createdCourse?.course_code && createdCourse?.name
        ? `${createdCourse.course_code} · ${createdCourse.name}`
        : "this course";
    return [
      `You are helping an educator set up a simulation for ${courseLabel}.`,
      `Template: ${selectedTemplate?.title || "N/A"}`,
      audienceGoal.trim()
        ? `Teacher goal: ${audienceGoal.trim()}`
        : `Teacher goal: (not provided)`,
      `Key audience attributes: ${fields.length ? fields.join("; ") : "(none)"}`,
      "",
      `Generate ${aiCount} student personas (unique usernames). Each persona should behave consistently with the attributes.`,
      `Return as CSV using this header: ${csvHeader.join(",")}`,
      `- For 'interests', use comma or semicolon separated values.`,
      `- Scales: social_value/sociability/openness are integers 1–10.`,
      `- Keep 'notes' short.`,
    ].join("\n");
  }, [
    audience,
    audienceGoal,
    aiCount,
    createdCourse?.course_code,
    createdCourse?.name,
    csvHeader,
    keyFields.age_group,
    keyFields.city,
    keyFields.gender,
    keyFields.interests,
    keyFields.openness,
    keyFields.sociability,
    selectedTemplate?.title,
  ]);

  return (
    <AuthenticatedShell
      title="Create Simulation"
      subtitle="A guided setup for educators (template → course → audience → export)"
    >
      <div className="space-y-5">
        {/* Stepper */}
        <div className="rounded-3xl border border-brand-100 bg-white px-4 py-4 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              {[
                { n: 1, label: "Template" },
                { n: 2, label: "Course" },
                { n: 3, label: "Audience" },
                { n: 4, label: "Export" },
              ].map((s) => (
                <button
                  key={s.n}
                  type="button"
                  onClick={() => setStep(s.n)}
                  className={`rounded-full px-3 py-1 transition ${
                    step === s.n
                      ? "bg-brand-100 text-brand"
                      : "bg-brand-50 text-slate-600 hover:bg-brand-100"
                  }`}
                >
                  {s.n}. {s.label}
                </button>
              ))}
            </div>
            <div className="text-xs text-slate-500">
              {createdCourse?.join_code ? (
                <span>
                  Join code:{" "}
                  <span className="font-semibold text-slate-700">
                    {createdCourse.join_code}
                  </span>
                </span>
              ) : createdCourse?.course_code ? (
                <span className="font-semibold text-slate-700">
                  {createdCourse.course_code} created
                </span>
              ) : (
                <span>Not created yet</span>
              )}
            </div>
          </div>
        </div>

        {/* Step 1: Template */}
        {step === 1 ? (
          <section className="space-y-4 rounded-3xl border border-brand-100 bg-white p-5 shadow-soft">
            <header className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-900">
                Step 1 · Choose a simulation template
              </h2>
              <p className="text-sm text-slate-500">
                Templates explain what each simulation is for and what you will
                configure next.
              </p>
            </header>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {TEMPLATES.map((t) => {
                const active = t.id === templateId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplateId(t.id)}
                    className={`rounded-3xl border p-4 text-left transition ${
                      active
                        ? "border-brand bg-brand-50"
                        : "border-brand-100 bg-white hover:border-brand-200 hover:bg-brand-50/40"
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {t.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{t.desc}</p>
                    <p className="mt-3 text-[11px] font-semibold text-slate-600">
                      Suggested AI personas:{" "}
                      <span className="text-brand">{t.suggested_ai}</span>
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate("/courses/manage")}
              >
                Back
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setStep(2)}
              >
                Continue
              </button>
            </div>
          </section>
        ) : null}

        {/* Step 2: Course */}
        {step === 2 ? (
          <section className="space-y-4 rounded-3xl border border-brand-100 bg-white p-5 shadow-soft">
            <header className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-900">
                Step 2 · Create the course (simulation container)
              </h2>
              <p className="text-sm text-slate-500">
                This creates a course and a join code for students.
              </p>
            </header>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="field-label">
                Course code
                <input
                  type="text"
                  value={form.course_code}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, course_code: e.target.value }))
                  }
                  placeholder="e.g. COMP9900"
                  className="field-input"
                  required
                />
              </label>
              <label className="field-label">
                Term
                <input
                  type="text"
                  value={form.term}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, term: e.target.value }))
                  }
                  placeholder="e.g. 2026T1"
                  className="field-input"
                  required
                />
              </label>
              <label className="field-label sm:col-span-2">
                Course name
                <input
                  type="text"
                  value={form.course_name}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      course_name: e.target.value,
                    }))
                  }
                  placeholder="e.g. Capstone Project"
                  className="field-input"
                  required
                />
              </label>
              <label className="field-label">
                Start date
                <input
                  type="text"
                  value={form.start_date}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      start_date: e.target.value,
                    }))
                  }
                  placeholder="YYYY-MM-DD"
                  inputMode="numeric"
                  pattern="\\d{4}-\\d{2}-\\d{2}"
                  className="field-input"
                  required
                />
              </label>
              <label className="field-label">
                End date
                <input
                  type="text"
                  value={form.end_date}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, end_date: e.target.value }))
                  }
                  placeholder="YYYY-MM-DD"
                  inputMode="numeric"
                  pattern="\\d{4}-\\d{2}-\\d{2}"
                  className="field-input"
                  required
                />
              </label>
            </div>

            <Feedback message={status.message} error={status.error} />

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setStep(1)}
                disabled={status.loading}
              >
                Back
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => navigate("/courses/manage")}
                  disabled={status.loading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={createCourseAndContinue}
                  disabled={status.loading}
                >
                  {status.loading ? "Creating..." : "Create & continue"}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {/* Step 3: Audience */}
        {step === 3 ? (
          <section className="space-y-4 rounded-3xl border border-brand-100 bg-white p-5 shadow-soft">
            <header className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-900">
                Step 3 · Describe the audience (keep it simple)
              </h2>
              <p className="text-sm text-slate-500">
                Choose only the attributes you care about. You can keep the
                rest as “any”.
              </p>
            </header>

            <div className="space-y-3">
              <label className="field-label">
                What do you want to explore? (free text)
                <textarea
                  rows={3}
                  value={audienceGoal}
                  onChange={(e) => setAudienceGoal(e.target.value)}
                  placeholder="Example: I want to study how different student segments respond to sustainability messaging and how sentiment changes over time."
                  className="field-textarea"
                />
              </label>
            </div>

            <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
              <p className="text-xs font-semibold text-slate-600">
                Key attributes (pick a few)
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  ["gender", "Gender"],
                  ["city", "City"],
                  ["age_group", "Age group"],
                  ["interests", "Interests"],
                  ["sociability", "Sociability (1–10)"],
                  ["openness", "Openness (1–10)"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      keyFields[key]
                        ? "border-brand bg-brand-100 text-brand"
                        : "border-brand-200 bg-white text-slate-600 hover:border-brand hover:text-brand"
                    }`}
                    onClick={() => toggleKeyField(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {keyFields.gender ? (
                <label className="field-label">
                  Gender
                  <select
                    value={audience.gender}
                    onChange={(e) =>
                      setAudience((prev) => ({ ...prev, gender: e.target.value }))
                    }
                    className="field-select"
                  >
                    <option value="">Any</option>
                    {(profileOptions?.genders || []).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {keyFields.city ? (
                <label className="field-label">
                  City
                  <select
                    value={audience.city}
                    onChange={(e) =>
                      setAudience((prev) => ({ ...prev, city: e.target.value }))
                    }
                    className="field-select"
                  >
                    <option value="">Any</option>
                    {(profileOptions?.cities || []).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {keyFields.age_group ? (
                <label className="field-label">
                  Age group
                  <select
                    value={audience.age_group}
                    onChange={(e) =>
                      setAudience((prev) => ({
                        ...prev,
                        age_group: e.target.value,
                      }))
                    }
                    className="field-select"
                  >
                    <option value="">Any</option>
                    {(profileOptions?.age_groups || []).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {keyFields.sociability ? (
                <label className="block text-xs font-semibold text-slate-600">
                  Sociability · {audience.sociability}
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={audience.sociability}
                    onChange={(e) =>
                      setAudience((prev) => ({
                        ...prev,
                        sociability: Number(e.target.value),
                      }))
                    }
                    className="mt-2 w-full accent-brand"
                  />
                </label>
              ) : null}

              {keyFields.openness ? (
                <label className="block text-xs font-semibold text-slate-600">
                  Openness · {audience.openness}
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={audience.openness}
                    onChange={(e) =>
                      setAudience((prev) => ({
                        ...prev,
                        openness: Number(e.target.value),
                      }))
                    }
                    className="mt-2 w-full accent-brand"
                  />
                </label>
              ) : null}
            </div>

            {keyFields.interests ? (
              <div className="rounded-2xl border border-brand-100 bg-white p-4">
                <p className="text-xs font-semibold text-slate-600">Interests</p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Pick a few representative interests (optional).
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(profileOptions?.interests || []).map((interest) => {
                    const active = audience.interests.includes(interest);
                    return (
                      <button
                        key={interest}
                        type="button"
                        onClick={() => toggleInterest(interest)}
                        className={`rounded-full border px-3 py-1 text-xs transition ${
                          active
                            ? "border-brand bg-brand-100 text-brand"
                            : "border-brand-200 bg-white text-slate-600 hover:border-brand hover:text-brand"
                        }`}
                      >
                        {interest}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setStep(2)}
              >
                Back
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setStep(4)}
              >
                Continue
              </button>
            </div>
          </section>
        ) : null}

        {/* Step 4: Export */}
        {step === 4 ? (
          <section className="space-y-4 rounded-3xl border border-brand-100 bg-white p-5 shadow-soft">
            <header className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-900">
                Step 4 · Export spreadsheet (CSV) and import AI users
              </h2>
              <p className="text-sm text-slate-500">
                Download a CSV, then import it in “Manage AI Users”.
              </p>
            </header>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="field-label sm:col-span-1">
                AI persona count
                <input
                  type="number"
                  min={0}
                  max={300}
                  value={aiCount}
                  onChange={(e) =>
                    setAiCount(
                      clampInt(e.target.value, { min: 0, max: 300, fallback: 30 })
                    )
                  }
                  className="field-input"
                />
              </label>

              <div className="sm:col-span-2 rounded-2xl border border-brand-100 bg-brand-50/40 p-4 text-xs text-slate-600">
                <p className="font-semibold text-slate-700">What you get</p>
                <ul className="mt-2 list-disc pl-4 space-y-1">
                  <li>CSV header compatible with AI user import</li>
                  <li>Reasonable defaults from your selected key attributes</li>
                  <li>A copyable prompt for generating richer personas</li>
                </ul>
              </div>
            </div>

            {exportStatus.error ? <Feedback error={exportStatus.error} /> : null}
            {exportStatus.message ? (
              <Feedback message={exportStatus.message} />
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  const headerOnly = toCsv([csvHeader]);
                  downloadText(
                    "ai_users_template.csv",
                    `${headerOnly}\n`,
                    "text/csv;charset=utf-8"
                  );
                  setExportStatus({
                    error: "",
                    message: "Downloaded CSV template header.",
                  });
                }}
              >
                Download CSV template
              </button>

              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  try {
                    const rows = buildCsvRows();
                    const csv = toCsv(rows);
                    const code = createdCourse?.course_code || "course";
                    const name =
                      createdCourse?.course_name ||
                      createdCourse?.name ||
                      "simulation";
                    const safe = `${code}-${name}`
                      .replaceAll(/[^\w-]+/g, "_")
                      .slice(0, 64);
                    downloadText(
                      `${safe}-ai_users.csv`,
                      `${csv}\n`,
                      "text/csv;charset=utf-8"
                    );
                    setExportStatus({
                      error: "",
                      message: "Downloaded CSV for AI user import.",
                    });
                  } catch (e) {
                    setExportStatus({
                      error: e?.message || "Failed to build CSV.",
                      message: "",
                    });
                  }
                }}
              >
                Download AI users CSV
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  downloadText("simulation_prompt.txt", `${promptText}\n`);
                  setExportStatus({
                    error: "",
                    message: "Downloaded prompt text.",
                  });
                }}
              >
                Download prompt
              </button>

              <button
                type="button"
                className="btn-secondary"
                disabled={!createdCourse?.id}
                onClick={() => {
                  if (!createdCourse?.id) return;
                  navigate(`/courses/${createdCourse.id}/ai-users`);
                }}
                title={
                  createdCourse?.id
                    ? "Go to AI Users management"
                    : "Create the course first"
                }
              >
                Go to Manage AI Users →
              </button>
            </div>

            <div className="rounded-2xl border border-brand-100 bg-white p-4">
              <p className="text-xs font-semibold text-slate-700">
                Prompt preview (copy/paste)
              </p>
              <pre className="mt-2 whitespace-pre-wrap rounded-2xl border border-brand-100 bg-brand-50/50 p-3 text-xs leading-5 text-slate-700">
                {promptText}
              </pre>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setStep(3)}
              >
                Back
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => navigate("/courses/manage")}
              >
                Finish
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </AuthenticatedShell>
  );
}

function useCallbackCsvRows({ aiCount, csvHeader, audience, template }) {
  // Local helper to avoid pulling in new deps; intentionally simple.
  // Returns a callback that builds rows including the header row.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const fn = useMemo(() => {
    return () => {
      const count = clampInt(aiCount, { min: 0, max: 300, fallback: 30 });
      const rows = [csvHeader];
      for (let i = 1; i <= count; i += 1) {
        const username = `ai_student_${String(i).padStart(2, "0")}`;
        const displayName = `AI Student ${String(i).padStart(2, "0")}`;
        const interests = Array.isArray(audience.interests)
          ? audience.interests
          : [];
        const interestCell = interests.join(";"); // matches README examples
        const notes = template?.title
          ? `Template: ${template.title}`
          : "Generated by simulation wizard";
        rows.push([
          username,
          displayName,
          audience.gender || "",
          audience.city || "",
          audience.age_group || "",
          audience.education_level || "",
          audience.income_level || "",
          Number(audience.social_value ?? 5),
          Number(audience.sociability ?? 5),
          Number(audience.openness ?? 5),
          audience.content_preference || "",
          interestCell,
          "",
          "",
          "",
          "",
          "",
          "",
          audience.interaction_style || "",
          "",
          notes,
        ]);
      }
      return rows;
    };
  }, [aiCount, audience, csvHeader, template?.title]);
  return fn;
}
