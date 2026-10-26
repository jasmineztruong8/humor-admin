import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { displayName, fetchSince } from "@/lib/data";
import { daysAgo, percentile, perDay } from "@/lib/stats";
import { ChartCard, DailyColumns, StatTile } from "@/components/charts";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Generation requests · Humor Admin" };

const PAGE_SIZE = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Name = { first_name: string | null; last_name: string | null } | null;

type Row = {
  id: string;
  app: "site" | "admin";
  kind: "describe" | "caption";
  steer: string | null;
  status: "succeeded" | "failed";
  error: string | null;
  duration_ms: number;
  created_at: string;
  profiles: Name;
  prompt_chains: { name: string } | null;
  images: { id: string; title: string | null } | null;
  llm_responses: { count: number }[];
};

type Recent = { status: string; duration_ms: number; created_at: string };

const FILTERS = {
  status: [["", "Any status"], ["succeeded", "Succeeded"], ["failed", "Failed"]],
  kind: [["", "Any step"], ["describe", "Describe image"], ["caption", "Write caption"]],
  app: [["", "Any app"], ["site", "Caption site"], ["admin", "Admin panel"]],
} as const;

type Filters = { status: string; kind: string; app: string; chain: string; image: string };

function pick(value: unknown, allowed: readonly (readonly [string, string])[]) {
  return allowed.some(([v]) => v === value) ? String(value) : "";
}

// READ only: every AI request from both apps, newest first.
export default async function RequestsPage({ searchParams }: PageProps<"/requests">) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const filters: Filters = {
    status: pick(params.status, FILTERS.status),
    kind: pick(params.kind, FILTERS.kind),
    app: pick(params.app, FILTERS.app),
    chain: UUID.test(String(params.chain)) ? String(params.chain) : "",
    image: UUID.test(String(params.image)) ? String(params.image) : "",
  };
  const page = Math.max(1, Number(params.page) || 1);

  let query = supabase
    .from("generation_requests")
    .select(
      "id, app, kind, steer, status, error, duration_ms, created_at, profiles(first_name, last_name), prompt_chains(name), images(id, title), llm_responses(count)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.kind) query = query.eq("kind", filters.kind);
  if (filters.app) query = query.eq("app", filters.app);
  if (filters.chain) query = query.eq("chain_id", filters.chain);
  if (filters.image) query = query.eq("image_id", filters.image);

  const since = daysAgo(30);
  const weekAgo = daysAgo(7);
  const [{ data: requests, count, error }, recent] = await Promise.all([
    query.returns<Row[]>(),
    fetchSince<Recent>(supabase, "generation_requests", "status, duration_ms, created_at", since).catch((e) => {
      console.error(e);
      return null;
    }),
  ]);
  if (error) console.error("Loading generation requests failed", error);

  const week = recent?.filter((r) => r.created_at > weekAgo) ?? [];
  const weekOk = week.filter((r) => r.status === "succeeded");
  const median = percentile(weekOk.map((r) => r.duration_ms), 0.5);
  const p95 = percentile(weekOk.map((r) => r.duration_ms), 0.95);
  const seconds = (ms: number | null) => (ms === null ? "—" : `${(ms / 1000).toFixed(1)}s`);

  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const href = (p: Partial<Filters> & { page?: number }) => {
    const q = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...filters, ...p })) {
      if (key !== "page" && value) q.set(key, String(value));
    }
    if (p.page && p.page > 1) q.set("page", String(p.page));
    return `/requests${q.size ? `?${q}` : ""}`;
  };
  const filtered = Object.values(filters).some(Boolean);

  return (
    <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Generation requests</h1>
        <p className="text-dim">
          Every time someone asked the AI to describe a photo or suggest a caption, including suggestions that
          were never posted. Read-only. Open one to see each model it tried.
        </p>
      </div>

      {recent && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile label="Requests, last 7 days" value={week.length} note={`${recent.length} in 30 days`} />
            <StatTile
              label="Succeeded"
              value={week.length ? `${Math.round((weekOk.length / week.length) * 100)}%` : "—"}
              note={`${week.length - weekOk.length} failed`}
            />
            <StatTile label="Median time" value={seconds(median)} note="successful requests, 7 days" />
            <StatTile label="Slowest 5%" value={seconds(p95)} note="take at least this long" />
          </div>
          <ChartCard title="Requests per day" subtitle="Last 30 days, both apps">
            <DailyColumns data={perDay(recent.map((r) => r.created_at), 30)} unit="requests" />
          </ChartCard>
        </>
      )}

      <form className="flex flex-wrap gap-2 items-center">
        {(Object.keys(FILTERS) as (keyof typeof FILTERS)[]).map((name) => (
          <select key={name} name={name} defaultValue={filters[name]} className="field w-auto">
            {FILTERS[name].map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        ))}
        {filters.chain && <input type="hidden" name="chain" value={filters.chain} />}
        {filters.image && <input type="hidden" name="image" value={filters.image} />}
        <button className="btn">Apply</button>
        {filtered && <Link href="/requests" className="text-sm text-dim hover:text-ink">Clear filters</Link>}
      </form>
      {(filters.chain || filters.image) && (
        <p className="text-sm text-dim -mt-3">
          Showing requests for one {filters.chain ? "prompt chain" : "image"} only.
        </p>
      )}

      {error && <p className="text-danger">The requests didn&apos;t load. Please refresh the page.</p>}

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Status</th>
              <th>Step</th>
              <th>By</th>
              <th>Chain</th>
              <th>Image</th>
              <th>Topic</th>
              <th className="num">Models tried</th>
              <th className="num">Time</th>
            </tr>
          </thead>
          <tbody>
            {requests?.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap">
                  <Link href={`/requests/${r.id}`} className="hover:underline">{new Date(r.created_at).toLocaleString()}</Link>
                </td>
                <td>
                  <StatusBadge ok={r.status === "succeeded"} label={r.status === "succeeded" ? "Succeeded" : "Failed"} />
                </td>
                <td className="whitespace-nowrap">{r.kind === "describe" ? "Describe" : "Caption"}</td>
                <td className="whitespace-nowrap">
                  {displayName(r.profiles)}
                  {r.app === "admin" && <span className="ml-1.5 text-xs text-muted">admin</span>}
                </td>
                <td className="whitespace-nowrap text-dim">{r.prompt_chains?.name ?? "—"}</td>
                <td className="whitespace-nowrap">
                  {r.images ? (
                    <Link href={`/media/${r.images.id}`} className="hover:underline">{r.images.title || "Untitled"}</Link>
                  ) : (
                    <span className="text-muted">{r.kind === "describe" ? "new upload" : "draft"}</span>
                  )}
                </td>
                <td className="text-dim max-w-48 truncate">{r.steer ?? ""}</td>
                <td className="num">{r.llm_responses[0]?.count ?? 0}</td>
                <td className="num">{seconds(r.duration_ms)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {requests?.length === 0 && (
          <p className="p-4 text-sm text-dim">{filtered ? "No requests match these filters." : "No AI requests yet."}</p>
        )}
      </div>

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-4 text-sm">
          {page > 1 ? <Link href={href({ page: page - 1 })} className="btn">Previous</Link> : <span />}
          <span className="text-dim">Page {page} of {pages}</span>
          {page < pages ? <Link href={href({ page: page + 1 })} className="btn">Next</Link> : <span />}
        </nav>
      )}
    </main>
  );
}
