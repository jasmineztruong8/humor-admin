import { requireAdmin } from "@/lib/auth";
import { createProvider, deleteProvider, updateProvider } from "@/app/config-actions";
import { ActionForm, EditableItem, Field } from "@/components/forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "LLM providers · Humor Admin" };

type Provider = {
  id: string;
  slug: string;
  name: string;
  website: string | null;
  created_at: string;
  llm_models: { count: number }[];
};

function ProviderFields({ p }: { p?: Provider }) {
  return (
    <div className="grid sm:grid-cols-3 gap-3">
      <Field label="Name">
        <input name="name" defaultValue={p?.name} required maxLength={80} placeholder="Google" className="field" />
      </Field>
      <Field label="Key">
        <input name="slug" defaultValue={p?.slug} required maxLength={40} placeholder="google" className="field font-mono" />
      </Field>
      <Field label="Website (optional)">
        <input name="website" type="url" defaultValue={p?.website ?? ""} maxLength={300} placeholder="https://…" className="field" />
      </Field>
    </div>
  );
}

// CREATE / READ / UPDATE / DELETE: companies whose models can write captions.
export default async function ProvidersPage() {
  const { supabase } = await requireAdmin();
  const { data: providers, error } = await supabase
    .from("llm_providers")
    .select("id, slug, name, website, created_at, llm_models(count)")
    .order("name")
    .returns<Provider[]>();
  if (error) console.error("Loading providers failed", error);

  return (
    <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">LLM providers</h1>
        <p className="text-dim">
          The companies behind the models. The caption AI can only call models from the provider with the
          key <code className="font-mono">google</code> (Gemini); others are kept for reference.
        </p>
      </div>

      <section className="card p-5 flex flex-col gap-3">
        <h2 className="font-semibold">Add a provider</h2>
        <ActionForm action={createProvider} submitLabel="Add provider">
          <ProviderFields />
        </ActionForm>
      </section>

      {error && <p className="text-danger">The providers didn&apos;t load. Please refresh the page.</p>}

      <ul className="card divide-y divide-line">
        {providers?.map((p) => (
          <li key={p.id} className="p-4">
            <EditableItem
              action={updateProvider.bind(null, p.id)}
              deleteAction={deleteProvider.bind(null, p.id)}
              deleteText={`Delete ${p.name}? Providers that still have models can't be deleted.`}
              view={
                <div className="flex flex-col gap-0.5">
                  <p className="font-medium">
                    {p.name} <span className="font-mono text-xs text-muted">{p.slug}</span>
                  </p>
                  <p className="text-sm text-dim">
                    {p.llm_models[0]?.count ?? 0} models
                    {p.website && (
                      <>
                        {" · "}
                        <a href={p.website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {p.website.replace(/^https:\/\//, "")}
                        </a>
                      </>
                    )}
                  </p>
                </div>
              }
            >
              <ProviderFields p={p} />
            </EditableItem>
          </li>
        ))}
        {providers?.length === 0 && <li className="p-4 text-sm text-dim">No providers yet.</li>}
      </ul>
    </main>
  );
}
