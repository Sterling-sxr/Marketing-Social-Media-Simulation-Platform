import { useEffect, useMemo, useState } from "react";
import Feedback from "../../components/Feedback";
import { postJson } from "../../../lib/api";

const GUIDED_TEMPLATE_OPTIONS = [
  { value: "undergraduate-heavy", label: "Undergraduate-heavy cohort" },
  { value: "mixed-interests", label: "Mixed interests cohort" },
  { value: "marketing-audience", label: "Marketing audience cohort" },
  { value: "creator-community", label: "Creator community cohort" },
];

const EMPTY_GUIDED_FORM = {
  template_id: "mixed-interests",
  count: 3,
  audience_theme: "",
  age_mix: [],
  interest_mix: [],
  digital_time: "",
  content_preference: "",
};

const EMPTY_GENERATE_FORM = {
  count: 5,
  template_id: "",
  scenario_prompt: "",
  age_mix: [],
  interest_mix: [],
  digital_time: "",
  content_preference: "",
};

function createDraftId(item, index) {
  return `${item.username || "draft"}-${index}`;
}

function normalizeDrafts(items = []) {
  return items.map((item, index) => ({
    ...item,
    _draftId: createDraftId(item, index),
    removed: false,
    dirty: false,
  }));
}

function stripDraftMeta(item) {
  const { _draftId, removed, dirty, warnings, ...cleaned } = item;
  return cleaned;
}

export default function AIPersonaCreationModal({
  mode,
  courseId,
  profileOptions,
  onClose,
  onCommitted,
}) {
  const [step, setStep] = useState("input");
  const [guidedForm, setGuidedForm] = useState(EMPTY_GUIDED_FORM);
  const [generateForm, setGenerateForm] = useState(EMPTY_GENERATE_FORM);
  const [drafts, setDrafts] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [error, setError] = useState("");
  const [previewBusy, setPreviewBusy] = useState(false);
  const [commitBusy, setCommitBusy] = useState(false);

  useEffect(() => {
    if (!mode) return;
    setStep("input");
    setGuidedForm(EMPTY_GUIDED_FORM);
    setGenerateForm(EMPTY_GENERATE_FORM);
    setDrafts([]);
    setWarnings([]);
    setError("");
    setPreviewBusy(false);
    setCommitBusy(false);
  }, [mode]);

  const isGuided = mode === "guided";
  const title = isGuided ? "Create AI Users with Guide" : "Generate AI Users with AI";
  const previewButtonLabel = previewBusy
    ? "Loading preview..."
    : "Preview personas";
  const visibleDrafts = useMemo(
    () => drafts.filter((item) => !item.removed),
    [drafts]
  );

  if (!mode) return null;

  const updateGuided = (field, value) => {
    setGuidedForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateGenerate = (field, value) => {
    setGenerateForm((prev) => ({ ...prev, [field]: value }));
  };

  const activeForm = isGuided ? guidedForm : generateForm;

  const handleMultiSelectToggle = (formSetter, field, option) => {
    formSetter((prev) => {
      const current = prev[field] || [];
      const next = current.includes(option)
        ? current.filter((item) => item !== option)
        : [...current, option];
      return { ...prev, [field]: next };
    });
  };

  const buildPreviewPayload = () => {
    if (isGuided) {
      return {
        template_id: guidedForm.template_id,
        count: Number(guidedForm.count),
        audience_theme: guidedForm.audience_theme.trim(),
        age_mix: guidedForm.age_mix,
        interest_mix: guidedForm.interest_mix,
        digital_time: guidedForm.digital_time,
        content_preference: guidedForm.content_preference,
      };
    }
    const constraints = {};
    if (generateForm.age_mix.length) constraints.age_mix = generateForm.age_mix;
    if (generateForm.interest_mix.length) {
      constraints.interest_mix = generateForm.interest_mix;
    }
    if (generateForm.digital_time) constraints.digital_time = generateForm.digital_time;
    if (generateForm.content_preference) {
      constraints.content_preference = generateForm.content_preference;
    }
    return {
      count: Number(generateForm.count),
      template_id: generateForm.template_id,
      scenario_prompt: generateForm.scenario_prompt.trim(),
      constraints,
    };
  };

  const runPreview = async () => {
    setPreviewBusy(true);
    setError("");
    try {
      const endpoint = isGuided
        ? `/api/courses/${courseId}/ai-users/guided-preview/`
        : `/api/courses/${courseId}/ai-users/generate-preview/`;
      const data = await postJson(endpoint, buildPreviewPayload());
      setDrafts(normalizeDrafts(data.items || []));
      setWarnings(data.warnings || []);
      setStep("preview");
    } catch (err) {
      if (!isGuided && err?.status === 503) {
        setError("AI persona generation is currently unavailable. Please try again later or use Guided creation.");
      } else {
        setError(err.message || "Failed to load persona preview.");
      }
    } finally {
      setPreviewBusy(false);
    }
  };

  const updateDraft = (draftId, field, value) => {
    setDrafts((prev) =>
      prev.map((item) =>
        item._draftId === draftId ? { ...item, [field]: value, dirty: true } : item
      )
    );
  };

  const toggleDraftInterest = (draftId, option) => {
    setDrafts((prev) =>
      prev.map((item) => {
        if (item._draftId !== draftId) return item;
        const interests = item.interests || [];
        const next = interests.includes(option)
          ? interests.filter((entry) => entry !== option)
          : [...interests, option];
        return { ...item, interests: next, dirty: true };
      })
    );
  };

  const toggleDraftRemoved = (draftId) => {
    setDrafts((prev) =>
      prev.map((item) =>
        item._draftId === draftId
          ? { ...item, removed: !item.removed, dirty: true }
          : item
      )
    );
  };

  const handleCommit = async () => {
    setCommitBusy(true);
    setError("");
    try {
      const endpoint = isGuided
        ? `/api/courses/${courseId}/ai-users/guided-commit/`
        : `/api/courses/${courseId}/ai-users/generate-commit/`;
      const data = await postJson(endpoint, {
        items: visibleDrafts.map(stripDraftMeta),
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
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="text-xs text-slate-500">
              {isGuided
                ? "Use a template and lightweight inputs to build reviewable persona drafts."
                : "Use structured inputs plus an optional scenario prompt to generate reviewable drafts."}
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
            {isGuided ? (
              <GuidedInputForm
                form={guidedForm}
                options={profileOptions}
                onChange={updateGuided}
                onToggle={(field, option) =>
                  handleMultiSelectToggle(setGuidedForm, field, option)
                }
              />
            ) : (
              <GenerateInputForm
                form={generateForm}
                options={profileOptions}
                onChange={updateGenerate}
                onToggle={(field, option) =>
                  handleMultiSelectToggle(setGenerateForm, field, option)
                }
              />
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
                onClick={runPreview}
                disabled={previewBusy}
              >
                {previewButtonLabel}
              </button>
            </div>
          </section>
        ) : (
          <section className="mt-6 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  Persona Preview
                </h3>
                <p className="text-xs text-slate-500">
                  Lightly edit common fields, remove drafts you do not want to commit, or go back for deeper changes.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!isGuided ? (
                  <button
                    type="button"
                    className="rounded-full border border-brand-200 bg-white px-4 py-2 text-xs font-semibold text-brand transition hover:border-brand"
                    onClick={runPreview}
                    disabled={previewBusy || commitBusy}
                  >
                    Regenerate
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rounded-full border border-brand-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand"
                  onClick={() => setStep("input")}
                  disabled={previewBusy || commitBusy}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="rounded-full border border-brand bg-brand px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand/90 disabled:opacity-60"
                  onClick={handleCommit}
                  disabled={commitBusy || !visibleDrafts.length}
                >
                  {commitBusy ? "Committing..." : "Commit personas"}
                </button>
              </div>
            </div>

            <p className="rounded-2xl border border-dashed border-brand-200 bg-brand-50 px-4 py-3 text-xs text-slate-600">
              Need deeper edits? Go back and use Advanced Create after closing this flow.
            </p>

            <div className="grid gap-4">
              {drafts.map((draft) => (
                <DraftCard
                  key={draft._draftId}
                  draft={draft}
                  options={profileOptions}
                  onChange={updateDraft}
                  onToggleInterest={toggleDraftInterest}
                  onToggleRemoved={toggleDraftRemoved}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function GuidedInputForm({ form, options, onChange, onToggle }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SelectField
          label="Template"
          value={form.template_id}
          onChange={(value) => onChange("template_id", value)}
          options={GUIDED_TEMPLATE_OPTIONS}
          placeholder="Select template"
        />
        <NumberField
          label="Count"
          value={form.count}
          onChange={(value) => onChange("count", value)}
        />
        <TextField
          label="Audience theme"
          value={form.audience_theme}
          onChange={(value) => onChange("audience_theme", value)}
          placeholder="Optional cohort or scenario label"
        />
        <SelectField
          label="Digital time"
          value={form.digital_time}
          onChange={(value) => onChange("digital_time", value)}
          options={options?.digital_time || []}
        />
        <SelectField
          label="Content preference"
          value={form.content_preference}
          onChange={(value) => onChange("content_preference", value)}
          options={options?.content_preference || []}
        />
      </div>
      <ChipGroup
        label="Age mix"
        helper="Optional. Pick one or more age groups to bias the guided preview."
        selected={form.age_mix}
        options={options?.age_groups || []}
        onToggle={(option) => onToggle("age_mix", option)}
      />
      <ChipGroup
        label="Interest mix"
        helper="Optional. Pick one or more interests to emphasize."
        selected={form.interest_mix}
        options={options?.interests || []}
        onToggle={(option) => onToggle("interest_mix", option)}
      />
    </>
  );
}

function GenerateInputForm({ form, options, onChange, onToggle }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <NumberField
          label="Count"
          value={form.count}
          onChange={(value) => onChange("count", value)}
        />
        <SelectField
          label="Template seed"
          value={form.template_id}
          onChange={(value) => onChange("template_id", value)}
          options={[{ value: "", label: "No template seed" }, ...GUIDED_TEMPLATE_OPTIONS]}
          placeholder="No template seed"
        />
        <SelectField
          label="Digital time"
          value={form.digital_time}
          onChange={(value) => onChange("digital_time", value)}
          options={options?.digital_time || []}
        />
        <SelectField
          label="Content preference"
          value={form.content_preference}
          onChange={(value) => onChange("content_preference", value)}
          options={options?.content_preference || []}
        />
      </div>
      <label className="block text-xs font-semibold text-slate-600">
        Scenario description
        <textarea
          rows={3}
          value={form.scenario_prompt}
          onChange={(e) => onChange("scenario_prompt", e.target.value)}
          className="mt-1 w-full rounded-xl border border-brand-200 px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-brand"
          placeholder="Optional short description to guide the generated cohort"
        />
      </label>
      <ChipGroup
        label="Age mix"
        helper="Optional. Use these as soft hints for the AI generation prompt."
        selected={form.age_mix}
        options={options?.age_groups || []}
        onToggle={(option) => onToggle("age_mix", option)}
      />
      <ChipGroup
        label="Interest mix"
        helper="Optional. Use these as soft hints for the AI generation prompt."
        selected={form.interest_mix}
        options={options?.interests || []}
        onToggle={(option) => onToggle("interest_mix", option)}
      />
    </>
  );
}

function DraftCard({ draft, options, onChange, onToggleInterest, onToggleRemoved }) {
  return (
    <article
      data-testid="persona-draft-card"
      className={`rounded-2xl border p-4 shadow-sm ${
        draft.removed
          ? "border-slate-200 bg-slate-50 opacity-70"
          : "border-brand-100 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">{draft.username}</h4>
          <p className="text-[11px] text-slate-500">
            {draft.removed ? "Removed from commit" : "Ready to commit"}
          </p>
        </div>
        <button
          type="button"
          className="rounded-full border border-brand-200 px-3 py-1 text-[11px] font-semibold text-brand transition hover:border-brand"
          onClick={() => onToggleRemoved(draft._draftId)}
        >
          {draft.removed ? "Restore to commit" : "Remove from commit"}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField
          label="Display name"
          value={draft.display_name || ""}
          onChange={(value) => onChange(draft._draftId, "display_name", value)}
          disabled={draft.removed}
        />
        <SelectField
          label="Age group"
          value={draft.age_group || ""}
          onChange={(value) => onChange(draft._draftId, "age_group", value)}
          options={options?.age_groups || []}
          disabled={draft.removed}
        />
        <SelectField
          label="Content preference"
          value={draft.content_preference || ""}
          onChange={(value) =>
            onChange(draft._draftId, "content_preference", value)
          }
          options={options?.content_preference || []}
          disabled={draft.removed}
        />
        <SelectField
          label="Digital time"
          value={draft.digital_time || ""}
          onChange={(value) => onChange(draft._draftId, "digital_time", value)}
          options={options?.digital_time || []}
          disabled={draft.removed}
        />
      </div>

      <div className="mt-4">
        <ChipGroup
          label="Interests"
          selected={draft.interests || []}
          options={options?.interests || []}
          onToggle={(option) => onToggleInterest(draft._draftId, option)}
          disabled={draft.removed}
        />
      </div>

      <label className="mt-4 block text-xs font-semibold text-slate-600">
        Notes
        <textarea
          rows={2}
          value={draft.notes || ""}
          onChange={(e) => onChange(draft._draftId, "notes", e.target.value)}
          className="mt-1 w-full rounded-xl border border-brand-200 px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-brand"
          disabled={draft.removed}
        />
      </label>
    </article>
  );
}

function TextField({ label, value, onChange, placeholder, disabled = false }) {
  return (
    <label className="block text-xs font-semibold text-slate-600">
      {label}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-brand-200 px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-brand"
        placeholder={placeholder}
        disabled={disabled}
      />
    </label>
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
        onChange={(e) => onChange(Number(e.target.value))}
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
  disabled = false,
}) {
  const normalizedOptions = (options || []).map((option) =>
    typeof option === "string" ? { value: option, label: option } : option
  );

  return (
    <label className="block text-xs font-semibold text-slate-600">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-brand-200 px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-brand"
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {normalizedOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ChipGroup({
  label,
  helper,
  selected,
  options,
  onToggle,
  disabled = false,
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-600">{label}</p>
      {helper ? <p className="text-[11px] text-slate-400">{helper}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {(options || []).map((option) => {
          const active = selected?.includes(option);
          return (
            <button
              type="button"
              key={option}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                active
                  ? "border-brand bg-brand-100 text-brand"
                  : "border-brand-200 text-slate-500 hover:border-brand hover:text-brand"
              }`}
              onClick={() => onToggle(option)}
              disabled={disabled}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
