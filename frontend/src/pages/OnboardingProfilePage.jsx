// src/pages/OnboardingProfilePage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp, createEmptyProfileData } from "../context/AppContext";
import Feedback from "./components/Feedback";
import CircleImage from "./components/CircleImage";

/* ---------- Unified right-hand form sections ---------- */
function EditSection({ emoji = "", title, desc, children }) {
  return (
    <section className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h3 className="inline-flex items-center gap-2 text-base font-semibold text-slate-900">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-orange-100 text-sm">
            {emoji}
          </span>
          {title}
        </h3>
        {desc ? (
          <p className="max-w-[420px] text-right text-xs text-slate-500">
            {desc}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
function FieldBlock({ children, className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-orange-200 bg-orange-50/30 p-3 ${className}`}
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

/* ---------- Field controls (styling only) ---------- */
function FieldText({
  label,
  value,
  onChange,
  placeholder,
  className = "",
  required,
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
        className="w-full rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
      <Help>Used for mentions and discovery.</Help>
    </FieldBlock>
  );
}
function FieldSelect({ label, value, options, onChange, help }) {
  return (
    <FieldBlock>
      <Label title={label} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full appearance-none rounded-xl border border-orange-200 bg-white px-3 py-2 pr-8 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
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
      {help ? <Help>{help}</Help> : null}
    </FieldBlock>
  );
}
function FieldSlider({ label, value, onChange }) {
  return (
    <FieldBlock>
      <Label title={label} />
      {/* Vertical layout so sliders auto-fit the width */}
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
          className="w-full accent-orange-500"
        />
      </div>
      <Help>Drag to adjust (1–10).</Help>
    </FieldBlock>
  );
}
function FieldInterests({ label, interests, selected, toggleInterest }) {
  return (
    <FieldBlock className="mt-2 md:col-span-2">
      <Label title={label} />
      <div className="rounded-xl border border-orange-200 bg-white/70 p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {(interests || []).map((interest) => {
            const active = (selected || []).includes(interest);
            return (
              <label
                key={interest}
                className={`cursor-pointer rounded-xl px-3 py-2 text-xs font-medium transition ${
                  active
                    ? "border border-brand bg-white text-brand shadow-sm"
                    : "border border-transparent bg-white text-slate-600 hover:border-orange-200"
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
      <Help className="mt-2">Pick anything that describes your lifestyle.</Help>
    </FieldBlock>
  );
}

/* ========================= Page layout ========================= */
export default function OnboardingProfilePage() {
  const navigate = useNavigate();
  const params = useParams();
  const {
    authUser,
    authCheckComplete,
    profileOptions,
    fetchProfileOptions,
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
    : "When you first log in, you need to complete your information so that we can provide you with more relevant content and course recommendations. You can update this information at any time in your profile.";
  const submitButtonLabel = activeStatus.loading
    ? "Saving..."
    : isCourseMode
    ? "Save & enter course"
    : "Save & continue";

  useEffect(() => {
    if (!authCheckComplete) return;
    if (!authUser) navigate("/login", { replace: true });
  }, [authUser, authCheckComplete, navigate]);

  useEffect(() => {
    if (!authUser) return;
    if (!isCourseMode) {
      setUsername((authUser.username || "").trim());
    }
    fetchProfileOptions().catch(() => {});
  }, [authUser, fetchProfileOptions, isCourseMode]);

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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-100 text-slate-900 flex flex-col">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <img
            src="/logo.jpg"
            alt="Donut Logo"
            className="h-8 w-8 rounded-md object-cover mix-blend-multiply"
          />
          <span className="text-xl font-semibold text-brand-dark">
            Donut campus social simulation platform
          </span>
        </div>
        <div />
      </header>

      {/* Layout: static left copy + segmented form on the right */}
      <main className="flex-1 mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:gap-10 sm:px-6 lg:flex-row lg:items-start">
        {/* Left copy / decoration — unchanged */}
        <section className="order-1 lg:order-none relative flex-1 md:min-h-[460px] lg:min-h-[520px] pt-2 lg:pt-6">
          <div className="relative z-10 space-y-4 max-w-[560px]">
            <h1 className="text-3xl font-bold sm:text-4xl">{heroTitle}</h1>
            <p className="text-slate-600">
              {isCourseMode && courseLabel ? (
                <span className="block text-sm font-semibold text-slate-500">
                  {courseLabel}
                </span>
              ) : null}
              {heroCopy}
            </p>
          </div>

          <div className="absolute inset-0 hidden md:block pointer-events-none z-0">
            <CircleImage
              src="/logo.jpg"
              alt="circle-1"
              className="absolute left-40 top-20 h-64 w-64 animate-floatBigFast"
              style={{ animationDelay: "0s" }}
            />
            <CircleImage
              src="/logo.jpg"
              alt="circle-2"
              className="absolute left-[26rem] top-40 h-40 w-40 animate-floatBigFast"
              style={{ animationDelay: "1.2s" }}
            />
            <CircleImage
              src="/logo.jpg"
              alt="circle-3"
              className="absolute left-12 bottom-12 h-24 w-24 animate-floatFast"
              style={{ animationDelay: "2.4s" }}
            />
          </div>
        </section>

        {/* Right form (new layout) */}
        <aside className="order-2 lg:order-none flex-1">
          <div className="relative w-full max-w-2xl lg:ml-auto rounded-3xl border border-orange-100 bg-white p-6 sm:p-8 shadow-xl shadow-orange-100">
            <div className="absolute right-0 top-0 h-16 w-16 rounded-bl-3xl bg-gradient-to-b from-brand/10 to-brand/0" />

            {!profileOptions ? (
              <p className="text-sm text-slate-500">Loading your profile…</p>
            ) : (
              <form className="space-y-6" onSubmit={handleSubmit}>
                {/* Demographic */}
                <EditSection
                  title="Demographic"
                  desc="Prompts are on the left; options are on the right."
                >
                  <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
                    {!isCourseMode && (
                      <FieldText
                        label="Username"
                        value={username}
                        onChange={setUsername}
                        placeholder="Please enter your username"
                        className="md:col-span-2"
                        required
                      />
                    )}
                    <FieldSelect
                      label="Gender"
                      value={formData.gender}
                      options={profileOptions.genders}
                      onChange={(v) => handleFieldChange("gender", v)}
                      help="Choose the option that best describes you."
                    />
                    <FieldSelect
                      label="City"
                      value={formData.city}
                      options={profileOptions.cities}
                      onChange={(v) => handleFieldChange("city", v)}
                      help="Where you currently live."
                    />
                    <FieldSelect
                      label="Age Group"
                      value={formData.age_group}
                      options={profileOptions.age_groups}
                      onChange={(v) => handleFieldChange("age_group", v)}
                    />
                    <FieldSelect
                      label="Education Level"
                      value={formData.education_level}
                      options={profileOptions.education_levels}
                      onChange={(v) => handleFieldChange("education_level", v)}
                    />
                    <FieldSelect
                      label="Income Level"
                      value={formData.income_level}
                      options={profileOptions.income_levels}
                      onChange={(v) => handleFieldChange("income_level", v)}
                    />
                  </div>
                </EditSection>

                {/* Psychographic */}
                <EditSection
                  title="Psychographic"
                  desc="Your attitudes and preferences."
                >
                  <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
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
                    />
                  </div>

                  <FieldInterests
                    label="Lifestyle Interests"
                    interests={profileOptions.interests}
                    selected={formData.interests}
                    toggleInterest={handleInterestChange}
                  />
                </EditSection>

                {/* Behavioural */}
                <EditSection
                  title="Behavioural / Shopping Habits"
                  desc="How you shop and decide."
                >
                  <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
                    <FieldSelect
                      label="Shopping Frequency"
                      value={formData.shopping_frequency}
                      options={profileOptions.shopping_frequency}
                      onChange={(v) =>
                        handleFieldChange("shopping_frequency", v)
                      }
                    />
                    <FieldSelect
                      label="Buying Behaviour"
                      value={formData.buying_behavior}
                      options={profileOptions.buying_behavior}
                      onChange={(v) => handleFieldChange("buying_behavior", v)}
                    />
                    <FieldSelect
                      label="Decision Factor"
                      value={formData.decision_factor}
                      options={profileOptions.decision_factors}
                      onChange={(v) => handleFieldChange("decision_factor", v)}
                    />
                    <FieldSelect
                      label="Shopping Preference"
                      value={formData.shopping_preference}
                      options={profileOptions.shopping_preference}
                      onChange={(v) =>
                        handleFieldChange("shopping_preference", v)
                      }
                    />
                  </div>
                </EditSection>

                {/* Digital */}
                <EditSection
                  title="Digital / Social Media"
                  desc="Online time and interaction style."
                >
                  <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
                    <FieldSelect
                      label="Social Media Usage"
                      value={formData.digital_time}
                      options={profileOptions.digital_time}
                      onChange={(v) => handleFieldChange("digital_time", v)}
                    />
                    <FieldSelect
                      label="Interaction Style"
                      value={formData.interaction_style}
                      options={profileOptions.interaction_style}
                      onChange={(v) =>
                        handleFieldChange("interaction_style", v)
                      }
                    />
                    <FieldSelect
                      label="Influencer Type"
                      value={formData.influencer_type}
                      options={profileOptions.influencer_type}
                      onChange={(v) => handleFieldChange("influencer_type", v)}
                    />
                  </div>
                </EditSection>

                {/* Submit */}
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="submit"
                    className="rounded-full bg-gradient-to-r from-brand to-brand-dark px-5 py-2 text-sm font-semibold text-white shadow-md shadow-orange-200 transition hover:from-brand-dark hover:to-brand disabled:opacity-60"
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
        </aside>
      </main>

      <footer className="py-6 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} Donut Capstone Team. All rights reserved.
      </footer>
    </div>
  );
}
