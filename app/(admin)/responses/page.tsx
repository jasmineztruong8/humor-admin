import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { fetchSince } from "@/lib/data";
import { daysAgo, modelHealth, type ResponseRow } from "@/lib/stats";
import { ChartCard } from "@/components/charts";
import { RESPONSE_STATUS, StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "LLM responses · Humor Admin" };

const PAGE_SIZE = 50;
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/;

type Row = {
  id: string;
  request_id: string;
  attempt: number;
  model: string;
  output: string | null;
  status: string;
  http_status: number | null;
  error: string | null;
  latency_ms: number;
  created_at: string;
  generation_requests: { kind: "describe" | "caption" } | null;
};

// READ only: every model call, newest first, plus how each model is doing.
export default async function ResponsesPage({ searchParams }: PageProps<"/responses">) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const status = Object.hasOwn(RESPONSE_STATUS, String(params.status)) ? String(params.status) : "";
  const model = MODEL_ID.test(String(params.model ?? "")) ? String(params.model) : "";
  const page = Math.max(1, Number(params.page) || 1);

  let query = supabase
    .from("llm_responses")
    .select("id, request_id, attempt, model, output, status, http_status, error, latency_ms, created_at, generation_requests(kind)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .order("attempt", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  if (model) query = query.eq("model", model);

  const since = daysAgo(7);
  const [{ data: responses, count, error }, recent] = await Promise.all([
    query.returns<Row[]>(),
    fetchSince<ResponseRow>(supabase, "llm_responses", "model, status, latency_ms", since).catch((e) => {
      console.error(e);
      return null;
    }),
  ]);
  if (error) console.error("Loading llm responses failed", error);

  const health = recent ? modelHealth(recent) : [];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const href = (p: { status?: string; model?: string; page?: number }) => {
    const q = new URLSearchParams();
    const next = { status, model, ...p };
    if (next.status) q.set("status", next.status);
    if (next.model) q.set("model", next.model);
    if (p.page && p.page > 1) q.set("page", String(p.page));
    return `/responses${q.size ? `?${q}` : ""}`;
  };

  return (
    <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">LLM responses</h1>
        <p className="text-dim">
          Every call to a model. One request can make several when a model is busy or out of free requests and
          the AI falls back to the next one. Read-only.
        </p>
      </div>

      {recent && (
        <ChartCard title="Model health" subtitle="Last 7 days. Click a model to see its responses">
          {health.length === 0 ? (
            <p className="text-sm text-dim">No model calls in the last week.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th className="num">Calls</th>
                    <th className="num">Answered</th>
                    <th className="num">Out of quota</th>
                    <th className="num">Busy / timed out</th>
                    <th className="num">Median answer time</th>
                  </tr>
                </thead>
                <tbody>
                  {health.map((h) => (
                    <tr key={h.model}>
                      <td className="font-mono text-xs">
                        <Link href={href({ model: h.model, page: 1 })} className="hover:underline">{h.model}</Link>
                      </td>
                      <td className="num">{h.attempts}</td>
                      <td className="num">{Math.round((h.ok / h.attempts) * 100)}%</td>
                      <td className="num">{h.quota}</td>
                      <td className="num">{h.busy}</td>
                      <td className="num">{h.medianMs === null ? "—" : `${(h.medianMs / 1000).toFixed(1)}s`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>
      )}

      <form className="flex flex-wrap gap-2 items-center">
        <select name="status" defaultValue={status} className="field w-auto">
          <option value="">Any result</option>
          {Object.entries(RESPONSE_STATUS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <input name="model" defaultValue={model} placeholder="Model ID" maxLength={100} className="field max-w-xs font-mono" />
        <button className="btn">Apply</button>
        {(status || model) && <Link href="/responses" className="text-sm text-dim hover:text-ink">Clear filters</Link>}
      </form>

      {error && <p className="text-danger">The responses didn&apos;t load. Please refresh the page.</p>}

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Model</th>
              <th>Result</th>
              <th>Step</th>
              <th>Answer</th>
              <th className="num">Time</th>
            </tr>
          </thead>
          <tbody>
            {responses?.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap">
                  <Link href={`/requests/${r.request_id}`} className="hover:underline">{new Date(r.created_at).toLocaleString()}</Link>
                </td>
                <td className="font-mono text-xs whitespace-nowrap">{r.model}</td>
                <td>
                  <StatusBadge ok={r.status === "ok"} label={`${RESPONSE_STATUS[r.status] ?? r.status}${r.http_status && r.status !== "ok" ? ` (${r.http_status})` : ""}`} />
                </td>
                <td className="whitespace-nowrap text-dim">
                  {r.generation_requests?.kind === "describe" ? "Describe" : "Caption"} #{r.attempt}
                </td>
                <td className="min-w-64 max-w-md">
                  <p className="line-clamp-2 break-words">{r.output ?? <span className="text-danger text-xs">{r.error}</span>}</p>
                </td>
                <td className="num">{(r.latency_ms / 1000).toFixed(1)}s</td>
              </tr>
            ))}
          </tbody>
        </table>
        {responses?.length === 0 && (
          <p className="p-4 text-sm text-dim">{status || model ? "No responses match these filters." : "No model calls yet."}</p>
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
