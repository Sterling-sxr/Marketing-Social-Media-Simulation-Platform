import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AuthenticatedShell from "../components/AuthenticatedShell";
import Feedback from "../components/Feedback";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  deleteJson,
  getJson,
  patchJson,
  postJson,
  uploadFile,
} from "../../lib/api";
import { useApp } from "../../context/AppContext";

const INITIAL_FORM = {
  id: null,
  username: "",
  display_name: "",
  gender: "",
  city: "",
  age_group: "",
  education_level: "",
  income_level: "",
  social_value: 5,
  sociability: 5,
  openness: 5,
  content_preference: "",
  interests: [],
  shopping_frequency: "",
  buying_behavior: "",
  decision_factor: "",
  shopping_preference: "",
  digital_time: "",
  interaction_style: "",
  influencer_type: "",
  notes: "",
};

export default function CourseAIUsersPage() {
  const { courseId: courseIdParam } = useParams();
  const courseId = Number(courseIdParam);
  const navigate = useNavigate();
  const { authUser, authCheckComplete, profileOptions, fetchProfileOptions } =
    useApp();

  const [status, setStatus] = useState({ loading: true, error: "" });
  const [items, setItems] = useState([]);
  const [courseInfo, setCourseInfo] = useState(null);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [deleteState, setDeleteState] = useState({ open: false, item: null });
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!authCheckComplete) return;
    if (!authUser) {
      navigate("/login", { replace: true });
      return;
    }
    if (!(authUser.is_superuser || authUser.is_staff)) {
      navigate("/courses", { replace: true });
    }
  }, [authUser, authCheckComplete, navigate]);

  useEffect(() => {
    if (authUser) {
      fetchProfileOptions().catch(() => {});
    }
  }, [authUser, fetchProfileOptions]);

  const load = useCallback(
    async (keyword) => {
      setStatus({ loading: true, error: "" });
      try {
        const query = keyword ? `?q=${encodeURIComponent(keyword)}` : "";
        const data = await getJson(
          `/api/courses/${courseId}/ai-users/${query}`
        );
        setItems(data.items || []);
        setCourseInfo(data.course || null);
        setStatus({ loading: false, error: "" });
      } catch (error) {
        setStatus({
          loading: false,
          error: error.message || "Failed to load AI users.",
        });
      }
    },
    [courseId]
  );

  useEffect(() => {
    if (!authUser || !courseId) return;
    load().catch(() => {});
  }, [authUser, courseId, load]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((item) => {
      return (
        item.username?.toLowerCase().includes(q) ||
        (item.display_name || "").toLowerCase().includes(q) ||
        (item.city || "").toLowerCase().includes(q)
      );
    });
  }, [items, search]);

  const resetForm = () => {
    setFormData({ ...INITIAL_FORM, interests: [] });
    setFormError("");
    setFormBusy(false);
  };

  const openCreate = () => {
    resetForm();
    setFormOpen(true);
    setFormData({ ...INITIAL_FORM, interests: [] });
  };

  const openEdit = (item) => {
    setFormError("");
    setFormBusy(false);
    setFormData({
      id: item.id,
      username: item.username || "",
      display_name: item.display_name || "",
      gender: item.gender || "",
      city: item.city || "",
      age_group: item.age_group || "",
      education_level: item.education_level || "",
      income_level: item.income_level || "",
      social_value: item.social_value ?? 5,
      sociability: item.sociability ?? 5,
      openness: item.openness ?? 5,
      content_preference: item.content_preference || "",
      interests: Array.isArray(item.interests) ? [...item.interests] : [],
      shopping_frequency: item.shopping_frequency || "",
      buying_behavior: item.buying_behavior || "",
      decision_factor: item.decision_factor || "",
      shopping_preference: item.shopping_preference || "",
      digital_time: item.digital_time || "",
      interaction_style: item.interaction_style || "",
      influencer_type: item.influencer_type || "",
      notes: item.notes || "",
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    resetForm();
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleInterestToggle = (interest) => {
    setFormData((prev) => {
      const has = prev.interests.includes(interest);
      return {
        ...prev,
        interests: has
          ? prev.interests.filter((item) => item !== interest)
          : [...prev.interests, interest],
      };
    });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormBusy(true);
    const normalizeScale = (value) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return 5;
      if (numeric < 1) return 1;
      if (numeric > 10) return 10;
      return numeric;
    };
    const payload = {
      username: formData.username.trim(),
      display_name: formData.display_name.trim(),
      gender: formData.gender,
      city: formData.city,
      age_group: formData.age_group,
      education_level: formData.education_level,
      income_level: formData.income_level,
      social_value: normalizeScale(formData.social_value),
      sociability: normalizeScale(formData.sociability),
      openness: normalizeScale(formData.openness),
      content_preference: formData.content_preference,
      interests: formData.interests,
      shopping_frequency: formData.shopping_frequency,
      buying_behavior: formData.buying_behavior,
      decision_factor: formData.decision_factor,
      shopping_preference: formData.shopping_preference,
      digital_time: formData.digital_time,
      interaction_style: formData.interaction_style,
      influencer_type: formData.influencer_type,
      notes: formData.notes.trim(),
    };

    try {
      if (formData.id) {
        await patchJson(
          `/api/courses/${courseId}/ai-users/${formData.id}/`,
          payload
        );
      } else {
        await postJson(`/api/courses/${courseId}/ai-users/`, payload);
      }
      await load();
      closeForm();
    } catch (error) {
      setFormError(error.message || "Failed to save AI user.");
      setFormBusy(false);
    }
  };

  const handleDelete = (item) => {
    setDeleteState({ open: true, item });
  };

  const cancelDelete = () => {
    setDeleteState({ open: false, item: null });
  };

  const confirmDelete = async () => {
    if (!deleteState.item) return;
    try {
      await deleteJson(
        `/api/courses/${courseId}/ai-users/${deleteState.item.id}/`
      );
      setItems((prev) => prev.filter((it) => it.id !== deleteState.item.id));
      setDeleteState({ open: false, item: null });
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        error: error.message || "Failed to delete AI user.",
      }));
      setDeleteState({ open: false, item: null });
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportBusy(true);
    setImportMessage("");
    try {
      const report = await uploadFile(
        `/api/courses/${courseId}/ai-users/import/`,
        file
      );
      setImportMessage(
        `Import finished: ${report.created} created, ${
          report.updated
        } updated.${
          report.errors?.length ? `\n${report.errors.join("\n")}` : ""
        }`
      );
      await load();
    } catch (error) {
      setImportMessage(error.message || "Import failed.");
    } finally {
      setImportBusy(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  if (!authCheckComplete || !authUser) return null;

  const interestOptions = profileOptions?.interests || [];

  return (
    <AuthenticatedShell
      title="AI Users"
      subtitle={
        courseInfo
          ? `Manage AI personas for ${courseInfo.course_code} · ${courseInfo.name}`
          : "Manage AI personas for this course"
      }
    >
      <div className="flex items-center justify-between gap-2 py-4">
        <div className="flex flex-col">
          <label className="text-xs font-semibold text-slate-500">Search</label>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search username, display name or city..."
            className="mt-1 w-64 rounded-full border border-orange-200 bg-white px-4 py-2 text-xs text-slate-700 outline-none transition focus:border-brand"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-orange-200 bg-white px-4 py-2 text-xs font-semibold text-brand transition hover:border-brand"
            onClick={() => navigate(`/courses/${courseId}`)}
          >
            ← Back to course
          </button>
          <button
            type="button"
            className="rounded-full border border-brand bg-orange-100 px-4 py-2 text-xs font-semibold text-brand transition hover:bg-orange-200 disabled:opacity-60"
            onClick={openCreate}
          >
            ＋ Create AI User
          </button>
          <button
            type="button"
            className="rounded-full border border-orange-200 bg-white px-4 py-2 text-xs font-semibold text-brand transition hover:border-brand disabled:opacity-60"
            onClick={() => fileInputRef.current?.click()}
            disabled={importBusy}
          >
            {importBusy ? "Importing..." : "Import CSV"}
          </button>
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </div>

      {status.error ? <Feedback error={status.error} /> : null}
      {importMessage ? (
        <div className="mb-4 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-xs text-slate-600 whitespace-pre-line">
          {importMessage}
        </div>
      ) : null}

      {status.loading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : filteredItems.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50 px-4 py-6 text-sm text-slate-500">
          No AI users found yet for this course.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-orange-50 text-left text-xs text-slate-600">
            <thead className="bg-orange-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Display name</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">Gender</th>
                <th className="px-4 py-3 text-center">Social Value</th>
                <th className="px-4 py-3 text-center">Sociability</th>
                <th className="px-4 py-3 text-center">Openness</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-orange-50">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-orange-50/50">
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    {item.username}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {item.display_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {item.city || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {item.gender || "—"}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600">
                    {item.social_value ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600">
                    {item.sociability ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600">
                    {item.openness ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded-full border border-orange-200 px-3 py-1 text-[11px] font-semibold text-brand transition hover:border-brand"
                        onClick={() => openEdit(item)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-semibold text-red-500 transition hover:border-red-300"
                        onClick={() => handleDelete(item)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <form
            className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl shadow-orange-200"
            onSubmit={handleFormSubmit}
          >
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {formData.id ? "Edit AI User" : "Create AI User"}
                </h2>
                <p className="text-xs text-slate-500">
                  Fill in the persona profile for this course.
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-orange-200 px-4 py-2 text-xs font-semibold text-slate-500 transition hover:border-orange-300 hover:text-brand"
                onClick={closeForm}
                disabled={formBusy}
              >
                Close
              </button>
            </header>

            {formError ? <Feedback error={formError} /> : null}

            <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600">
                  Username<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => handleFormChange("username", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-orange-200 px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-brand"
                  placeholder="Unique username for this course"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600">
                  Display name
                </label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) =>
                    handleFormChange("display_name", e.target.value)
                  }
                  className="mt-1 w-full rounded-xl border border-orange-200 px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-brand"
                  placeholder="Optional display name"
                />
              </div>
            </section>

            <Section title="Demographic">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <SelectField
                  label="Gender"
                  value={formData.gender}
                  onChange={(value) => handleFormChange("gender", value)}
                  options={profileOptions?.genders}
                />
                <SelectField
                  label="City"
                  value={formData.city}
                  onChange={(value) => handleFormChange("city", value)}
                  options={profileOptions?.cities}
                />
                <SelectField
                  label="Age group"
                  value={formData.age_group}
                  onChange={(value) => handleFormChange("age_group", value)}
                  options={profileOptions?.age_groups}
                />
                <SelectField
                  label="Education level"
                  value={formData.education_level}
                  onChange={(value) =>
                    handleFormChange("education_level", value)
                  }
                  options={profileOptions?.education_levels}
                />
                <SelectField
                  label="Income level"
                  value={formData.income_level}
                  onChange={(value) => handleFormChange("income_level", value)}
                  options={profileOptions?.income_levels}
                />
              </div>
            </Section>

            <Section title="Psychographic">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <SliderField
                  label="Social value"
                  value={formData.social_value}
                  onChange={(value) => handleFormChange("social_value", value)}
                />
                <SliderField
                  label="Sociability"
                  value={formData.sociability}
                  onChange={(value) => handleFormChange("sociability", value)}
                />
                <SliderField
                  label="Openness"
                  value={formData.openness}
                  onChange={(value) => handleFormChange("openness", value)}
                />
              </div>
              <SelectField
                label="Preferred content"
                value={formData.content_preference}
                onChange={(value) =>
                  handleFormChange("content_preference", value)
                }
                options={profileOptions?.content_preference}
              />
              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-600">
                  Lifestyle interests
                </p>
                <p className="text-[11px] text-slate-400">
                  Select any interests that fit this persona.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {interestOptions.map((interest) => {
                    const active = formData.interests.includes(interest);
                    return (
                      <button
                        type="button"
                        key={interest}
                        className={`rounded-full border px-3 py-1 text-xs transition ${
                          active
                            ? "border-brand bg-orange-100 text-brand"
                            : "border-orange-200 text-slate-500 hover:border-brand hover:text-brand"
                        }`}
                        onClick={() => handleInterestToggle(interest)}
                        disabled={formBusy}
                      >
                        {interest}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Section>

            <Section title="Behavioural / Shopping">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <SelectField
                  label="Shopping frequency"
                  value={formData.shopping_frequency}
                  onChange={(value) =>
                    handleFormChange("shopping_frequency", value)
                  }
                  options={profileOptions?.shopping_frequency}
                />
                <SelectField
                  label="Buying behaviour"
                  value={formData.buying_behavior}
                  onChange={(value) =>
                    handleFormChange("buying_behavior", value)
                  }
                  options={profileOptions?.buying_behavior}
                />
                <SelectField
                  label="Decision factor"
                  value={formData.decision_factor}
                  onChange={(value) =>
                    handleFormChange("decision_factor", value)
                  }
                  options={profileOptions?.decision_factors}
                />
                <SelectField
                  label="Shopping preference"
                  value={formData.shopping_preference}
                  onChange={(value) =>
                    handleFormChange("shopping_preference", value)
                  }
                  options={profileOptions?.shopping_preference}
                />
              </div>
            </Section>

            <Section title="Digital / Social Media">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <SelectField
                  label="Social media usage"
                  value={formData.digital_time}
                  onChange={(value) => handleFormChange("digital_time", value)}
                  options={profileOptions?.digital_time}
                />
                <SelectField
                  label="Interaction style"
                  value={formData.interaction_style}
                  onChange={(value) =>
                    handleFormChange("interaction_style", value)
                  }
                  options={profileOptions?.interaction_style}
                />
                <SelectField
                  label="Influencer type"
                  value={formData.influencer_type}
                  onChange={(value) =>
                    handleFormChange("influencer_type", value)
                  }
                  options={profileOptions?.influencer_type}
                />
              </div>
            </Section>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-600">
                Notes
              </label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(e) => handleFormChange("notes", e.target.value)}
                className="mt-1 w-full rounded-xl border border-orange-200 px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-brand"
                placeholder="Additional notes about this AI persona"
                disabled={formBusy}
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                className="rounded-full border border-orange-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-orange-300 hover:text-brand disabled:opacity-60"
                onClick={closeForm}
                disabled={formBusy}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full border border-brand bg-brand px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand/90 disabled:opacity-60"
                disabled={formBusy}
              >
                {formBusy ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <ConfirmDialog
        open={deleteState.open}
        title="Delete AI User?"
        message={
          deleteState.item
            ? `Are you sure you want to delete ${deleteState.item.username}?`
            : ""
        }
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </AuthenticatedShell>
  );
}

function Section({ title, children }) {
  return (
    <section className="mt-6 rounded-2xl border border-orange-100 bg-orange-50/30 p-4">
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block text-xs font-semibold text-slate-600">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-orange-200 px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-brand"
      >
        <option value="">Please select</option>
        {(options || []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function SliderField({ label, value, onChange }) {
  const displayValue = value || 5;
  return (
    <label className="block text-xs font-semibold text-slate-600">
      {label} · Current: {displayValue || "—"}
      <input
        type="range"
        min="1"
        max="10"
        value={value || 5}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-brand"
      />
    </label>
  );
}
