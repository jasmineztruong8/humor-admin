import { requireAdmin } from "@/lib/auth";
import { createTerm, deleteTerm, updateTerm } from "@/app/config-actions";
import { ActionForm, EditableItem, Field } from "@/components/forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Terms · Humor Admin" };

type Term = { id: string; term: string; definition: string };

function TermFields({ t }: { t?: Term }) {
  return (
    <div className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3">
      <Field label="Term">
        <input name="term" defaultValue={t?.term} required maxLength={60} placeholder="Butler" className="field" />
      </Field>
      <Field label="Definition">
        <input name="definition" defaultValue={t?.definition} required maxLength={500} placeholder="The library where everyone pretends to study" className="field" />
      </Field>
    </div>
  );
}

// CREATE / READ / UPDATE / DELETE: campus slang the AI can use.
export default async function TermsPage() {
  const { supabase } = await requireAdmin();
  const { data: terms, error } = await supabase
    .from("terms")
    .select("id, term, definition")
    .order("term")
    .returns<Term[]>();
  if (error) console.error("Loading terms failed", error);

  return (
    <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Terms</h1>
        <p className="text-dim">
          Campus slang and in-jokes. Captions written by the &ldquo;with examples&rdquo; prompt chain get up to
          30 of these, so the AI sounds like it goes here.
        </p>
      </div>

      <section className="card p-5 flex flex-col gap-3">
        <h2 className="font-semibold">Add a term</h2>
        <ActionForm action={createTerm} submitLabel="Add term">
          <TermFields />
        </ActionForm>
      </section>

      {error && <p className="text-danger">The terms didn&apos;t load. Please refresh the page.</p>}

      <ul className="card divide-y divide-line">
        {terms?.map((t) => (
          <li key={t.id} className="p-4">
            <EditableItem
              action={updateTerm.bind(null, t.id)}
              deleteAction={deleteTerm.bind(null, t.id)}
              deleteText={`Delete “${t.term}”?`}
              view={
                <p>
                  <span className="font-medium">{t.term}</span>
                  <span className="text-dim"> · {t.definition}</span>
                </p>
              }
            >
              <TermFields t={t} />
            </EditableItem>
          </li>
        ))}
        {terms?.length === 0 && <li className="p-4 text-sm text-dim">No terms yet.</li>}
      </ul>
    </main>
  );
}
