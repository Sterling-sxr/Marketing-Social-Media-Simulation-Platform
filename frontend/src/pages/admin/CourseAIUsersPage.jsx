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

const AI_INPUT_LIMITS = {
  audienceType: 160,
  interests: 400,
  notes: 400,
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
  // Manual create/edit form
  const [formOpen, setFormOpen] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [formData, setFormData] = useState(INITIAL_FORM);
  // CSV import
  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  // Delete & bulk delete
  const [deleteState, setDeleteState] = useState({ open: false, item: null });
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  // Educator-friendly AI-assisted creation flow (first version – uses mock data)
  const [aiFlowOpen, setAiFlowOpen] = useState(false);
  const [aiInput, setAiInput] = useState({
    audienceType: "",
    numberOfUsers: 3,
    interests: "",
    activityLevel: "Medium",
    notes: "",
  });
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [aiStatus, setAiStatus] = useState({ loading: false, error: "" });

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
        setSelectedIds([]);
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
      setSelectedIds((prev) =>
        prev.filter((id) => id !== deleteState.item.id)
      );
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

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id]
    );
  };

  const allVisibleSelected =
    filteredItems.length > 0 &&
    filteredItems.every((item) => selectedIds.includes(item.id));

  const toggleSelectAllVisible = () => {
    if (!filteredItems.length) return;
    if (allVisibleSelected) {
      // Deselect all visible items
      const visibleIds = new Set(filteredItems.map((item) => item.id));
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.has(id)));
    } else {
      // Select all visible items, keep other selected ids
      const visibleIds = filteredItems.map((item) => item.id);
      setSelectedIds((prev) => {
        const merged = new Set([...prev, ...visibleIds]);
        return Array.from(merged);
      });
    }
  };

  const handleBulkDeleteClick = () => {
    if (!selectedIds.length) return;
    setBulkDeleteOpen(true);
  };

  const confirmBulkDelete = async () => {
    if (!selectedIds.length) {
      setBulkDeleteOpen(false);
      return;
    }
    setBulkBusy(true);
    try {
      const idsToDelete = [...selectedIds];
      await Promise.all(
        idsToDelete.map((id) =>
          deleteJson(`/api/courses/${courseId}/ai-users/${id}/`).catch(() => null)
        )
      );
      setItems((prev) => prev.filter((it) => !idsToDelete.includes(it.id)));
      setSelectedIds([]);
      setBulkDeleteOpen(false);
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        error: error.message || "Failed to delete selected AI users.",
      }));
      setBulkDeleteOpen(false);
    } finally {
      setBulkBusy(false);
    }
  };

  // ---------- AI-assisted creation flow ----------

  const openAiFlow = () => {
    setAiFlowOpen(true);
    setAiStatus({ loading: false, error: "" });
    setAiSuggestions([]);
  };

  const closeAiFlow = () => {
    setAiFlowOpen(false);
    setAiStatus({ loading: false, error: "" });
  };

  const handleAiInputChange = (field, value) => {
    setAiInput((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleGenerateAiSuggestions = async (event) => {
    event.preventDefault();
    setAiStatus({ loading: true, error: "" });
    try {
      const suggestions = await mockGenerateAISuggestions(aiInput, courseInfo);
      setAiSuggestions(suggestions);
      setAiStatus({ loading: false, error: "" });
    } catch (error) {
      setAiStatus({
        loading: false,
        error: error.message || "Unable to generate suggestions.",
      });
    }
  };

  const applySuggestionToForm = (suggestion) => {
    const pickOption = (value, options) => {
      if (
        value === undefined ||
        value === null ||
        !Array.isArray(options) ||
        options.length === 0
      ) {
        return "";
      }
      const normalizedValue = String(value).trim();
      if (!normalizedValue) return "";
      if (options.includes(normalizedValue)) return normalizedValue;
      const lower = normalizedValue.toLowerCase();
      const exactMatch = options.find((opt) => opt.toLowerCase() === lower);
      if (exactMatch) return exactMatch;
      const keywordMatch = options.find((opt) =>
        opt.toLowerCase().includes(lower)
      );
      return keywordMatch || "";
    };
    const getFirstValue = (obj, keys, fallback = "") => {
      for (const key of keys) {
        const value = obj?.[key];
        if (
          value !== undefined &&
          value !== null &&
          String(value).trim() !== ""
        ) {
          return value;
        }
      }
      return fallback;
    };
    const normalizeScale = (value, fallback = 5) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return fallback;
      if (numeric < 1) return 1;
      if (numeric > 10) return 10;
      return Math.round(numeric);
    };
    const normalizeInterests = (value, options) => {
      if (!Array.isArray(options) || options.length === 0) return [];
      const rawItems = Array.isArray(value)
        ? value
        : String(value || "")
            .replace(/;/g, ",")
            .split(",");
      const mapped = rawItems
        .map((item) => pickOption(item, options))
        .filter(Boolean);
      return Array.from(new Set(mapped));
    };

    // Map suggestion into existing AI user form structure.
    // This keeps the actual create/patch logic unchanged.
    setFormData({
      ...INITIAL_FORM,
      username: String(suggestion?.username || "").trim(),
      display_name: String(suggestion?.display_name || "").trim(),
      gender: pickOption(
        getFirstValue(suggestion, ["gender"]),
        profileOptions?.genders
      ),
      city: pickOption(
        getFirstValue(suggestion, ["city"]),
        profileOptions?.cities
      ),
      age_group: pickOption(
        getFirstValue(suggestion, ["age_group"]),
        profileOptions?.age_groups
      ),
      education_level: pickOption(
        getFirstValue(suggestion, ["education_level"]),
        profileOptions?.education_levels
      ),
      income_level: pickOption(
        getFirstValue(suggestion, ["income_level"]),
        profileOptions?.income_levels
      ),
      social_value: normalizeScale(suggestion?.social_value, 5),
      sociability: normalizeScale(suggestion?.sociability, 5),
      openness: normalizeScale(suggestion?.openness, 5),
      content_preference: pickOption(
        getFirstValue(suggestion, ["content_preference", "preferred_content"]),
        profileOptions?.content_preference
      ),
      interests: normalizeInterests(
        getFirstValue(suggestion, ["interests"], []),
        profileOptions?.interests
      ),
      shopping_frequency: pickOption(
        getFirstValue(suggestion, ["shopping_frequency"]),
        profileOptions?.shopping_frequency
      ),
      buying_behavior: pickOption(
        getFirstValue(suggestion, ["buying_behavior", "buying_behaviour"]),
        profileOptions?.buying_behavior
      ),
      decision_factor: pickOption(
        getFirstValue(suggestion, ["decision_factor", "decision_factors"]),
        profileOptions?.decision_factors
      ),
      shopping_preference: pickOption(
        getFirstValue(suggestion, ["shopping_preference"]),
        profileOptions?.shopping_preference
      ),
      digital_time: pickOption(
        getFirstValue(suggestion, ["digital_time", "activity_level"]),
        profileOptions?.digital_time
      ),
      interaction_style: pickOption(
        getFirstValue(suggestion, ["interaction_style"]),
        profileOptions?.interaction_style
      ),
      influencer_type: pickOption(
        getFirstValue(suggestion, ["influencer_type"]),
        profileOptions?.influencer_type
      ),
      notes: String(suggestion?.notes || "").trim(),
    });
    setAiFlowOpen(false);
    setFormError("");
    setFormBusy(false);
    setFormOpen(true);
  };

  const handleUseTemplate = () => {
    // Simple, non-AI template: give educators a quick starting point.
    resetForm();
    setFormData((prev) => ({
      ...prev,
      username: "",
      display_name: "Typical active student",
      notes:
        "Template persona: an engaged student who participates regularly, checks the platform a few times a day, and is curious about new content.",
    }));
    setFormOpen(true);
  };

  if (!authCheckComplete || !authUser) return null;

  const interestOptions = profileOptions?.interests || [];
  const hasPersonas = items.length > 0;

  return (
    <AuthenticatedShell
      title="AI Users"
      subtitle={
        courseInfo
          ? `Manage AI personas for ${courseInfo.course_code} · ${courseInfo.name}`
          : "Manage AI personas for this course"
      }
    >
      <input
        type="file"
        accept=".csv"
        ref={fileInputRef}
        className="hidden"
        onChange={handleImport}
      />

      {hasPersonas ? (
        <div className="mt-4 min-w-0 space-y-3 rounded-3xl border border-brand-100 bg-white px-4 py-3">
          {/* Search row */}
          <div className="flex min-w-0 w-full flex-col sm:max-w-xs">
            <label className="text-xs font-semibold text-slate-500">
              Search students & personas
            </label>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by username, display name or city…"
              className="mt-1 w-full min-w-0 rounded-full border border-brand-200 bg-white px-4 py-2 text-xs text-slate-700 outline-none transition focus:border-brand sm:w-64"
            />
          </div>

          {/* Main actions row */}
          <div className="flex flex-wrap items-stretch justify-start gap-2 sm:items-center">
            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-brand bg-brand px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand/90 disabled:opacity-60 sm:w-auto"
              onClick={openAiFlow}
            >
              <span className="text-[13px]">✨ Generate with AI</span>
            </button>
            <button
              type="button"
              className="w-full rounded-full border border-brand-200 bg-white px-3 py-2 text-[11px] font-semibold text-brand transition hover:border-brand disabled:opacity-60 sm:w-auto"
              onClick={handleUseTemplate}
            >
              Start from template
            </button>
            <button
              type="button"
              className="w-full rounded-full border border-brand-200 bg-white px-3 py-2 text-[11px] font-semibold text-brand transition hover:border-brand disabled:opacity-60 sm:w-auto"
              onClick={openCreate}
            >
              Create manually
            </button>
          </div>

          {/* Secondary actions row */}
          <div className="flex flex-wrap items-stretch justify-start gap-2 sm:items-center">
            <button
              type="button"
              className="w-full rounded-full border border-brand-200 bg-white px-3 py-2 text-[11px] font-semibold text-brand transition hover:border-brand disabled:opacity-60 sm:w-auto"
              onClick={() => fileInputRef.current?.click()}
              disabled={importBusy}
            >
              {importBusy ? "Importing CSV…" : "Import CSV"}
            </button>
            <button
              type="button"
              className="w-full rounded-full border border-brand-200 bg-white px-3 py-2 text-[11px] font-semibold text-brand transition hover:border-brand sm:w-auto"
              onClick={() => navigate(`/courses/${courseId}`)}
            >
              Back to course
            </button>
            <button
              type="button"
              className="w-full rounded-full border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-500 transition hover:border-red-300 disabled:opacity-60 sm:w-auto"
              onClick={handleBulkDeleteClick}
              disabled={selectedIds.length === 0 || bulkBusy}
            >
              {bulkBusy ? "Deleting…" : "Delete selected"}
            </button>
          </div>
        </div>
      ) : null}

      {status.error ? <Feedback error={status.error} /> : null}
      {importMessage ? (
        <div className="mb-4 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-xs text-slate-600 whitespace-pre-line">
          {importMessage}
        </div>
      ) : null}

      {status.loading ? (
        <p className="text-sm text-slate-500">Loading personas…</p>
      ) : !hasPersonas ? (
        <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50 px-4 py-5 text-sm text-slate-700">
          <h2 className="text-base font-semibold text-slate-900">
            No AI personas for this course yet
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Let AI suggest a few personas for you, or start with a template or a manual setup.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-brand bg-brand px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand/90 disabled:opacity-60"
              onClick={openAiFlow}
            >
              <span className="text-[13px]">✨ Generate personas with AI</span>
            </button>
            <button
              type="button"
              className="rounded-full border border-brand-200 bg-white px-3 py-2 text-[11px] font-semibold text-brand transition hover:border-brand disabled:opacity-60"
              onClick={handleUseTemplate}
            >
              Start from template
            </button>
            <button
              type="button"
              className="rounded-full border border-brand-200 bg-white px-3 py-2 text-[11px] font-semibold text-brand transition hover:border-brand disabled:opacity-60"
              onClick={openCreate}
            >
              Create manually
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
            <button
              type="button"
              className="rounded-full border border-brand-100 bg-white px-3 py-1.5 font-semibold text-brand transition hover:border-brand-200 disabled:opacity-60"
              onClick={() => fileInputRef.current?.click()}
              disabled={importBusy}
            >
              {importBusy ? "Importing CSV…" : "Import CSV"}
            </button>
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 transition hover:border-slate-300"
              onClick={() => navigate(`/courses/${courseId}`)}
            >
              Back to course
            </button>
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-brand-100 bg-white px-4 py-4 text-xs text-slate-500">
          No personas match your current search. Try adjusting your keywords.
        </p>
      ) : (
        <div className="rounded-2xl border border-brand-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full divide-y divide-brand-50 text-left text-xs text-slate-600">
            <thead className="bg-brand-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    className="h-3 w-3 rounded border-brand-300 text-brand"
                    checked={allVisibleSelected && filteredItems.length > 0}
                    onChange={toggleSelectAllVisible}
                  />
                </th>
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
            <tbody className="divide-y divide-brand-50">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-brand-50/50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-3 w-3 rounded border-brand-300 text-brand"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleSelect(item.id)}
                    />
                  </td>
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
                        className="rounded-full border border-brand-200 px-3 py-1 text-[11px] font-semibold text-brand transition hover:border-brand"
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
        </div>
      )}

      {formOpen ? (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-black/40 px-4 py-4 sm:flex sm:items-center sm:justify-center sm:px-6">
          <form
            className="mx-auto min-h-fit w-full max-w-3xl rounded-3xl bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] shadow-2xl shadow-brand-200 sm:max-h-[92vh] sm:overflow-y-auto sm:p-6 sm:pb-6"
            onSubmit={handleFormSubmit}
          >
            <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                className="rounded-full border border-brand-200 px-4 py-2 text-xs font-semibold text-slate-500 transition hover:border-brand-300 hover:text-brand"
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
                  className="mt-1 w-full rounded-xl border border-brand-200 px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-brand"
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
                  className="mt-1 w-full rounded-xl border border-brand-200 px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-brand"
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
                            ? "border-brand bg-brand-100 text-brand"
                            : "border-brand-200 text-slate-500 hover:border-brand hover:text-brand"
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
                className="mt-1 w-full rounded-xl border border-brand-200 px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-brand"
                placeholder="Additional notes about this AI persona"
                disabled={formBusy}
              />
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                className="w-full rounded-full border border-brand-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand disabled:opacity-60 sm:w-auto"
                onClick={closeForm}
                disabled={formBusy}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="w-full rounded-full border border-brand bg-brand px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand/90 disabled:opacity-60 sm:w-auto"
                disabled={formBusy}
              >
                {formBusy ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* AI-assisted creation modal (first skeleton; suggestions currently mocked) */}
      {aiFlowOpen ? (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-black/40 px-4 py-4 sm:flex sm:items-center sm:justify-center sm:px-6">
          <div className="mx-auto min-h-fit w-full max-w-4xl rounded-3xl bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] shadow-2xl shadow-brand-200 sm:max-h-[92vh] sm:overflow-y-auto sm:p-6 sm:pb-6">
            <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Generate personas with AI
                </h2>
                <p className="text-xs text-slate-500">
                  Describe the students you have in mind and we&apos;ll suggest a few personas you can adjust and save.
                </p>
                {courseInfo ? (
                  <p className="mt-1 text-[11px] text-slate-400">
                    Course context:{" "}
                    <span className="font-medium">
                      {courseInfo.course_code} · {courseInfo.name}
                    </span>
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="rounded-full border border-brand-200 px-4 py-2 text-xs font-semibold text-slate-500 transition hover:border-brand-300 hover:text-brand"
                onClick={closeAiFlow}
                disabled={aiStatus.loading}
              >
                Close
              </button>
            </header>

            <div className="mt-4 grid gap-4 md:grid-cols-2 md:gap-6">
              {/* Educator input side */}
              <section className="space-y-3 rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  1 · Describe your audience
                </h3>
                <p className="text-[11px] text-slate-500">
                  Use plain language. Focus on who your students are and how you&apos;d like this persona to behave.
                </p>
                <label className="block text-xs font-semibold text-slate-600">
                  Audience type
                  <input
                    type="text"
                    value={aiInput.audienceType}
                    onChange={(e) =>
                      handleAiInputChange("audienceType", e.target.value)
                    }
                    placeholder="e.g. first-year business students, active social media users"
                    maxLength={AI_INPUT_LIMITS.audienceType}
                    className="mt-1 w-full rounded-xl border border-brand-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand"
                  />
                  <p className="mt-1 text-right text-[10px] text-slate-400">
                    {aiInput.audienceType.length}/{AI_INPUT_LIMITS.audienceType}
                  </p>
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  Number of personas to suggest
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={aiInput.numberOfUsers}
                    onChange={(e) =>
                      handleAiInputChange(
                        "numberOfUsers",
                        Number(e.target.value || 1)
                      )
                    }
                    className="mt-1 w-24 rounded-xl border border-brand-200 px-3 py-1.5 text-sm text-slate-700 outline-none transition focus:border-brand"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  Interests & topics
                  <textarea
                    rows={3}
                    value={aiInput.interests}
                    onChange={(e) =>
                      handleAiInputChange("interests", e.target.value)
                    }
                    placeholder="What kinds of content, hobbies, or campus activities should this persona enjoy?"
                    maxLength={AI_INPUT_LIMITS.interests}
                    className="mt-1 w-full rounded-xl border border-brand-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand"
                  />
                  <p className="mt-1 text-right text-[10px] text-slate-400">
                    {aiInput.interests.length}/{AI_INPUT_LIMITS.interests}
                  </p>
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  Activity level on Bread
                  <select
                    value={aiInput.activityLevel}
                    onChange={(e) =>
                      handleAiInputChange("activityLevel", e.target.value)
                    }
                    className="mt-1 w-full rounded-xl border border-brand-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand"
                  >
                    <option value="Low">Low · rarely checks updates</option>
                    <option value="Medium">
                      Medium · checks a few times per week
                    </option>
                    <option value="High">
                      High · checks daily and posts often
                    </option>
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  Any special notes for AI
                  <textarea
                    rows={3}
                    value={aiInput.notes}
                    onChange={(e) =>
                      handleAiInputChange("notes", e.target.value)
                    }
                    placeholder="e.g. should represent a struggling student, a top performer, or a social connector in the class."
                    maxLength={AI_INPUT_LIMITS.notes}
                    className="mt-1 w-full rounded-xl border border-brand-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand"
                  />
                  <p className="mt-1 text-right text-[10px] text-slate-400">
                    {aiInput.notes.length}/{AI_INPUT_LIMITS.notes}
                  </p>
                </label>
                <button
                  type="button"
                  onClick={handleGenerateAiSuggestions}
                  className="mt-1 inline-flex items-center justify-center rounded-full border border-brand bg-brand px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand/90 disabled:opacity-60"
                  disabled={aiStatus.loading}
                >
                  {aiStatus.loading
                    ? "Generating suggestions…"
                    : "Generate suggestions"}
                </button>
                {aiStatus.error ? (
                  <p className="mt-2 text-[11px] text-red-600">
                    {aiStatus.error}
                  </p>
                ) : null}
                <p className="mt-1 text-[10px] text-slate-400">
                  For now, suggestions are sample personas. Your backend can plug in a live AI endpoint later.
                </p>
              </section>

              {/* Suggestions / preview side */}
              <section className="space-y-2 rounded-2xl border border-brand-100 bg-white p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  2 · Review suggested personas
                </h3>
                {aiSuggestions.length === 0 && !aiStatus.loading ? (
                  <div className="rounded-xl border border-dashed border-brand-100 bg-brand-50/40 px-3 py-3 text-[11px] text-slate-500">
                    <p className="font-semibold text-slate-700">
                      No suggestions yet
                    </p>
                    <p className="mt-1">
                      After you describe your audience and click{" "}
                      <span className="font-semibold">
                        Generate suggestions
                      </span>
                      , personas will appear here.
                    </p>
                    <p className="mt-1">
                      You can then review a persona and apply it to the detailed form to fine-tune before saving.
                    </p>
                  </div>
                ) : null}
                <div className="space-y-3">
                  {aiSuggestions.map((suggestion, index) => (
                    <article
                      key={suggestion.username || index}
                      className="rounded-2xl border border-brand-100 bg-brand-50/40 p-3 text-xs text-slate-700"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Persona {index + 1}
                          </p>
                          <p className="text-sm font-semibold text-slate-900">
                            {suggestion.display_name || "Unnamed persona"}
                          </p>
                          {suggestion.audience_summary ? (
                            <p className="mt-1 text-[11px] text-slate-500">
                              {formatAudienceSummary(
                                suggestion.audience_summary
                              )}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="rounded-full border border-brand-200 bg-white px-3 py-1 text-[11px] font-semibold text-brand transition hover:border-brand hover:text-brand"
                          onClick={() => applySuggestionToForm(suggestion)}
                          disabled={aiStatus.loading}
                        >
                          Apply to form
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-500">
                        {suggestion.city ? (
                          <span className="rounded-full border border-brand-100 bg-white px-2 py-0.5 font-medium text-slate-600">
                            City: {suggestion.city}
                          </span>
                        ) : null}
                        {suggestion.gender ? (
                          <span className="rounded-full border border-brand-100 bg-white px-2 py-0.5 font-medium text-slate-600">
                            Gender: {suggestion.gender}
                          </span>
                        ) : null}
                        {suggestion.age_group ? (
                          <span className="rounded-full border border-brand-100 bg-white px-2 py-0.5 font-medium text-slate-600">
                            Age: {suggestion.age_group}
                          </span>
                        ) : null}
                        {typeof suggestion.social_value === "number" ? (
                          <span className="rounded-full border border-brand-100 bg-white px-2 py-0.5 font-medium text-slate-600">
                            Social value: {suggestion.social_value}/10
                          </span>
                        ) : null}
                        {typeof suggestion.sociability === "number" ? (
                          <span className="rounded-full border border-brand-100 bg-white px-2 py-0.5 font-medium text-slate-600">
                            Sociability: {suggestion.sociability}/10
                          </span>
                        ) : null}
                        {typeof suggestion.openness === "number" ? (
                          <span className="rounded-full border border-brand-100 bg-white px-2 py-0.5 font-medium text-slate-600">
                            Openness: {suggestion.openness}/10
                          </span>
                        ) : null}
                      </div>
                      {Array.isArray(suggestion.interests) &&
                      suggestion.interests.length ? (
                        <div className="mt-2 text-[10px]">
                          <span className="font-semibold text-slate-600">
                            Interests:
                          </span>{" "}
                          <span className="text-slate-500">
                            {suggestion.interests.join(", ")}
                          </span>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </div>
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
      <ConfirmDialog
        open={bulkDeleteOpen}
        title="Delete selected AI Users?"
        message={
          selectedIds.length
            ? `Are you sure you want to delete ${selectedIds.length} selected AI users?`
            : "No AI users are selected."
        }
        confirmLabel="Delete"
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkDeleteOpen(false)}
        processing={bulkBusy}
      />
    </AuthenticatedShell>
  );
}

function Section({ title, children }) {
  return (
    <section className="mt-6 rounded-2xl border border-brand-100 bg-brand-50/30 p-4">
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
        className="mt-1 w-full rounded-xl border border-brand-200 px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-brand"
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

function formatAudienceSummary(summary) {
  if (!summary) return "";
  // If the text starts with "For <course> ·", strip that part so we
  // don&apos;t repeat the full course name inside each card.
  const trimmed = summary.replace(/^For[^·]*·\s*/, "").trim();
  return trimmed || summary;
}

// Mocked AI persona suggestion helper.
// This is the single integration point to replace with a real backend call.
async function mockGenerateAISuggestions(input, courseInfo) {
  const count =
    typeof input.numberOfUsers === "number" && input.numberOfUsers > 0
      ? Math.min(input.numberOfUsers, 5)
      : 3;
  const baseCourseLabel = courseInfo
    ? `${courseInfo.course_code || ""} ${courseInfo.name || ""}`.trim()
    : "";

  const personas = [];
  for (let i = 0; i < count; i += 1) {
    const activity = input.activityLevel || "";
    let digitalTime = "";
    if (activity === "High") {
      digitalTime = "Several times a day";
    } else if (activity === "Medium") {
      digitalTime = "A few times a week";
    } else if (activity === "Low") {
      digitalTime = "About once a week or less";
    }

    personas.push({
      username: `ai_user_${(i + 1).toString().padStart(2, "0")}`,
      display_name:
        i === 0
          ? "Curious connector"
          : i === 1
          ? "Quiet observer"
          : "Goal‑driven achiever",
      gender: "",
      city: "",
      age_group: "",
      education_level: "",
      income_level: "",
      social_value: i === 1 ? 4 : 8,
      sociability: i === 1 ? 3 : 7,
      openness: i === 0 ? 9 : 6,
      content_preference: "",
      interests: input.interests
        ? input.interests
            .split(/[;,]/)
            .map((v) => v.trim())
            .filter(Boolean)
        : [],
      shopping_frequency: "",
      buying_behavior: "",
      decision_factor: "",
      shopping_preference: "",
      digital_time: digitalTime,
      interaction_style:
        i === 0 ? "Active commenter" : i === 1 ? "Lurker" : "Question asker",
      influencer_type: "",
      notes:
        input.notes ||
        "This persona was generated as a starting point. Please review and adjust any details before saving.",
      audience_summary: [
        baseCourseLabel && `For ${baseCourseLabel}`,
        input.audienceType && `Audience: ${input.audienceType}`,
        input.activityLevel && `Activity: ${input.activityLevel.toLowerCase()}`,
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }

  // Simulate network latency a bit so loading state is visible.
  await new Promise((resolve) => setTimeout(resolve, 700));
  return personas;
}
