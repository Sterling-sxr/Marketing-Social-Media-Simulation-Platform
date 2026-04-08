import { useEffect, useMemo, useState } from "react";
import Feedback from "../../components/Feedback";
import { postJson } from "../../../lib/api";

const GOAL_CARDS = [
  {
    value: "broad_audience",
    label: "Explore Broad Audience",
    description: "Maximize audience coverage so students can test what attracts different people.",
  },
  {
    value: "theme",
    label: "Focus on a Theme",
    description: "Generate a tighter audience around one interest area with controlled variation.",
  },
  {
    value: "conversion_style",
    label: "Focus on Conversion Style",
    description: "Center personas around different purchase decision drivers for marketing experiments.",
  },
  {
    value: "engagement_style",
    label: "Focus on Engagement Style",
    description: "Bias the set toward different content preferences and likely interaction responses.",
  },
];

const COVERAGE_OPTIONS = [
  { value: "wide", label: "Wide" },
  { value: "balanced", label: "Balanced" },
  { value: "tight", label: "Tight" },
];

const ACTIVITY_OPTIONS = [
  { value: "low", label: "Low activity" },
  { value: "mixed", label: "Mixed activity" },
  { value: "high", label: "High activity" },
];

const INTEREST_LEAN_OPTIONS = [
  { value: "mixed", label: "Mixed" },
  { value: "tech", label: "Tech" },
  { value: "lifestyle", label: "Lifestyle" },
];

const THEME_CARD_OPTIONS = [
  { value: "tech_gaming", label: "Tech & Gaming" },
  { value: "fashion_shopping", label: "Fashion & Shopping" },
  { value: "travel_food", label: "Travel & Food" },
  { value: "arts_culture", label: "Arts & Culture" },
  { value: "social_issues", label: "Social Issues" },
  { value: "creator_trend", label: "Creator / Trend" },
];

const DECISION_DRIVER_OPTIONS = [
  { value: "Price", label: "Price" },
  { value: "Quality/durability", label: "Quality / durability" },
  { value: "Brand image", label: "Brand image" },
  { value: "Eco-friendly", label: "Eco-friendly" },
  { value: "Convenience", label: "Convenience" },
];

const CONTENT_PREFERENCE_OPTIONS = [
  { value: "Funny short posts/memes", label: "Funny short posts / memes" },
  { value: "Pictures or videos", label: "Pictures or videos" },
  { value: "Thoughtful opinions", label: "Thoughtful opinions" },
  { value: "Detailed reviews or long posts", label: "Detailed reviews or long posts" },
];

const INTERACTION_INTENSITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "mixed", label: "Balanced" },
  { value: "high", label: "High" },
];

const EMPTY_SMART_FORM = {
  goal: "broad_audience",
  count: 8,
  coverage: "balanced",
  activity_level: "mixed",
  interest_lean: "mixed",
  theme_card: "",
  tightness: "balanced",
  decision_driver: "Price",
  content_preference_bias: "Pictures or videos",
  interaction_intensity: "mixed",
  gender: "",
  age_group: "",
  education_level: "",
  income_level: "",
};

function createDraftId(item, index) {
  return `${item.username || "draft"}-${index}`;
}

function normalizeDrafts(items = []) {
  return items.map((item, index) => ({
    ...item,
    _draftId: createDraftId(item, index),
  }));
}

function stripDraftMeta(item) {
  const { _draftId, warnings, ...cleaned } = item;
  return cleaned;
}

function summarizeList(values) {
  if (!values.length) return "a varied audience mix";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, 2).join(", ")}, and ${values[2]}`;
}

function countValues(items, getter) {
  const counts = new Map();
  items.forEach((item) => {
    getter(item)
      .filter(Boolean)
      .forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  });
  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
}

function getGoalLabel(goal) {
  return GOAL_CARDS.find((card) => card.value === goal)?.label || "Smart Generate";
}

function buildCoverageSummary(drafts, smartProfile, smartForm) {
  const interests = countValues(drafts, (item) => item.interests || []);
  const interactions = countValues(drafts, (item) => [item.interaction_style || ""]);
  const content = countValues(drafts, (item) => [item.content_preference || ""]);
  const decisions = countValues(drafts, (item) => [item.decision_factor || ""]);
  const activityMix = countValues(drafts, (item) => [item.digital_time || ""]);
  const goal = smartProfile?.goal || smartForm.goal;
  const goalLabel = smartProfile?.goal_label || getGoalLabel(goal);

  if (goal === "theme") {
    const themeLabel =
      smartProfile?.theme_label ||
      THEME_CARD_OPTIONS.find((option) => option.value === smartForm.theme_card)?.label ||
      "selected theme";
    return {
      signal: goalLabel,
      summaryText: `This preview keeps ${drafts.length} personas centered on ${themeLabel} while preserving smaller differences in activity, content preference, and purchase behavior.`,
      groups: [
        {
          title: "Theme interests",
          value: interests.slice(0, 4).map(([label]) => label).join(" / ") || themeLabel,
        },
        {
          title: "Content preferences",
          value: content.slice(0, 4).map(([label]) => label).join(" / ") || "Theme-aligned content",
        },
        {
          title: "Interaction tendencies",
          value: interactions.slice(0, 4).map(([label]) => label).join(" / ") || "Mixed interactions",
        },
        {
          title: "Decision drivers",
          value: decisions.slice(0, 4).map(([label]) => label).join(" / ") || "Mixed decision factors",
        },
      ],
    };
  }

  if (goal === "conversion_style") {
    const focus =
      smartProfile?.decision_driver || smartForm.decision_driver || "conversion drivers";
    return {
      signal: goalLabel,
      summaryText: `This preview organizes ${drafts.length} personas around ${focus} and nearby decision patterns so students can test what content moves different buyers.`,
      groups: [
        {
          title: "Decision drivers",
          value: decisions.slice(0, 4).map(([label]) => label).join(" / ") || focus,
        },
        {
          title: "Buying behavior",
          value: countValues(drafts, (item) => [item.buying_behavior || ""])
            .slice(0, 4)
            .map(([label]) => label)
            .join(" / ") || "Mixed buying styles",
        },
        {
          title: "Content preferences",
          value: content.slice(0, 4).map(([label]) => label).join(" / ") || "Mixed content types",
        },
        {
          title: "Activity mix",
          value: activityMix.slice(0, 4).map(([label]) => label).join(" / ") || "Mixed activity",
        },
      ],
    };
  }

  if (goal === "engagement_style") {
    const focus =
      smartProfile?.content_preference_bias ||
      smartForm.content_preference_bias ||
      "engagement styles";
    return {
      signal: goalLabel,
      summaryText: `This preview biases ${drafts.length} personas toward ${focus} and pairs that preference with different response intensities so students can compare likely engagement reactions.`,
      groups: [
        {
          title: "Content preferences",
          value: content.slice(0, 4).map(([label]) => label).join(" / ") || focus,
        },
        {
          title: "Interaction tendencies",
          value: interactions.slice(0, 4).map(([label]) => label).join(" / ") || "Mixed interactions",
        },
        {
          title: "Activity mix",
          value: activityMix.slice(0, 4).map(([label]) => label).join(" / ") || "Mixed activity",
        },
        {
          title: "Top interests",
          value: interests.slice(0, 4).map(([label]) => label).join(" / ") || "Mixed interests",
        },
      ],
    };
  }

  return {
    signal: goalLabel,
    summaryText: `This preview contains ${drafts.length} rule-generated personas covering ${summarizeList(
      interests.slice(0, 3).map(([label]) => label)
    )}, so students can test which posts attract which audience pockets.`,
    groups: [
      {
        title: "Interest coverage",
        value: interests.slice(0, 4).map(([label]) => label).join(" / ") || "Mixed interests",
      },
      {
        title: "Interaction tendencies",
        value: interactions.slice(0, 4).map(([label]) => label).join(" / ") || "Mixed interactions",
      },
      {
        title: "Content preferences",
        value: content.slice(0, 4).map(([label]) => label).join(" / ") || "Mixed content types",
      },
      {
        title: "Decision drivers",
        value: decisions.slice(0, 4).map(([label]) => label).join(" / ") || "Mixed decision factors",
      },
    ],
  };
}

function pickRepresentativeDrafts(drafts, smartProfile, smartForm) {
  const goal = smartProfile?.goal || smartForm.goal;
  const seen = new Set();
  const items = [];

  drafts.forEach((draft) => {
    let key = [draft.interests?.[0] || "", draft.content_preference || "", draft.interaction_style || ""].join("|");
    if (goal === "theme") {
      key = [draft.content_preference || "", draft.interaction_style || "", draft.age_group || ""].join("|");
    } else if (goal === "conversion_style") {
      key = [draft.decision_factor || "", draft.buying_behavior || "", draft.content_preference || ""].join("|");
    } else if (goal === "engagement_style") {
      key = [draft.content_preference || "", draft.interaction_style || "", draft.digital_time || ""].join("|");
    }
    if (seen.has(key)) return;
    seen.add(key);
    items.push(draft);
  });

  return items.slice(0, 5);
}

export default function AIPersonaCreationModal({
  mode,
  courseId,
  onClose,
  onCommitted,
  profileOptions = {},
}) {
  const isOpen = Boolean(mode);
  const [step, setStep] = useState("input");
  const [smartForm, setSmartForm] = useState(EMPTY_SMART_FORM);
  const [drafts, setDrafts] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [error, setError] = useState("");
  const [previewBusy, setPreviewBusy] = useState(false);
  const [commitBusy, setCommitBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [smartProfile, setSmartProfile] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setStep("input");
    setSmartForm(EMPTY_SMART_FORM);
    setDrafts([]);
    setWarnings([]);
    setError("");
    setPreviewBusy(false);
    setCommitBusy(false);
    setShowAll(false);
    setShowAdvanced(false);
    setSmartProfile(null);
  }, [isOpen]);

  const coverage = useMemo(
    () => buildCoverageSummary(drafts, smartProfile, smartForm),
    [drafts, smartProfile, smartForm]
  );
  const representativeDrafts = useMemo(
    () => pickRepresentativeDrafts(drafts, smartProfile, smartForm),
    [drafts, smartProfile, smartForm]
  );
  const activeThemeLabel =
    smartProfile?.theme_label ||
    THEME_CARD_OPTIONS.find((option) => option.value === smartForm.theme_card)?.label ||
    "";

  if (!isOpen) return null;

  const updateField = (field, value) => {
    setSmartForm((prev) => ({ ...prev, [field]: value }));
  };

  const setGoal = (goal) => {
    setSmartForm((prev) => ({
      ...prev,
      goal,
      coverage: goal === "broad_audience" ? prev.coverage : "balanced",
      interest_lean: goal === "broad_audience" ? prev.interest_lean : "mixed",
      theme_card: goal === "theme" ? prev.theme_card : "",
      tightness: goal === "broad_audience" ? prev.tightness : "balanced",
      decision_driver: goal === "conversion_style" ? prev.decision_driver : "Price",
      content_preference_bias:
        goal === "engagement_style" ? prev.content_preference_bias : "Pictures or videos",
      interaction_intensity: goal === "engagement_style" ? prev.interaction_intensity : "mixed",
    }));
  };

  const buildPayload = () => {
    const payload = {
      goal: smartForm.goal,
      count: Number(smartForm.count),
      activity_level: smartForm.activity_level,
    };

    if (smartForm.goal === "broad_audience") {
      payload.coverage = smartForm.coverage;
      payload.interest_lean = smartForm.interest_lean;
    }

    if (smartForm.goal === "theme") {
      payload.theme_card = smartForm.theme_card;
      payload.tightness = smartForm.tightness;
    }

    if (smartForm.goal === "conversion_style") {
      payload.decision_driver = smartForm.decision_driver;
      payload.tightness = smartForm.tightness;
    }

    if (smartForm.goal === "engagement_style") {
      payload.content_preference_bias = smartForm.content_preference_bias;
      payload.interaction_intensity = smartForm.interaction_intensity;
    }

    ["gender", "age_group", "education_level", "income_level"].forEach((field) => {
      if (smartForm[field]) {
        payload[field] = smartForm[field];
      }
    });

    return payload;
  };

  const runPreview = async () => {
    setPreviewBusy(true);
    setError("");
    try {
      const data = await postJson(`/api/courses/${courseId}/ai-users/guided-preview/`, buildPayload());
      setDrafts(normalizeDrafts(data.items || []));
      setWarnings(data.warnings || []);
      setSmartProfile(data.smart_profile || null);
      setShowAll(false);
      setStep("preview");
    } catch (err) {
      setError(err.message || "Failed to load persona preview.");
    } finally {
      setPreviewBusy(false);
    }
  };

  const handleCommit = async () => {
    setCommitBusy(true);
    setError("");
    try {
      const data = await postJson(`/api/courses/${courseId}/ai-users/guided-commit/`, {
        items: drafts.map(stripDraftMeta),
      });
      await onCommitted?.(data);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to commit AI personas.");
    } finally {
      setCommitBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[95vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl shadow-brand-200">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Smart Generate</h2>
            <p className="text-xs text-slate-500">
              Choose a teaching goal first, then steer the audience mix with a few high-level controls.
            </p>
          </div>
          <button
            type="button"
            className="rounded-full border border-brand-200 px-4 py-2 text-xs font-semibold text-slate-500 transition hover:border-brand-300 hover:text-brand"
            onClick={onClose}
            disabled={previewBusy || commitBusy}
          >
            Close
          </button>
        </header>

        {error ? <Feedback error={error} /> : null}
        {warnings.length ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            {warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}

        {step === "input" ? (
          <section className="mt-6 space-y-5">
            <div className="rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-brand-50/30 p-5">
              <h3 className="text-xl font-semibold text-slate-900">
                Pick the kind of classroom experiment you want to run
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Smart Generate keeps the persona schema fixed, then composes a batch from goal-driven rules instead of external AI prompts.
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Generation Goal
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {GOAL_CARDS.map((card) => (
                  <button
                    key={card.value}
                    type="button"
                    aria-pressed={smartForm.goal === card.value}
                    onClick={() => setGoal(card.value)}
                    className={`rounded-3xl border p-4 text-left transition ${
                      smartForm.goal === card.value
                        ? "border-brand bg-brand-50 shadow-sm"
                        : "border-brand-100 bg-white hover:border-brand-300"
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">{card.label}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-600">{card.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <NumberField
                label="Number of users"
                value={smartForm.count}
                onChange={(value) => updateField("count", value)}
              />
              <SelectField
                label="Activity level"
                value={smartForm.activity_level}
                onChange={(value) => updateField("activity_level", value)}
                options={ACTIVITY_OPTIONS}
              />
              {smartForm.goal === "broad_audience" ? (
                <>
                  <SelectField
                    label="Coverage"
                    value={smartForm.coverage}
                    onChange={(value) => updateField("coverage", value)}
                    options={COVERAGE_OPTIONS}
                  />
                  <SelectField
                    label="Interest lean"
                    value={smartForm.interest_lean}
                    onChange={(value) => updateField("interest_lean", value)}
                    options={INTEREST_LEAN_OPTIONS}
                  />
                </>
              ) : null}
              {smartForm.goal === "theme" ? (
                <>
                  <SelectField
                    label="Theme card"
                    value={smartForm.theme_card}
                    onChange={(value) => updateField("theme_card", value)}
                    options={THEME_CARD_OPTIONS}
                  />
                  <SelectField
                    label="Audience tightness"
                    value={smartForm.tightness}
                    onChange={(value) => updateField("tightness", value)}
                    options={COVERAGE_OPTIONS}
                  />
                </>
              ) : null}
              {smartForm.goal === "conversion_style" ? (
                <>
                  <SelectField
                    label="Decision driver"
                    value={smartForm.decision_driver}
                    onChange={(value) => updateField("decision_driver", value)}
                    options={DECISION_DRIVER_OPTIONS}
                  />
                  <SelectField
                    label="Audience tightness"
                    value={smartForm.tightness}
                    onChange={(value) => updateField("tightness", value)}
                    options={COVERAGE_OPTIONS}
                  />
                </>
              ) : null}
              {smartForm.goal === "engagement_style" ? (
                <>
                  <SelectField
                    label="Content preference bias"
                    value={smartForm.content_preference_bias}
                    onChange={(value) => updateField("content_preference_bias", value)}
                    options={CONTENT_PREFERENCE_OPTIONS}
                  />
                  <SelectField
                    label="Interaction intensity"
                    value={smartForm.interaction_intensity}
                    onChange={(value) => updateField("interaction_intensity", value)}
                    options={INTERACTION_INTENSITY_OPTIONS}
                  />
                </>
              ) : null}
            </div>

            <div className="rounded-2xl border border-brand-100 bg-white p-4">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left"
                onClick={() => setShowAdvanced((prev) => !prev)}
              >
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Advanced</h3>
                  <p className="text-xs text-slate-500">
                    Optionally constrain a few demographic fields without dropping into full persona editing.
                  </p>
                </div>
                <span className="text-sm font-semibold text-brand">{showAdvanced ? "Hide" : "Show"}</span>
              </button>
              {showAdvanced ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <SelectField
                    label="Gender"
                    value={smartForm.gender}
                    onChange={(value) => updateField("gender", value)}
                    options={(profileOptions.genders || []).map((value) => ({ value, label: value }))}
                    placeholder="Any gender"
                  />
                  <SelectField
                    label="Age group"
                    value={smartForm.age_group}
                    onChange={(value) => updateField("age_group", value)}
                    options={(profileOptions.age_groups || []).map((value) => ({ value, label: value }))}
                    placeholder="Any age group"
                  />
                  <SelectField
                    label="Education level"
                    value={smartForm.education_level}
                    onChange={(value) => updateField("education_level", value)}
                    options={(profileOptions.education_levels || []).map((value) => ({ value, label: value }))}
                    placeholder="Any education level"
                  />
                  <SelectField
                    label="Income level"
                    value={smartForm.income_level}
                    onChange={(value) => updateField("income_level", value)}
                    options={(profileOptions.income_levels || []).map((value) => ({ value, label: value }))}
                    placeholder="Any income level"
                  />
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                className="rounded-full border border-brand-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand"
                onClick={onClose}
                disabled={previewBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full border border-brand bg-brand px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand/90 disabled:opacity-60"
                onClick={runPreview}
                disabled={previewBusy}
              >
                {previewBusy ? "Generating preview..." : "Generate Preview"}
              </button>
            </div>
          </section>
        ) : (
          <section className="mt-6 space-y-5">
            <div className="rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-brand-50/30 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand">
                    {coverage.signal}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">
                    Audience coverage snapshot
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">{coverage.summaryText}</p>
                </div>
                {activeThemeLabel ? (
                  <div className="rounded-2xl border border-brand-100 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
                    {activeThemeLabel}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {coverage.groups.map((group) => (
                <div
                  key={group.title}
                  className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {group.title}
                  </p>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-700">
                    {group.value}
                  </p>
                </div>
              ))}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Representative audience archetypes
              </h3>
              <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {representativeDrafts.map((draft) => (
                  <AudienceArchetypeCard key={draft._draftId} draft={draft} />
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-brand-100 bg-white p-4">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left"
                onClick={() => setShowAll((prev) => !prev)}
              >
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {showAll ? `Hide all ${drafts.length} personas` : `View all ${drafts.length} personas`}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Expand to inspect the full generated set before you commit it.
                  </p>
                </div>
                <span className="text-sm font-semibold text-brand">{showAll ? "Hide" : "Show"}</span>
              </button>
              {showAll ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {drafts.map((draft) => (
                    <CompactDraftCard key={draft._draftId} draft={draft} />
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                className="rounded-full border border-brand-200 bg-white px-4 py-2 text-xs font-semibold text-brand transition hover:border-brand"
                onClick={runPreview}
                disabled={previewBusy || commitBusy}
              >
                Regenerate
              </button>
              <button
                type="button"
                className="rounded-full border border-brand-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand"
                onClick={() => setStep("input")}
                disabled={previewBusy || commitBusy}
              >
                Adjust settings
              </button>
              <button
                type="button"
                className="rounded-full border border-brand bg-brand px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand/90 disabled:opacity-60"
                onClick={handleCommit}
                disabled={commitBusy || !drafts.length}
              >
                {commitBusy ? "Creating users..." : "Create Users"}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function AudienceArchetypeCard({ draft }) {
  return (
    <article className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm">
      <h4 className="text-sm font-semibold text-slate-900">
        {draft.display_name || draft.username}
      </h4>
      <p className="text-[11px] text-slate-500">@{draft.username}</p>
      <p className="mt-3 text-sm text-slate-700">{draft.notes || "Rule-generated audience sample."}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {[draft.age_group, draft.content_preference, draft.interaction_style]
          .filter(Boolean)
          .map((value) => (
            <span
              key={value}
              className="rounded-full border border-brand-100 bg-brand-50/60 px-3 py-1 text-[11px] text-slate-600"
            >
              {value}
            </span>
          ))}
        {(draft.interests || []).slice(0, 2).map((interest) => (
          <span
            key={interest}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-slate-600"
          >
            {interest}
          </span>
        ))}
      </div>
    </article>
  );
}

function CompactDraftCard({ draft }) {
  return (
    <article className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
      <h4 className="text-sm font-semibold text-slate-900">
        {draft.display_name || draft.username}
      </h4>
      <p className="text-[11px] text-slate-500">@{draft.username}</p>
      <p className="mt-3 text-xs leading-5 text-slate-600">
        {[draft.content_preference, draft.interaction_style, draft.decision_factor]
          .filter(Boolean)
          .join(" • ")}
      </p>
    </article>
  );
}

function NumberField({ label, value, onChange }) {
  return (
    <label className="block text-xs font-semibold text-slate-600">
      {label}
      <input
        type="number"
        min="1"
        max="100"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full rounded-xl border border-brand-200 px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-brand"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = "Please select",
}) {
  return (
    <label className="block text-xs font-semibold text-slate-600">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-brand-200 px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-brand"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
