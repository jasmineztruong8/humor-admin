import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { displayName } from "@/lib/data";
import { RESPONSE_STATUS, StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Generation request · Humor Admin" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Request = {
  id: string;
  app: "site" | "admin";
  kind: "describe" | "caption";
  steer: string | null;
  status: "succeeded" | "failed";
  error: string | null;
  duration_ms: number;
  created_at: string;
  profiles: { first_name: string | null; last_name: string | null } | null;
  prompt_chains: { id: string; name: string } | null;
  images: { id: string; title: string | null } | null;
};

type Response = {
  id: string;
  attempt: number;
  model: string;
  prompt: string;
  output: string | null;
  status: string;
  http_status: number | null;
  error: string | null;
  latency_ms: number;
  llm_models: { name: string } | null;
};

// READ one AI request and every model call it made.
export default async function RequestPage({ params }: PageProps<"/requests/[id]">) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const [{ data: request }, { data: responses, error }] = await Promise.all([
    supabase
      .from("generation_requests")
      .select("id, app, kind, steer, status, error, duration_ms, created_at, profiles(first_name, last_name), prompt_chains(id, name), images(id, title)")
      .eq("id", id)
      .maybeSingle<Request>(),
    supabase
      .from("llm_responses")
      .select("id, attempt, model, prompt, output, status, http_status, error, latency_ms, llm_models(name)")
      .eq("request_id", id)
      .order("attempt")
      .returns<Response[]>(),
  ]);
  if (!request) notFound();
  if (error) console.error("Loading llm responses failed", error);

  const prompt = responses?.[0]?.prompt;

  return (
    <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 flex flex-col gap-6">
      <Link href="/requests" className="text-sm text-dim hover:text-ink">← All requests</Link>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">
          {request.kind === "describe" ? "Describe an image" : "Write a caption"}
        </h1>
        <StatusBadge ok={request.status === "succeeded"} label={request.status === "succeeded" ? "Succeeded" : "Failed"} />
      </div>

      <dl className="card p-5 text-sm grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
        <dt className="text-muted">When</dt>
        <dd>{new Date(request.created_at).toLocaleString()}</dd>
        <dt className="text-muted">By</dt>
        <dd>{displayName(request.profiles)} on the {request.app === "admin" ? "admin panel" : "caption site"}</dd>
        <dt className="text-muted">Prompt chain</dt>
        <dd>
          {request.prompt_chains ? (
            <Link href="/chains" className="hover:underline">{request.prompt_chains.name}</Link>
          ) : (
            "—"
          )}
        </dd>
        <dt className="text-muted">Image</dt>
        <dd>
          {request.images ? (
            <Link href={`/media/${request.images.id}`} className="hover:underline">{request.images.title || "Untitled"}</Link>
          ) : (
            <span className="text-dim">Not posted (a draft, or the image was deleted)</span>
          )}
        </dd>
        <dt className="text-muted">Topic</dt>
        <dd>{request.steer ? <>&ldquo;{request.steer}&rdquo;</> : <span className="text-dim">None</span>}</dd>
        <dt className="text-muted">Total time</dt>
        <dd>{(request.duration_ms / 1000).toFixed(1)}s</dd>
        {request.error && (
          <>
            <dt className="text-muted">Error</dt>
            <dd className="text-danger break-words">{request.error}</dd>
          </>
        )}
      </dl>

      {prompt && (
        <details className="card p-5 text-sm">
          <summary className="cursor-pointer font-medium">Prompt sent</summary>
          <pre className="mt-3 p-3 rounded-lg bg-well whitespace-pre-wrap break-words text-xs">{prompt}</pre>
        </details>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">LLM responses</h2>
        {error && <p className="text-danger">The responses didn&apos;t load. Please refresh the page.</p>}
        {responses?.length === 0 && <p className="text-sm text-dim">No model was called (for example, every model was out of quota).</p>}
        <ol className="flex flex-col gap-3">
          {responses?.map((r) => (
            <li key={r.id} className="card p-4 flex flex-col gap-2 text-sm">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-medium">#{r.attempt}</span>
                <span className="font-mono text-xs">{r.model}</span>
                {r.llm_models && <span className="text-dim">{r.llm_models.name}</span>}
                <StatusBadge ok={r.status === "ok"} label={RESPONSE_STATUS[r.status] ?? r.status} />
                {r.http_status && <span className="text-muted">HTTP {r.http_status}</span>}
                <span className="ml-auto text-dim tabular-nums">{(r.latency_ms / 1000).toFixed(2)}s</span>
              </div>
              {r.output !== null && (
                <pre className="p-3 rounded-lg bg-well whitespace-pre-wrap break-words text-xs">{r.output || "(empty answer)"}</pre>
              )}
              {r.error && <p className="text-danger text-xs break-words">{r.error}</p>}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
