import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Feedback from "../../components/Feedback";
import { getJson, postJson } from "../../../lib/api";

const SMART_GUIDED_MODE = "smart_guided";
const AI_BULK_MODE = "ai_bulk";
const ANY_OPTION_VALUE = "__any__";
const MAX_GENERATED_USERS = 1000;

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
  { value: ANY_OPTION_VALUE, label: "Any activity frequency (balanced)" },
  { value: "Almost constantly", label: "Almost constantly" },
  { value: "Several times a day", label: "Several times a day" },
  { value: "About once a day", label: "About once a day" },
  { value: "A few times a week", label: "A few times a week" },
  { value: "About once a week or less", label: "About once a week or less" },
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
  { value: ANY_OPTION_VALUE, label: "Any decision factor (balanced)" },
  { value: "Price", label: "Price" },
  { value: "Quality/durability", label: "Quality/durability" },
  { value: "Brand image", label: "Brand image" },
  { value: "Eco-friendly", label: "Eco-friendly" },
  { value: "Convenience", label: "Convenience" },
];

const CONTENT_PREFERENCE_OPTIONS = [
  { value: ANY_OPTION_VALUE, label: "Any content preference (balanced)" },
  { value: "Funny short posts/memes", label: "Funny short posts/memes" },
  { value: "Pictures or videos", label: "Pictures or videos" },
  { value: "Thoughtful opinions", label: "Thoughtful opinions" },
  { value: "Detailed reviews or long posts", label: "Detailed reviews or long posts" },
];

const INTERACTION_INTENSITY_OPTIONS = [
  { value: ANY_OPTION_VALUE, label: "Any interaction style (balanced)" },
  { value: "Like/react to posts", label: "Like/react to posts" },
  { value: "Comment on posts", label: "Comment on posts" },
  { value: "Share posts with friends", label: "Share posts with friends" },
  { value: "Mostly just scroll/watch", label: "Mostly just scroll/watch" },
];

const EMPTY_SMART_FORM = {
  count: 20,
  content_preference_bias: ANY_OPTION_VALUE,
  decision_driver: ANY_OPTION_VALUE,
  interaction_intensity: ANY_OPTION_VALUE,
  age_group: ANY_OPTION_VALUE,
  activity_level: ANY_OPTION_VALUE,
};

const EMPTY_BULK_FORM = {
  count: 12,
  scenario_prompt: "",
  age_group: "",
  education_level: "",
  income_level: "",
  digital_time: "",
  content_preference: "",
  interests: [],
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

function countConstraintSelections(form) {
  return [
    form.age_group,
    form.education_level,
    form.income_level,
    form.digital_time,
    form.content_preference,
    ...(form.interests || []),
  ].filter(Boolean).length;
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

function buildBulkSummary(blueprint, generationMeta) {
  const groups = [
    {
      title: "Age mix",
      value: summarizeList(blueprint?.age_mix || []),
    },
    {
      title: "Interest clusters",
      value: summarizeList(blueprint?.interest_clusters || []),
    },
    {
      title: "Activity profile",
      value: blueprint?.activity_profile || "Mixed activity",
    },
    {
      title: "Guardrails",
      value: summarizeList(blueprint?.guardrails || []),
    },
  ];

  return {
    signal: "AI-Assisted Bulk Generation",
    summaryText:
      blueprint?.summary ||
      "Preview generated from natural-language input plus teacher-defined audience segment constraints.",
    groups,
    metrics: [
      {
        title: "Repaired drafts",
        value: String(Number(generationMeta?.repaired_count || 0)),
      },
      {
        title: "Rejected drafts",
        value: String(Number(generationMeta?.rejected_count || 0)),
      },
    ],
  };
}

function normalizeAnyChoice(value) {
  return value && value !== ANY_OPTION_VALUE ? value : "";
}

function withAnyOption(options, anyLabel) {
  return [{ value: ANY_OPTION_VALUE, label: anyLabel }, ...options.map((value) => ({ value, label: value }))];
}

function formatDistribution(selectedValue, options) {
  if (!options.length) return "No options available";
  if (selectedValue && selectedValue !== ANY_OPTION_VALUE) return `${selectedValue} 100%`;
  const share = Math.max(1, Math.floor((100 / options.length) * 10) / 10);
  return options.map((value) => `${value} ${share}%`).join(" / ");
}

function toCsvCell(value) {
  const text = value == null ? "" : String(value);
  const escaped = text.replace(/"/g, '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

function buildCsvText(columns = [], rows = []) {
  if (!columns.length) return "";
  const header = columns.map((column) => toCsvCell(column)).join(",");
  const body = rows.map((row) =>
    columns.map((column) => toCsvCell(row?.[column] ?? "")).join(",")
  );
  return [header, ...body].join("\n");
}

export default function AIPersonaCreationModal({
  mode,
  courseId,
  onClose,
  onCommitted,
  profileOptions = {},
}) {
  const isOpen = Boolean(mode);
  const isBulkMode = mode === AI_BULK_MODE;
  const isSmartMode = mode === SMART_GUIDED_MODE;
  const usesLlmFlow = isBulkMode || isSmartMode;
  const [step, setStep] = useState("input");
  const [smartForm, setSmartForm] = useState(EMPTY_SMART_FORM);
  const [bulkForm, setBulkForm] = useState(EMPTY_BULK_FORM);
  const [drafts, setDrafts] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [error, setError] = useState("");
  const [previewBusy, setPreviewBusy] = useState(false);
  const [commitBusy, setCommitBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [smartProfile, setSmartProfile] = useState(null);
  const [bulkBlueprint, setBulkBlueprint] = useState(null);
  const [generationMeta, setGenerationMeta] = useState(null);
  const [progressHint, setProgressHint] = useState("");
  const [taskProgress, setTaskProgress] = useState({
    completedBatches: 0,
    totalBatches: 0,
  });
  const [csvPreview, setCsvPreview] = useState({
    columns: [],
    rows: [],
    csv_text: "",
  });

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  useEffect(() => {
    if (!isOpen) return;
    setStep("input");
    setSmartForm(EMPTY_SMART_FORM);
    setBulkForm(EMPTY_BULK_FORM);
    setDrafts([]);
    setWarnings([]);
    setError("");
    setPreviewBusy(false);
    setCommitBusy(false);
    setShowAll(false);
    setShowAdvanced(false);
    setSmartProfile(null);
    setBulkBlueprint(null);
    setGenerationMeta(null);
    setProgressHint("");
    setTaskProgress({ completedBatches: 0, totalBatches: 0 });
    setCsvPreview({ columns: [], rows: [], csv_text: "" });
  }, [isOpen, mode]);

  const coverage = useMemo(
    () => buildCoverageSummary(drafts, smartProfile, smartForm),
    [drafts, smartProfile, smartForm]
  );
  const representativeDrafts = useMemo(
    () => pickRepresentativeDrafts(drafts, smartProfile, smartForm),
    [drafts, smartProfile, smartForm]
  );
  const bulkSummary = useMemo(
    () => buildBulkSummary(bulkBlueprint, generationMeta),
    [bulkBlueprint, generationMeta]
  );
  const resolvedProfileOptions = profileOptions || {};
  const smartOptionSets = useMemo(
    () => ({
      contentPreference: resolvedProfileOptions.content_preference || [],
      decisionFactor: resolvedProfileOptions.decision_factors || [],
      interactionStyle: resolvedProfileOptions.interaction_style || [],
      digitalTime: resolvedProfileOptions.digital_time || [],
      ageGroup: resolvedProfileOptions.age_groups || [],
    }),
    [resolvedProfileOptions]
  );
  const smartDistributionSummary = useMemo(
    () => [
      {
        title: "Content preference",
        value: formatDistribution(
          smartForm.content_preference_bias,
          smartOptionSets.contentPreference
        ),
      },
      {
        title: "Decision factor",
        value: formatDistribution(smartForm.decision_driver, smartOptionSets.decisionFactor),
      },
      {
        title: "Interaction style",
        value: formatDistribution(
          smartForm.interaction_intensity,
          smartOptionSets.interactionStyle
        ),
      },
      {
        title: "Digital activity",
        value: formatDistribution(smartForm.activity_level, smartOptionSets.digitalTime),
      },
      {
        title: "Age group",
        value: formatDistribution(smartForm.age_group, smartOptionSets.ageGroup),
      },
    ],
    [smartForm, smartOptionSets]
  );

  if (!isOpen || (!isSmartMode && !isBulkMode)) return null;

  const updateField = (field, value) => {
    setSmartForm((prev) => ({ ...prev, [field]: value }));
  };

  const setGoal = (goal) => {
    setSmartForm((prev) => ({ ...prev, goal }));
  };

  const updateBulkField = (field, value) => {
    setBulkForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleBulkInterest = (interest) => {
    setBulkForm((prev) => {
      const has = prev.interests.includes(interest);
      return {
        ...prev,
        interests: has
          ? prev.interests.filter((item) => item !== interest)
          : [...prev.interests, interest],
      };
    });
  };

  const composeSmartScenarioPrompt = ({
    contentPreference,
    decisionDriver,
    interactionIntensity,
    activityLevel,
    ageGroup,
  }) => {
    const preferenceText = contentPreference || "balanced content preferences";
    const decisionText = decisionDriver || "balanced decision drivers";
    const interactionText = interactionIntensity || "balanced interaction intensity";
    const activityText = activityLevel || "balanced activity levels";
    const ageText = ageGroup || "mixed age groups";
    return `Generate student personas for ${preferenceText}, ${decisionText}, ${interactionText}, ${activityText}, and ${ageText}. For every Any field, distribute personas as evenly as possible across the available platform labels.`;
  };

  const buildSmartPayload = () => {
    const contentPreference = normalizeAnyChoice(smartForm.content_preference_bias);
    const decisionDriver = normalizeAnyChoice(smartForm.decision_driver);
    const interactionIntensity = normalizeAnyChoice(smartForm.interaction_intensity);
    const activityLevel = normalizeAnyChoice(smartForm.activity_level);
    const ageGroup = normalizeAnyChoice(smartForm.age_group);
    const constraints = {};
    if (contentPreference) {
      constraints.content_preference = [contentPreference];
    }
    if (decisionDriver) {
      constraints.decision_factor = [decisionDriver];
    }
    if (ageGroup) {
      constraints.age_group = [ageGroup];
    }
    if (activityLevel) {
      constraints.digital_time = [activityLevel];
    }
    if (interactionIntensity) {
      constraints.interaction_style = [interactionIntensity];
    }
    const scenarioPrompt = composeSmartScenarioPrompt({
      contentPreference,
      decisionDriver,
      interactionIntensity,
      activityLevel,
      ageGroup,
    });
    return {
      count: Number(smartForm.count),
      generation_mode: AI_BULK_MODE,
      scenario_prompt: scenarioPrompt,
      constraints,
    };
  };

  const buildBulkPayload = () => {
    const constraints = {};
    ["age_group", "education_level", "income_level", "digital_time", "content_preference"].forEach((field) => {
      if (bulkForm[field]) {
        constraints[field] = [bulkForm[field]];
      }
    });
    if (bulkForm.interests.length) {
      constraints.interests = bulkForm.interests;
    }

    return {
      count: Number(bulkForm.count),
      scenario_prompt: bulkForm.scenario_prompt.trim(),
      generation_mode: AI_BULK_MODE,
      constraints,
    };
  };

  const runPreview = async () => {
    setPreviewBusy(true);
    setError("");
    setProgressHint("Submitting generation task...");
    setTaskProgress({ completedBatches: 0, totalBatches: 0 });
    try {
      let data;
      if (usesLlmFlow) {
        const payload = isSmartMode ? buildSmartPayload() : buildBulkPayload();
        const kickoff = await postJson(
          `/api/courses/${courseId}/ai-users/generate-preview/async/`,
          payload
        );
        setProgressHint("Task queued. Starting generation...");
        const taskId = kickoff?.task_id;
        if (!taskId) {
          throw new Error("Preview task was not created.");
        }
        const maxPollAttempts = 600;
        for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
          const task = await getJson(
            `/api/courses/${courseId}/ai-users/generate-preview/tasks/${taskId}/`
          );
          if (task.status === "succeeded") {
            setProgressHint("Generation completed. Preparing preview...");
            setTaskProgress((current) => ({
              completedBatches:
                Number(task?.progress?.completed_batches || 0) ||
                current.completedBatches,
              totalBatches:
                Number(task?.progress?.total_batches || 0) ||
                current.totalBatches,
            }));
            data = task.result || {};
            break;
          }
          if (task.status === "failed") {
            throw new Error(task.error || "Preview generation failed.");
          }
          const completedBatches = Number(task?.progress?.completed_batches || 0);
          const totalBatches = Number(task?.progress?.total_batches || 0);
          setTaskProgress({
            completedBatches,
            totalBatches,
          });
          if (totalBatches > 1) {
            setProgressHint(
              `Generating personas... batch ${Math.min(
                completedBatches + 1,
                totalBatches
              )}/${totalBatches} in progress`
            );
          }
          if (attempt >= 120) {
            setProgressHint(
              "Generation is still running (over 2 minutes). This can happen with larger batches."
            );
          } else if (attempt >= 30) {
            setProgressHint("Generation is still running... almost there.");
          } else if (attempt >= 10) {
            setProgressHint("Generating personas...");
          }
          await wait(2000);
        }
        if (!data) {
          throw new Error(
            "Preview generation is still running after a long wait. Please close and retry with fewer users (e.g. 8-12)."
          );
        }
      } else {
        setProgressHint("Generating preview...");
        data = await postJson(`/api/courses/${courseId}/ai-users/guided-preview/`, {});
      }
      setDrafts(normalizeDrafts(data.items || []));
      setWarnings(data.warnings || []);
      setSmartProfile(data.smart_profile || null);
      setBulkBlueprint(data.cohort_blueprint || null);
      setGenerationMeta(data.generation_meta || null);
      setCsvPreview(
        data.csv_preview || {
          columns: [],
          rows: [],
          csv_text: "",
        }
      );
      setShowAll(false);
      setStep("preview");
      setProgressHint("");
      setTaskProgress({ completedBatches: 0, totalBatches: 0 });
    } catch (err) {
      setError(err.message || "Failed to load persona preview.");
      setProgressHint("");
      setTaskProgress({ completedBatches: 0, totalBatches: 0 });
    } finally {
      setPreviewBusy(false);
    }
  };

  const handleCommit = async () => {
    setCommitBusy(true);
    setError("");
    try {
      const data = await postJson(
        `/api/courses/${courseId}/ai-users/${usesLlmFlow ? "generate-commit" : "guided-commit"}/`,
        {
          items: drafts.map(stripDraftMeta),
        }
      );
      await onCommitted?.(data);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to commit AI personas.");
    } finally {
      setCommitBusy(false);
    }
  };

  const handleExportCsv = () => {
    const csvText = (csvPreview?.csv_text || "").trim();
    if (!csvText) {
      setError("No CSV content available to export.");
      return;
    }
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    link.href = url;
    link.download = `ai-personas-course-${courseId}-${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const removeDraft = (draftId) => {
    setDrafts((prev) => {
      const target = prev.find((draft) => draft._draftId === draftId);
      const next = prev.filter((draft) => draft._draftId !== draftId);
      if (target?.username) {
        setCsvPreview((current) => {
          const nextRows = (current.rows || []).filter(
            (row) => row.username !== target.username
          );
          return {
            ...current,
            rows: nextRows,
            csv_text: buildCsvText(current.columns || [], nextRows),
          };
        });
      }
      return next;
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 px-2 py-2 md:px-4 md:py-4">
      <div className="flex max-h-[94vh] w-full max-w-[96vw] flex-col overflow-hidden rounded-3xl bg-white p-5 shadow-2xl shadow-brand-200 md:max-w-[92vw] md:p-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {isBulkMode ? "AI-Assisted Bulk Generation" : "Smart Generate"}
            </h2>
            <p className="text-xs text-slate-500">
              {isSmartMode
                ? "Build personas with simple options, preview the generated set, then create users in one click."
                : isBulkMode
                ? "Describe the marketing scenario, add a few audience constraints, and preview the generated segments before import."
                : "Choose a comparison goal first, then shape a set of audience responses with a few high-level controls."}
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
        {previewBusy && progressHint ? (
          <div className="mt-4 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-xs font-medium text-brand">
            <p>{progressHint}</p>
            {taskProgress.totalBatches > 0 ? (
              <div className="mt-2">
                <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    Batch progress: {taskProgress.completedBatches}/{taskProgress.totalBatches}
                  </span>
                  <span>
                    {Math.round(
                      (Math.min(taskProgress.completedBatches, taskProgress.totalBatches) /
                        Math.max(taskProgress.totalBatches, 1)) *
                        100
                    )}
                    %
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-brand-100">
                  <div
                    className="h-2 rounded-full bg-brand transition-all duration-300"
                    style={{
                      width: `${Math.round(
                        (Math.min(taskProgress.completedBatches, taskProgress.totalBatches) /
                          Math.max(taskProgress.totalBatches, 1)) *
                          100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        {warnings.length ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            {warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}

        <div className="mt-4 overflow-y-auto pr-1">
          {step === "input" ? (
            <section className="mt-2 space-y-5">
            {isSmartMode ? (
              <>
                <div className="rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-brand-50/30 p-5">
                  <h3 className="text-xl font-semibold text-slate-900">
                    Quick persona generation (same label system as registered users)
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Choose fixed audience options below. The system automatically composes a prompt and maps personas to the same fixed labels used by normal accounts.
                  </p>
                </div>

                <div className="rounded-2xl border-2 border-brand-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">
                    Core Controls
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <NumberField
                      label="Number of users"
                      value={smartForm.count}
                      onChange={(value) => updateField("count", value)}
                    />
                    <SelectField
                      label="Preferred content type"
                      value={smartForm.content_preference_bias}
                      onChange={(value) =>
                        updateField("content_preference_bias", value)
                      }
                      options={withAnyOption(
                        smartOptionSets.contentPreference,
                        "Any content preference (balanced)"
                      )}
                    />
                    <SelectField
                      label="Primary decision driver"
                      value={smartForm.decision_driver}
                      onChange={(value) => updateField("decision_driver", value)}
                      options={withAnyOption(
                        smartOptionSets.decisionFactor,
                        "Any decision factor (balanced)"
                      )}
                    />
                    <SelectField
                      label="Interaction style"
                      value={smartForm.interaction_intensity}
                      onChange={(value) =>
                        updateField("interaction_intensity", value)
                      }
                      options={withAnyOption(
                        smartOptionSets.interactionStyle,
                        "Any interaction style (balanced)"
                      )}
                    />
                    <SelectField
                      label="Digital activity frequency"
                      value={smartForm.activity_level}
                      onChange={(value) => updateField("activity_level", value)}
                      options={withAnyOption(
                        smartOptionSets.digitalTime,
                        "Any activity frequency (balanced)"
                      )}
                    />
                    <SelectField
                      label="Age group"
                      value={smartForm.age_group}
                      onChange={(value) => updateField("age_group", value)}
                      options={withAnyOption(
                        smartOptionSets.ageGroup,
                        "Any age group (balanced)"
                      )}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/50 p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">
                    Auto prompt preview
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    {composeSmartScenarioPrompt({
                      contentPreference:
                        smartForm.content_preference_bias !== ANY_OPTION_VALUE
                          ? smartForm.content_preference_bias
                          : "",
                      decisionDriver:
                        smartForm.decision_driver !== ANY_OPTION_VALUE
                          ? smartForm.decision_driver
                          : "",
                      interactionIntensity:
                        smartForm.interaction_intensity !== ANY_OPTION_VALUE
                          ? smartForm.interaction_intensity
                          : "",
                      activityLevel:
                        smartForm.activity_level !== ANY_OPTION_VALUE
                          ? smartForm.activity_level
                          : "",
                      ageGroup:
                        smartForm.age_group !== ANY_OPTION_VALUE
                          ? smartForm.age_group
                          : "",
                    })}
                  </p>
                </div>
                <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/30 p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
                    Estimated balanced distribution
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Fields set to Any are distributed uniformly across available registered-user labels.
                  </p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {smartDistributionSummary.map((item) => (
                      <div key={item.title} className="rounded-xl border border-emerald-200 bg-white px-3 py-2 shadow-sm">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs font-medium text-slate-700">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : isBulkMode ? (
              <>
                <div className="rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-brand-50/30 p-5">
                  <h3 className="text-xl font-semibold text-slate-900">
                    Generate marketing audience segments from plain-language guidance
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    The AI interprets your scenario, then the backend normalizes each persona into the existing schema so you can compare how different audience segments may respond to different posts.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <NumberField
                    label="Number of users"
                    value={bulkForm.count}
                    onChange={(value) => updateBulkField("count", value)}
                  />
                  <label className="block text-xs font-semibold text-slate-600 md:col-span-2">
                    Scenario prompt
                    <textarea
                      rows={4}
                      value={bulkForm.scenario_prompt}
                      onChange={(event) => updateBulkField("scenario_prompt", event.target.value)}
                      className="mt-1 w-full rounded-2xl border border-brand-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand"
                      placeholder="Describe the campaign, product, or marketing scenario you want students to test."
                    />
                  </label>
                </div>

                <div className="rounded-2xl border border-brand-100 bg-white p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Audience constraints</h3>
                    <p className="text-xs text-slate-500">
                      Add a few guardrails to keep the generated audience segments on-brief. Leave fields blank for broader market coverage.
                    </p>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <SelectField
                      label="Age group"
                      value={bulkForm.age_group}
                      onChange={(value) => updateBulkField("age_group", value)}
                      options={(profileOptions.age_groups || []).map((value) => ({ value, label: value }))}
                      placeholder="Any age group"
                    />
                    <SelectField
                      label="Education level"
                      value={bulkForm.education_level}
                      onChange={(value) => updateBulkField("education_level", value)}
                      options={(profileOptions.education_levels || []).map((value) => ({ value, label: value }))}
                      placeholder="Any education level"
                    />
                    <SelectField
                      label="Income level"
                      value={bulkForm.income_level}
                      onChange={(value) => updateBulkField("income_level", value)}
                      options={(profileOptions.income_levels || []).map((value) => ({ value, label: value }))}
                      placeholder="Any income level"
                    />
                    <SelectField
                      label="Digital activity"
                      value={bulkForm.digital_time}
                      onChange={(value) => updateBulkField("digital_time", value)}
                      options={(profileOptions.digital_time || []).map((value) => ({ value, label: value }))}
                      placeholder="Any activity level"
                    />
                    <SelectField
                      label="Content preference"
                      value={bulkForm.content_preference}
                      onChange={(value) => updateBulkField("content_preference", value)}
                      options={(profileOptions.content_preference || []).map((value) => ({ value, label: value }))}
                      placeholder="Any content preference"
                    />
                  </div>
                  <fieldset className="mt-4">
                    <legend className="text-xs font-semibold text-slate-600">Interest clusters</legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(profileOptions.interests || []).map((interest) => {
                        const selected = bulkForm.interests.includes(interest);
                        return (
                          <button
                            key={interest}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => toggleBulkInterest(interest)}
                            className={`rounded-full border px-3 py-1.5 text-xs transition ${
                              selected
                                ? "border-brand bg-brand-50 text-brand"
                                : "border-brand-100 bg-white text-slate-600 hover:border-brand-300"
                            }`}
                          >
                            {interest}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-brand-50/30 p-5">
                  <h3 className="text-xl font-semibold text-slate-900">
                    Pick the kind of audience comparison you want students to run
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Smart Generate keeps the persona schema fixed, then composes contrasting audience pockets from goal-driven rules instead of external AI prompts.
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
                    options={withAnyOption(
                      smartOptionSets.digitalTime,
                      "Any activity frequency (balanced)"
                    )}
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
                        options={withAnyOption(
                          smartOptionSets.decisionFactor,
                          "Any decision factor (balanced)"
                        )}
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
                        options={withAnyOption(
                          smartOptionSets.contentPreference,
                          "Any content preference (balanced)"
                        )}
                      />
                      <SelectField
                        label="Interaction intensity"
                        value={smartForm.interaction_intensity}
                        onChange={(value) => updateField("interaction_intensity", value)}
                        options={withAnyOption(
                          smartOptionSets.interactionStyle,
                          "Any interaction style (balanced)"
                        )}
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
              </>
            )}

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
                onClick={() => {
                  if (isSmartMode) {
                    const count = Number(smartForm.count);
                    if (!Number.isFinite(count) || count < 1 || count > MAX_GENERATED_USERS) {
                      setError(`Number of users must be between 1 and ${MAX_GENERATED_USERS}.`);
                      return;
                    }
                  } else if (isBulkMode) {
                    const hasPrompt = bulkForm.scenario_prompt.trim().length > 0;
                    const hasConstraints = countConstraintSelections(bulkForm) > 0;
                    const count = Number(bulkForm.count);
                    if (!Number.isFinite(count) || count < 1 || count > MAX_GENERATED_USERS) {
                      setError(`Number of users must be between 1 and ${MAX_GENERATED_USERS}.`);
                      return;
                    }
                    if (!hasPrompt && !hasConstraints) {
                      setError("Add a scenario prompt or at least one audience constraint before generating a preview.");
                      return;
                    }
                  }
                  runPreview();
                }}
                disabled={previewBusy}
              >
                {previewBusy ? "Generating preview..." : "Generate Preview"}
              </button>
            </div>
            </section>
          ) : (
            <section className="mt-2 space-y-5">
            {usesLlmFlow ? (
              <>
                <div className="rounded-2xl border border-brand-100 bg-white p-4">
                  {csvPreview?.rows?.length ? (
                    <div className="mb-4 rounded-2xl border border-brand-100 bg-brand-50/40 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="text-sm font-extrabold uppercase tracking-wide text-brand">
                          CSV Preview (generated from structured JSON)
                        </h4>
                        <button
                          type="button"
                          className="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-brand transition hover:border-brand disabled:opacity-60"
                          onClick={handleExportCsv}
                          disabled={previewBusy || commitBusy || !csvPreview?.csv_text}
                        >
                          Export CSV
                        </button>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        This is the CSV-ready content for import. You can remove outlier rows below before committing.
                      </p>
                      <div className="mt-3 max-h-44 overflow-auto rounded-xl border border-brand-100 bg-white p-2">
                        <pre className="whitespace-pre-wrap text-[11px] leading-5 text-slate-600">
                          {csvPreview.csv_text}
                        </pre>
                      </div>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-extrabold tracking-tight text-brand">
                        {drafts.length ? `Previewing ${drafts.length} personas across audience segments` : "No personas left in this preview"}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Remove any outliers before you create the final batch of comparable audience segments.
                      </p>
                    </div>
                    {!drafts.length ? (
                      <button
                        type="button"
                        className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700 transition hover:border-amber-300"
                        onClick={() => setStep("input")}
                        disabled={previewBusy || commitBusy}
                      >
                        Back to settings
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {drafts.map((draft) => (
                      <CompactDraftCard
                        key={draft._draftId}
                        draft={draft}
                        removable
                        onRemove={() => removeDraft(draft._draftId)}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-brand-50/30 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand">
                        {coverage.signal}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-slate-900">
                        Audience segment snapshot
                      </h3>
                      <p className="mt-2 text-sm text-slate-600">{coverage.summaryText}</p>
                    </div>
                    {null}
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
              </>
            )}

            <div className="flex items-center justify-end gap-3">
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
    </div>
    ,
    document.body
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

function CompactDraftCard({ draft, removable = false, onRemove }) {
  return (
    <article className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">
            {draft.display_name || draft.username}
          </h4>
          <p className="text-[11px] text-slate-500">@{draft.username}</p>
        </div>
        {removable ? (
          <button
            type="button"
            className="rounded-full border border-red-200 bg-white px-3 py-1 text-[11px] font-semibold text-red-500 transition hover:border-red-300"
            onClick={onRemove}
            aria-label={`Remove ${draft.display_name || draft.username}`}
          >
            Remove
          </button>
        ) : null}
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-600">
        {[draft.content_preference, draft.interaction_style, draft.decision_factor]
          .filter(Boolean)
          .join(" • ")}
      </p>
      {draft.notes ? (
        <p className="mt-2 text-xs leading-5 text-slate-500">{draft.notes}</p>
      ) : null}
    </article>
  );
}

function NumberField({ label, value, onChange }) {
  return (
    <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-600">
      {label}
      <input
        type="number"
        min="1"
        max={String(MAX_GENERATED_USERS)}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand-100"
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
    <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-600">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand-100"
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
