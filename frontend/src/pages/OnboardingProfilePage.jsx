// Context: Compute shared values once so all branches use the same normalized inputs.
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp, createEmptyProfileData } from "../context/AppContext";
import Feedback from "./components/Feedback";

/* Purpose: `EditSection` owns one cohesive concern so state transitions and side effects remain easy to trace. */
function EditSection({
  emoji = "",
  title,
  desc,
  children,
  tone = "default", // Inline explanation: Keep this non-obvious normalization rule explicit.
  defaultOpen = false,
  forceOpen = false,
  hasError = false,
}) {
  const toneStyles =
    tone === "mint"
      ? {
          shell: "border-brand-100 bg-[linear-gradient(135deg,#EEF7F9_0%,#FFFFFF_70%)]",
          badge: "bg-brand-100 text-brand",
          accent: "bg-brand",
        }
      : tone === "peach"
      ? {
          shell: "border-accent-200 bg-[linear-gradient(135deg,#FFF1EB_0%,#FFFFFF_70%)]",
          badge: "bg-accent-100 text-accent-800",
          accent: "bg-accent-600",
        }
      : tone === "lilac"
      ? {
          shell: "border-accent-200 bg-[linear-gradient(135deg,#E9F5F8_0%,#FFFFFF_70%)]",
          badge: "bg-accent-100 text-accent-800",
          accent: "bg-accent-600",
        }
      : {
          shell: "border-brand-100 bg-white",
          badge: "bg-slate-100 text-slate-700",
          accent: "bg-slate-300",
        };

  return (
    <details
      key={`${title}-${hasError ? "err" : "ok"}-${forceOpen ? "force" : "base"}`}
      className={`group overflow-hidden rounded-3xl border shadow-sm ${toneStyles.shell} ${
        hasError ? "ring-2 ring-rose-200 border-rose-200" : ""
      }`}
      open={forceOpen || defaultOpen}
    >
      <summary className="cursor-pointer list-none px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-white/60 shadow-sm ${toneStyles.badge}`}
              aria-hidden="true"
            >
              <span className="text-base">{emoji}</span>
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-slate-900 sm:text-base">
                {title}
              </h3>
              {desc ? (
                <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                  {desc}
                </p>
              ) : null}
            </div>
          </div>
          <span className="rounded-full border border-brand-100 bg-white/70 px-3 py-1 text-[11px] font-semibold text-slate-600">
            <span className="group-open:hidden">Expand</span>
            <span className="hidden group-open:inline">Collapse</span>
          </span>
        </div>
      </summary>

      <div className="px-4 pb-4 sm:px-6 sm:pb-6">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200/80 to-transparent" />
        <div className="mt-4">{children}</div>
      </div>
    </details>
  );
}
function FieldBlock({ children, className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-brand-200 bg-brand-50/30 p-3 ${className}`}
    >
      {children}
    </div>
  );
}
function Label({ title }) {
  return (
    <span className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
      {title}
    </span>
  );
}
function Help({ children, className = "" }) {
  return (
    <p
      className={`mt-2 text-[11px] leading-relaxed text-slate-500 ${className}`}
    >
      {children}
    </p>
  );
}

/* Purpose: `FieldText` owns one cohesive concern so state transitions and side effects remain easy to trace. */
function FieldText({
  label,
  value,
  onChange,
  placeholder,
  className = "",
  required,
  error,
}) {
  return (
    <FieldBlock className={className}>
      <Label title={label} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        aria-invalid={Boolean(error)}
        className={[
          "w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none transition",
          error
            ? "border-rose-300 focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
            : "border-brand-200 focus:border-brand focus:ring-2 focus:ring-brand/20",
        ].join(" ")}
      />
      {error ? (
        <Help className="text-rose-600">{error}</Help>
      ) : (
        <Help>Used for mentions and discovery.</Help>
      )}
    </FieldBlock>
  );
}
function FieldSelect({ label, value, options, onChange, help, error }) {
  return (
    <FieldBlock>
      <Label title={label} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        className={[
          "w-full appearance-none rounded-xl border bg-white px-3 py-2.5 pr-8 text-sm outline-none transition",
          error
            ? "border-rose-300 focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
            : "border-brand-200 focus:border-brand focus:ring-2 focus:ring-brand/20",
        ].join(" ")}
      >
        <option value="" disabled>
          Please select
        </option>
        {(options || []).map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {error ? <Help className="text-rose-600">{error}</Help> : help ? <Help>{help}</Help> : null}
    </FieldBlock>
  );
}
function FieldSlider({ label, value, onChange }) {
  return (
    <FieldBlock>
      <Label title={label} />
      {/* Context: Keep related UI rendering and event handlers together for predictable updates. Reason: Grouping this logic makes interaction flows easier to debug and extend. */}
      <div className="flex flex-col gap-2">
        <span className="text-sm">
          Current: <span className="font-semibold">{value ?? "—"}</span>
        </span>
        <input
          type="range"
          min="1"
          max="10"
          value={value ?? 5}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full accent-brand-500"
        />
      </div>
      <Help>Drag to adjust (1–10).</Help>
    </FieldBlock>
  );
}
function FieldInterests({
  label,
  interests,
  selected,
  toggleInterest,
  error,
}) {
  return (
    <FieldBlock className="mt-2 md:col-span-2">
      <Label title={label} />
      <div
        className={[
          "rounded-xl border bg-white/70 p-3",
          error ? "border-rose-300" : "border-brand-200",
        ].join(" ")}
        aria-invalid={Boolean(error)}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {(interests || []).map((interest) => {
            const active = (selected || []).includes(interest);
            return (
              <label
                key={interest}
                className={`cursor-pointer rounded-xl px-3 py-2.5 text-xs font-medium transition sm:py-2 ${
                  active
                    ? "border border-brand bg-white text-brand shadow-sm"
                    : "border border-transparent bg-white text-slate-600 hover:border-brand-200"
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={active}
                  onChange={() => toggleInterest(interest)}
                />
                {interest}
              </label>
            );
          })}
        </div>
      </div>
      {error ? (
        <Help className="mt-2 text-rose-600">{error}</Help>
      ) : (
        <Help className="mt-2">Pick anything that describes your lifestyle.</Help>
      )}
    </FieldBlock>
  );
}

/* Purpose: `OnboardingProfilePage` owns one cohesive concern so state transitions and side effects remain easy to trace. */
export default function OnboardingProfilePage() {
  const navigate = useNavigate();
  const params = useParams();
  const {
    authUser,
    authCheckComplete,
    profileOptions,
    fetchProfileOptions,
    loadMyProfile,
    profileData,
    updateProfileField,
    toggleInterest,
    profileStatus,
    submitProfile,
    courses,
    fetchCourses,
    loadCourseProfile,
    saveCourseProfile,
  } = useApp();

  const courseIdParam = params?.courseId;
  const courseId = courseIdParam ? Number(courseIdParam) : null;
  const isCourseMode = Number.isFinite(courseId);

  const [username, setUsername] = useState("");
  const [localProfileData, setLocalProfileData] = useState(() =>
    createEmptyProfileData()
  );
  const [courseProfileStatus, setCourseProfileStatus] = useState({
    loading: false,
    message: "",
    error: "",
  });
  const [courseMeta, setCourseMeta] = useState(null);

  const formData = isCourseMode ? localProfileData : profileData;
  const activeStatus = isCourseMode ? courseProfileStatus : profileStatus;

  const handleFieldChange = (field, value) => {
    if (isCourseMode) {
      setLocalProfileData((prev) => ({ ...prev, [field]: value }));
    } else {
      updateProfileField(field, value);
    }
  };

  const handleInterestChange = (interest) => {
    if (isCourseMode) {
      setLocalProfileData((prev) => {
        const exists = prev.interests.includes(interest);
        const interests = exists
          ? prev.interests.filter((item) => item !== interest)
          : [...prev.interests, interest];
        return { ...prev, interests };
      });
    } else {
      toggleInterest(interest);
    }
  };

  const courseSummary = useMemo(() => {
    if (!isCourseMode || !courseId) return null;
    return courseMeta || courses.joined.find((c) => c.id === courseId) || null;
  }, [isCourseMode, courseId, courseMeta, courses.joined]);

  const courseLabel = useMemo(() => {
    if (!courseSummary) return "";
    const code = courseSummary.course_code || "";
    const name = courseSummary.name || "";
    if (code && name) return `${code} · ${name}`;
    return code || name || "";
  }, [courseSummary]);

  const heroTitle = isCourseMode
    ? `Set up your ${courseLabel || "course"} persona`
    : "Complete your profile";
  const heroCopy = isCourseMode
    ? "Share how you want to present yourself in this course. You only need to complete it once per course and can update it later."
    : "";
  const submitButtonLabel = activeStatus.loading
    ? "Saving..."
    : isCourseMode
    ? "Save & enter course"
    : "Save & continue";

  const [formErrors, setFormErrors] = useState({});
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const validate = useMemo(() => {
    const errors = {};
    const add = (key, msg) => {
      if (!errors[key]) errors[key] = msg;
    };
    const isEmpty = (v) => String(v ?? "").trim() === "";

    if (!isCourseMode) {
      if (isEmpty(username)) add("username", "Username is required.");
    }

    if (isEmpty(formData.gender)) add("gender", "Gender is required.");
    if (isEmpty(formData.city)) add("city", "City is required.");
    if (isEmpty(formData.age_group)) add("age_group", "Age group is required.");
    if (isEmpty(formData.education_level))
      add("education_level", "Education level is required.");
    if (isEmpty(formData.income_level))
      add("income_level", "Income level is required.");

    if (isEmpty(formData.content_preference))
      add("content_preference", "Preferred content is required.");
    if (!Array.isArray(formData.interests) || formData.interests.length === 0) {
      add("interests", "Please select at least one interest.");
    }

    if (isEmpty(formData.shopping_frequency))
      add("shopping_frequency", "Shopping frequency is required.");
    if (isEmpty(formData.buying_behavior))
      add("buying_behavior", "Buying behaviour is required.");
    if (isEmpty(formData.decision_factor))
      add("decision_factor", "Decision factor is required.");
    if (isEmpty(formData.shopping_preference))
      add("shopping_preference", "Shopping preference is required.");

    if (isEmpty(formData.digital_time))
      add("digital_time", "Social media usage is required.");
    if (isEmpty(formData.interaction_style))
      add("interaction_style", "Interaction style is required.");
    if (isEmpty(formData.influencer_type))
      add("influencer_type", "Influencer type is required.");

    return errors;
  }, [formData, isCourseMode, username]);

  const sectionHasError = useMemo(() => {
    const keys = Object.keys(validate || {});
    const has = (arr) => arr.some((k) => keys.includes(k));
    return {
      demographic: has([
        "username",
        "gender",
        "city",
        "age_group",
        "education_level",
        "income_level",
      ]),
      psychographic: has(["content_preference", "interests"]),
      behavioural: has([
        "shopping_frequency",
        "buying_behavior",
        "decision_factor",
        "shopping_preference",
      ]),
      digital: has(["digital_time", "interaction_style", "influencer_type"]),
    };
  }, [validate]);

  useEffect(() => {
    if (!authCheckComplete) return;
    if (!authUser) navigate("/login", { replace: true });
  }, [authUser, authCheckComplete, navigate]);

  useEffect(() => {
    if (!authUser) return;
    if (!isCourseMode) {
      setUsername((authUser.username || "").trim());
      loadMyProfile().catch(() => {});
    }
    fetchProfileOptions().catch(() => {});
  }, [authUser, fetchProfileOptions, isCourseMode, loadMyProfile]);

  useEffect(() => {
    if (!authUser || !isCourseMode) return;
    fetchCourses().catch(() => {});
  }, [authUser, isCourseMode, fetchCourses]);

  useEffect(() => {
    if (!authUser || !isCourseMode || !courseId) return;
    let cancelled = false;
    setCourseProfileStatus((prev) => ({ ...prev, loading: true, error: "" }));
    loadCourseProfile(courseId)
      .then((data) => {
        if (cancelled) return;
        setCourseMeta(data.course || null);
        if (data.profile) {
          setLocalProfileData({ ...createEmptyProfileData(), ...data.profile });
        } else {
          setLocalProfileData(createEmptyProfileData());
        }
        setCourseProfileStatus({ loading: false, message: "", error: "" });
      })
      .catch((error) => {
        if (cancelled) return;
        setCourseProfileStatus({
          loading: false,
          message: "",
          error: error.message || "Unable to load course profile.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [authUser, isCourseMode, courseId, loadCourseProfile]);

  useEffect(() => {
    if (!isCourseMode) {
      setCourseProfileStatus({ loading: false, message: "", error: "" });
      setLocalProfileData(() => createEmptyProfileData());
    }
  }, [isCourseMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAttemptedSubmit(true);
    setFormErrors(validate);
    if (Object.keys(validate).length > 0) {
      // Context: Compute shared values once so all branches use the same normalized inputs.
      // Context: Compute shared values once so all branches use the same normalized inputs.
      return;
    }
    if (isCourseMode && courseId) {
      setCourseProfileStatus({ loading: true, message: "", error: "" });
      try {
        await saveCourseProfile(courseId, formData);
        setCourseProfileStatus({
          loading: false,
          message: "Course profile saved!",
          error: "",
        });
        await fetchCourses().catch(() => {});
        navigate(`/courses/${courseId}`, { replace: true });
      } catch (error) {
        setCourseProfileStatus({
          loading: false,
          message: "",
          error: error.message,
        });
      }
      return;
    }

    const overrides = username ? { username } : undefined;
    const ok = await submitProfile(overrides);
    if (ok) navigate("/courses", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-accent-50 text-slate-900 flex flex-col">
      {/* Context: Keep related UI rendering and event handlers together for predictable updates. Reason: Grouping this logic makes interaction flows easier to debug and extend. */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-3 py-3 sm:px-6 sm:py-5">
        <div className="flex items-center gap-3">
          <img
            src="/logo.jpg"
            alt="Bread Logo"
            className="h-8 w-8 rounded-xl object-cover ring-1 ring-brand-100 shadow-sm sm:h-9 sm:w-9"
          />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-slate-900 sm:text-base">
              Bread
            </div>
            <div className="text-[11px] text-slate-500 sm:text-xs">
              Account setup
            </div>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2" />
      </header>

      {/* Context: Keep related UI rendering and event handlers together for predictable updates. Reason: Grouping this logic makes interaction flows easier to debug and extend. */}
      <main className="flex-1 mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-10">
        <section className="mx-auto w-full max-w-2xl">
          <div className="space-y-3 sm:space-y-4">
            <h1 className="text-2xl font-extrabold tracking-tight break-words sm:text-4xl">
              {heroTitle}
            </h1>
            <p className="text-sm break-words text-slate-600 sm:text-base">
              {isCourseMode && courseLabel ? (
                <span className="block text-sm font-semibold text-slate-500">
                  {courseLabel}
                </span>
              ) : null}
              {heroCopy}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="rounded-full border border-brand-100 bg-white/70 px-3 py-1 text-[11px] font-semibold text-slate-600">
                Takes about 1 minute
              </span>
            </div>
          </div>

          <div className="mt-5 sm:mt-6 relative w-full rounded-3xl border border-brand-100 bg-white/95 p-4 sm:p-8 shadow-xl shadow-brand-100 backdrop-blur">
            <div className="absolute right-0 top-0 h-16 w-16 rounded-bl-3xl bg-gradient-to-b from-brand/10 to-brand/0" />

            {!profileOptions ? (
              <p className="text-sm text-slate-500">Loading your profile…</p>
            ) : (
              <form className="space-y-5 sm:space-y-6" onSubmit={handleSubmit}>
                {attemptedSubmit && Object.keys(formErrors || {}).length ? (
                  <div
                    className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                    role="alert"
                  >
                    Please complete all required fields highlighted in red.
                  </div>
                ) : null}
                {/* Context: Keep related UI rendering and event handlers together for predictable updates. Reason: Grouping this logic makes interaction flows easier to debug and extend. */}
                <EditSection
                  emoji="🧾"
                  title="Demographic"
                  tone="mint"
                  defaultOpen
                  forceOpen={attemptedSubmit && sectionHasError.demographic}
                  hasError={attemptedSubmit && sectionHasError.demographic}
                >
                  <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
                    {!isCourseMode && (
                      <FieldText
                        label="Username"
                        value={username}
                        onChange={setUsername}
                        placeholder="Please enter your username"
                        className="md:col-span-2"
                        required
                        error={attemptedSubmit ? formErrors.username : ""}
                      />
                    )}
                    <FieldSelect
                      label="Gender"
                      value={formData.gender}
                      options={profileOptions.genders}
                      onChange={(v) => handleFieldChange("gender", v)}
                      help="Choose the option that best describes you."
                      error={attemptedSubmit ? formErrors.gender : ""}
                    />
                    <FieldSelect
                      label="City"
                      value={formData.city}
                      options={profileOptions.cities}
                      onChange={(v) => handleFieldChange("city", v)}
                      help="Where you currently live."
                      error={attemptedSubmit ? formErrors.city : ""}
                    />
                    <FieldSelect
                      label="Age Group"
                      value={formData.age_group}
                      options={profileOptions.age_groups}
                      onChange={(v) => handleFieldChange("age_group", v)}
                      error={attemptedSubmit ? formErrors.age_group : ""}
                    />
                    <FieldSelect
                      label="Education Level"
                      value={formData.education_level}
                      options={profileOptions.education_levels}
                      onChange={(v) => handleFieldChange("education_level", v)}
                      error={attemptedSubmit ? formErrors.education_level : ""}
                    />
                    <FieldSelect
                      label="Income Level"
                      value={formData.income_level}
                      options={profileOptions.income_levels}
                      onChange={(v) => handleFieldChange("income_level", v)}
                      error={attemptedSubmit ? formErrors.income_level : ""}
                    />
                  </div>
                </EditSection>

                {/* Context: Keep related UI rendering and event handlers together for predictable updates. Reason: Grouping this logic makes interaction flows easier to debug and extend. */}
                <EditSection
                  emoji="🧠"
                  title="Psychographic"
                  tone="peach"
                  forceOpen={attemptedSubmit && sectionHasError.psychographic}
                  hasError={attemptedSubmit && sectionHasError.psychographic}
                >
                  <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
                    <FieldSlider
                      label="Social Value"
                      value={formData.social_value}
                      onChange={(v) => handleFieldChange("social_value", v)}
                    />
                    <FieldSlider
                      label="Sociability"
                      value={formData.sociability}
                      onChange={(v) => handleFieldChange("sociability", v)}
                    />
                    <FieldSlider
                      label="Openness to new experiences"
                      value={formData.openness}
                      onChange={(v) => handleFieldChange("openness", v)}
                    />
                    <FieldSelect
                      label="Preferred Content"
                      value={formData.content_preference}
                      options={profileOptions.content_preference}
                      onChange={(v) =>
                        handleFieldChange("content_preference", v)
                      }
                      error={attemptedSubmit ? formErrors.content_preference : ""}
                    />
                  </div>

                  <FieldInterests
                    label="Lifestyle Interests"
                    interests={profileOptions.interests}
                    selected={formData.interests}
                    toggleInterest={handleInterestChange}
                    error={attemptedSubmit ? formErrors.interests : ""}
                  />
                </EditSection>

                {/* Context: Keep related UI rendering and event handlers together for predictable updates. Reason: Grouping this logic makes interaction flows easier to debug and extend. */}
                <EditSection
                  emoji="🛒"
                  title="Behavioural / Shopping Habits"
                  tone="lilac"
                  forceOpen={attemptedSubmit && sectionHasError.behavioural}
                  hasError={attemptedSubmit && sectionHasError.behavioural}
                >
                  <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
                    <FieldSelect
                      label="Shopping Frequency"
                      value={formData.shopping_frequency}
                      options={profileOptions.shopping_frequency}
                      onChange={(v) =>
                        handleFieldChange("shopping_frequency", v)
                      }
                      error={attemptedSubmit ? formErrors.shopping_frequency : ""}
                    />
                    <FieldSelect
                      label="Buying Behaviour"
                      value={formData.buying_behavior}
                      options={profileOptions.buying_behavior}
                      onChange={(v) => handleFieldChange("buying_behavior", v)}
                      error={attemptedSubmit ? formErrors.buying_behavior : ""}
                    />
                    <FieldSelect
                      label="Decision Factor"
                      value={formData.decision_factor}
                      options={profileOptions.decision_factors}
                      onChange={(v) => handleFieldChange("decision_factor", v)}
                      error={attemptedSubmit ? formErrors.decision_factor : ""}
                    />
                    <FieldSelect
                      label="Shopping Preference"
                      value={formData.shopping_preference}
                      options={profileOptions.shopping_preference}
                      onChange={(v) =>
                        handleFieldChange("shopping_preference", v)
                      }
                      error={attemptedSubmit ? formErrors.shopping_preference : ""}
                    />
                  </div>
                </EditSection>

                {/* Context: Keep related UI rendering and event handlers together for predictable updates. Reason: Grouping this logic makes interaction flows easier to debug and extend. */}
                <EditSection
                  emoji="💬"
                  title="Digital / Social Media"
                  tone="mint"
                  forceOpen={attemptedSubmit && sectionHasError.digital}
                  hasError={attemptedSubmit && sectionHasError.digital}
                >
                  <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
                    <FieldSelect
                      label="Social Media Usage"
                      value={formData.digital_time}
                      options={profileOptions.digital_time}
                      onChange={(v) => handleFieldChange("digital_time", v)}
                      error={attemptedSubmit ? formErrors.digital_time : ""}
                    />
                    <FieldSelect
                      label="Interaction Style"
                      value={formData.interaction_style}
                      options={profileOptions.interaction_style}
                      onChange={(v) =>
                        handleFieldChange("interaction_style", v)
                      }
                      error={attemptedSubmit ? formErrors.interaction_style : ""}
                    />
                    <FieldSelect
                      label="Influencer Type"
                      value={formData.influencer_type}
                      options={profileOptions.influencer_type}
                      onChange={(v) => handleFieldChange("influencer_type", v)}
                      error={attemptedSubmit ? formErrors.influencer_type : ""}
                    />
                  </div>
                </EditSection>

                {/* Context: Keep related UI rendering and event handlers together for predictable updates. Reason: Grouping this logic makes interaction flows easier to debug and extend. */}
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="submit"
                    className="rounded-full bg-gradient-to-r from-brand to-brand-dark px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-200 transition hover:from-brand-dark hover:to-brand disabled:opacity-60"
                    disabled={activeStatus.loading}
                  >
                    {submitButtonLabel}
                  </button>
                </div>

                <Feedback
                  message={activeStatus.message}
                  error={activeStatus.error}
                />
              </form>
            )}
          </div>
        </section>
      </main>

      <footer className="py-6 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} Bread Capstone Team. All rights reserved.
      </footer>
    </div>
  );
}
