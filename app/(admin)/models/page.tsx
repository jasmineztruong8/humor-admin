import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createModel, deleteModel, updateModel } from "@/app/config-actions";
import { ActionForm, EditableItem, Field } from "@/components/forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "LLM models · Humor Admin" };

type Model = {
  id: string;
  provider_id: string;
  model_id: string;
  name: string;
  is_active: boolean;
  priority: number;
  llm_providers: { name: string; slug: string } | null;
};

type Provider = { id: string; name: string };

function ModelFields({ m, providers }: { m?: Model; providers: Provider[] }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <Field label="Name">
        <input name="name" defaultValue={m?.name} required maxLength={80} placeholder="Gemini 3 Flash" className="field" />
      </Field>
      <Field label="Model ID" hint="Exactly as the provider's API spells it.">
        <input name="model_id" defaultValue={m?.model_id} required maxLength={100} placeholder="gemini-3-flash-preview" className="field font-mono" />
      </Field>
      <Field label="Provider">
        <select name="provider_id" defaultValue={m?.provider_id ?? providers[0]?.id} required className="field">
          {providers.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Priority" hint="Lower is tried first.">
        <input name="priority" type="number" min={0} max={1000} step={1} defaultValue={m?.priority ?? 100} required className="field" />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input name="is_active" type="checkbox" defaultChecked={m?.is_active ?? true} />
        Active (the caption AI may use it)
      </label>
    </div>
  );
}

// CREATE / READ / UPDATE / DELETE: the models the caption AI tries, in order.
export default async function ModelsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: models, error }, { data: providers }] = await Promise.all([
    supabase
      .from("llm_models")
      .select("id, provider_id, model_id, name, is_active, priority, llm_providers(name, slug)")
      .order("priority")
      .order("created_at")
      .returns<Model[]>(),
    supabase.from("llm_providers").select("id, name").order("name").returns<Provider[]>(),
  ]);
  if (error) console.error("Loading models failed", error);

  const inUse = models?.filter((m) => m.is_active && m.llm_providers?.slug === "google") ?? [];

  return (
    <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">LLM models</h1>
        <p className="text-dim">
          The caption AI tries active Google models from the lowest priority number up, moving on when one is
          busy or out of free requests. Changes reach the live site within a minute.
        </p>
      </div>

      <p className="card p-4 text-sm">
        {inUse.length ? (
          <>
            <span className="font-medium">Order in use now:</span>{" "}
            <span className="font-mono text-xs">{inUse.map((m) => m.model_id).join(" → ")}</span>
          </>
        ) : (
          <span className="text-danger">
            No active Google models, so the site is using its built-in list. Activate one to take control.
          </span>
        )}
      </p>

      <section className="card p-5 flex flex-col gap-3">
        <h2 className="font-semibold">Add a model</h2>
        {providers?.length ? (
          <ActionForm action={createModel} submitLabel="Add model">
            <ModelFields providers={providers} />
          </ActionForm>
        ) : (
          <p className="text-sm text-dim">
            <Link href="/providers" className="underline">Add a provider</Link> first.
          </p>
        )}
      </section>

      {error && <p className="text-danger">The models didn&apos;t load. Please refresh the page.</p>}

      <ul className="card divide-y divide-line">
        {models?.map((m) => (
          <li key={m.id} className="p-4">
            <EditableItem
              action={updateModel.bind(null, m.id)}
              deleteAction={deleteModel.bind(null, m.id)}
              deleteText={`Delete ${m.name}? Past responses keep the model's name.`}
              view={
                <div className="flex flex-col gap-0.5">
                  <p className="font-medium">
                    {m.name}
                    {!m.is_active && <span className="ml-2 text-xs text-muted">inactive</span>}
                  </p>
                  <p className="text-sm text-dim">
                    <span className="font-mono text-xs">{m.model_id}</span> · {m.llm_providers?.name ?? "—"} · priority{" "}
                    {m.priority} ·{" "}
                    <Link href={`/responses?model=${encodeURIComponent(m.model_id)}`} className="hover:underline">
                      responses
                    </Link>
                  </p>
                </div>
              }
            >
              <ModelFields m={m} providers={providers ?? []} />
            </EditableItem>
          </li>
        ))}
        {models?.length === 0 && <li className="p-4 text-sm text-dim">No models yet.</li>}
      </ul>
    </main>
  );
}
