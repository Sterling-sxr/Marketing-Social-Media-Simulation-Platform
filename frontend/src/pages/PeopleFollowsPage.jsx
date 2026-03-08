import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getJson } from "../lib/api";
import AuthenticatedShell from "./components/AuthenticatedShell";

export default function PeopleFollowsPage() {
  const { userId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [tab, setTab] = useState(() =>
    searchParams.get("tab") === "followers" ? "followers" : "following"
  );
  const navigate = useNavigate();

  useEffect(() => {
    setStatus({ loading: true, error: "" });
    const endpoint =
      tab === "followers"
        ? `/api/users/${userId}/followers/`
        : `/api/users/${userId}/following/`;
    getJson(endpoint)
      .then((data) => {
        setItems(data.items || []);
        setStatus({ loading: false, error: "" });
      })
      .catch((e) =>
        setStatus({ loading: false, error: e.message || "Failed to load data." })
      );
  }, [userId, tab]);

  const title = tab === "followers" ? "Follower" : "Following";

  return (
    <AuthenticatedShell
      title={title}
      subtitle="Switch to view Following / Followers"
    >
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-orange-50 p-1 text-xs">
        <button
          type="button"
          className={`rounded-full px-3 py-1 font-semibold ${
            tab === "following" ? "bg-white text-brand" : "text-slate-600"
          }`}
          onClick={() => {
            setTab("following");
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
            setTab("followers");
            setSearchParams({ tab: "followers" });
          }}
        >
          Followers
        </button>
      </div>

      {status.loading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : status.error ? (
        <p className="text-sm text-red-600">{status.error}</p>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50 px-4 py-3 text-sm text-slate-600">
          {tab === "followers" ? "No following yet" : "No follower yet"}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-2xl border border-orange-100 bg-white px-4 py-3 text-left shadow-sm transition hover:border-brand"
                onClick={() => navigate(`/people/${u.id}`)}
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {u.username || u.email}
                  </p>
                  <p className="text-xs text-slate-400">{u.email}</p>
                </div>
                <span className="text-xs text-brand">see detail</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </AuthenticatedShell>
  );
}
