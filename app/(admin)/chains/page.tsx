import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { displayName } from "@/lib/data";
import { daysAgo } from "@/lib/stats";
import { updateMix } from "@/app/config-actions";
import { ActionForm } from "@/components/forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Prompt chains · Humor Admin" };

type Step = {
  id: string;
  step_order: number;
  name: string;
  kind: "describe" | "caption";
  system_instruction: string | null;
  prompt_template: string;
};

type Mix = {
  weight: number;
  updated_at: string;
  profiles: { first_name: string | null; last_name: string | null } | null;
};

type Chain = {
  id: string;
  slug: string;
  name: string;
  description: string;
  prompt_chain_steps: Step[];
  // One row per chain (chain_id is the key), but accept a list too
  prompt_chain_mix: Mix | Mix[] | null;
};

// READ prompt chains and their steps; READ / UPDATE the mix between them.
// Chains themselves are code (lib/prompts.ts), so they can't be edited here.
export default async function ChainsPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("prompt_chains")
    .select(
      "id, slug, name, description, prompt_chain_steps(id, step_order, name, kind, system_instruction, prompt_template), prompt_chain_mix(weight, updated_at, profiles(first_name, last_name))",
    )
    .order("created_at")
    .returns<Chain[]>();
  if (error) console.error("Loading prompt chains failed", error);
  const chains = data?.map((c) => ({
    ...c,
    prompt_chain_mix: (Array.isArray(c.prompt_chain_mix) ? c.prompt_chain_mix[0] : c.prompt_chain_mix) ?? null,
  }));

  // How each chain's caption requests went over the last week
  const since = daysAgo(7);
  const stats = await Promise.all(
    (chains ?? []).map(async (c) => {
      const [total, failed] = await Promise.all([
        supabase.from("generation_requests").select("id", { count: "exact", head: true }).eq("chain_id", c.id).gte("created_at", since),
        supabase.from("generation_requests").select("id", { count: "exact", head: true }).eq("chain_id", c.id).eq("status", "failed").gte("created_at", since),
      ]);
      return { total: total.count ?? 0, failed: failed.count ?? 0 };
    }),
  );

  const totalWeight = chains?.reduce((sum, c) => sum + (c.prompt_chain_mix?.weight ?? 0), 0) ?? 0;
  const lastChange = chains
    ?.map((c) => c.prompt_chain_mix)
    .filter((m) => m !== null)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];

  return (
    <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Prompt chains</h1>
        <p className="text-dim">
          Each chain is the series of AI steps that turns a photo into a caption. The description step runs once
          per image; the caption step runs for every caption, using a chain picked at random by the mix.
        </p>
      </div>

      {error && <p className="text-danger">The prompt chains didn&apos;t load. Please refresh the page.</p>}

      {chains && chains.length > 0 && (
        <section className="card p-5 flex flex-col gap-3">
          <div>
            <h2 className="font-semibold">Chain mix</h2>
            <p className="text-sm text-dim">
              Relative weights from 0 to 100: a chain&apos;s share of new captions is its weight divided by the total.
              {lastChange && (
                <> Last changed {new Date(lastChange.updated_at).toLocaleString()}
                  {lastChange.profiles && <> by {displayName(lastChange.profiles)}</>}.</>
              )}
            </p>
          </div>
          <ActionForm action={updateMix} submitLabel="Save mix">
            <div className="flex flex-col gap-2">
              {chains.map((c) => {
                const weight = c.prompt_chain_mix?.weight ?? 0;
                return (
                  <label key={c.id} className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="w-64 max-w-full">{c.name}</span>
                    <input
                      name={`weight:${c.id}`}
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      required
                      defaultValue={weight}
                      disabled={!c.prompt_chain_mix}
                      className="field w-24"
                    />
                    <span className="text-dim tabular-nums">
                      {totalWeight ? `${Math.round((weight / totalWeight) * 100)}% of captions now` : "—"}
                    </span>
                  </label>
                );
              })}
            </div>
          </ActionForm>
        </section>
      )}

      {chains?.map((c, i) => (
        <section key={c.id} className="card p-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">{c.name}</h2>
              <p className="text-sm text-dim">{c.description}</p>
              <p className="text-xs text-muted font-mono mt-1">{c.slug}</p>
            </div>
            <Link href={`/requests?chain=${c.id}`} className="text-sm text-right hover:underline">
              {stats[i].total} caption requests this week
              <br />
              <span className="text-dim">
                {stats[i].total ? `${Math.round(((stats[i].total - stats[i].failed) / stats[i].total) * 100)}% succeeded` : "—"}
              </span>
            </Link>
          </div>
          <ol className="flex flex-col gap-4">
            {[...c.prompt_chain_steps].sort((a, b) => a.step_order - b.step_order).map((s) => (
              <li key={s.id} className="flex flex-col gap-2">
                <p className="font-medium">
                  Step {s.step_order}: {s.name} <span className="text-xs text-muted font-normal">({s.kind})</span>
                </p>
                {s.system_instruction && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-dim">System instruction</summary>
                    <pre className="mt-2 p-3 rounded-lg bg-well whitespace-pre-wrap text-xs">{s.system_instruction}</pre>
                  </details>
                )}
                <details className="text-sm" open={s.kind === "describe" ? undefined : true}>
                  <summary className="cursor-pointer text-dim">Prompt</summary>
                  <pre className="mt-2 p-3 rounded-lg bg-well whitespace-pre-wrap text-xs">{s.prompt_template}</pre>
                </details>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </main>
  );
}
