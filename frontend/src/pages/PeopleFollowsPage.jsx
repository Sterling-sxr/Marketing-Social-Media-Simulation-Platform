import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getJson } from "../lib/api";
import AuthenticatedShell from "./components/AuthenticatedShell";

export default function PeopleFollowsPage() {
  // Get user id from route params
  const { userId } = useParams();

  // Read and update URL query params
  const [searchParams, setSearchParams] = useSearchParams();

  // List of followers or following users
  const [items, setItems] = useState([]);

  // Loading and error state
  const [status, setStatus] = useState({ loading: true, error: "" });

  // Current tab state
  // Default to "following"
  const [tab, setTab] = useState(() =>
    searchParams.get("tab") === "followers" ? "followers" : "following"
  );

  // Router navigation
  const navigate = useNavigate();

  // Load data when user id or tab changes
  useEffect(() => {
    // Reset loading state
    setStatus({ loading: true, error: "" });

    // Choose API endpoint by current tab
    const endpoint =
      tab === "followers"
        ? `/api/users/${userId}/followers/`
        : `/api/users/${userId}/following/`;

    getJson(endpoint)
      .then((data) => {
        // Save returned list
        setItems(data.items || []);

        // Clear loading and error
        setStatus({ loading: false, error: "" });
      })
      .catch((e) =>
        setStatus({
          loading: false,
          error: e.message || "Failed to load data.",
        })
      );
  }, [userId, tab]);

  // Page title by current tab
  const title = tab === "followers" ? "Follower" : "Following";

  return (
    <AuthenticatedShell
      title={title}
      subtitle="Switch to view Following / Followers"
    >
      {/* Tab switch buttons */}
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-50 p-1 text-xs">
        <button
          type="button"
          className={`rounded-full px-3 py-1 font-semibold ${
            tab === "following" ? "bg-white text-brand" : "text-slate-600"
          }`}
          onClick={() => {
            // Switch to following tab
            setTab("following");

            // Update URL query param
            setSearchParams({ tab: "following" });
          }}
        >
          Following
        </button>

        <button
          type="button"
          className={`rounded-full px-3 py-1 font-semibold ${
            tab === "followers" ? "bg-white text-brand" : "text-slate-600"
          }`}
          onClick={() => {
            // Switch to followers tab
            setTab("followers");

            // Update URL query param
            setSearchParams({ tab: "followers" });
          }}
        >
          Followers
        </button>
      </div>

      {/* Main content area */}
      {status.loading ? (
        // Loading state
        <p className="text-sm text-slate-500">Loading...</p>
      ) : status.error ? (
        // Error state
        <p className="text-sm text-red-600">{status.error}</p>
      ) : items.length === 0 ? (
        // Empty state
        <p className="rounded-2xl border border-dashed border-brand-200 bg-brand-50 px-4 py-3 text-sm text-slate-600">
          {tab === "followers" ? "No following yet" : "No follower yet"}
        </p>
      ) : (
        // User list
        <ul className="space-y-2">
          {items.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-2xl border border-brand-100 bg-white px-4 py-3 text-left shadow-sm transition hover:border-brand"
                onClick={() => navigate(`/people/${u.id}`)}
              >
                {/* User info */}
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {u.username || u.email}
                  </p>
                  <p className="text-xs text-slate-400">{u.email}</p>
                </div>

                {/* Detail hint */}
                <span className="text-xs text-brand">see detail</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </AuthenticatedShell>
  );
}
