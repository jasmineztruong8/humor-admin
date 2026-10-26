import { requireAdmin } from "@/lib/auth";
import { MAX_CAPTION_LENGTH } from "@/lib/prompts";
import { createExample, deleteExample, updateExample } from "@/app/config-actions";
import { ActionForm, EditableItem, Field } from "@/components/forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI examples · Humor Admin" };

type Example = { id: string; image_description: string; caption: string; is_active: boolean };

function ExampleFields({ e }: { e?: Example }) {
  return (
    <div className="flex flex-col gap-3">
      <Field label="Image description" hint="What the AI would see, in the style of an image description.">
        <textarea name="image_description" defaultValue={e?.image_description} required maxLength={2000} rows={3} className="field" />
      </Field>
      <Field label="Caption">
        <input name="caption" defaultValue={e?.caption} required maxLength={MAX_CAPTION_LENGTH} className="field" />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input name="is_active" type="checkbox" defaultChecked={e?.is_active ?? true} />
        Active (shown to the AI)
      </label>
    </div>
  );
}

// CREATE / READ / UPDATE / DELETE: few-shot examples for the caption AI.
export default async function ExamplesPage() {
  const { supabase } = await requireAdmin();
  const { data: examples, error } = await supabase
    .from("generation_examples")
    .select("id, image_description, caption, is_active")
    .order("created_at", { ascending: false })
    .returns<Example[]>();
  if (error) console.error("Loading examples failed", error);

  return (
    <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">AI generation examples</h1>
        <p className="text-dim">
          Image descriptions paired with captions people loved. The &ldquo;with examples&rdquo; prompt chain shows
          the AI up to 5 active ones at random, to match their tone.
        </p>
      </div>

      <section className="card p-5 flex flex-col gap-3">
        <h2 className="font-semibold">Add an example</h2>
        <ActionForm action={createExample} submitLabel="Add example">
          <ExampleFields />
        </ActionForm>
      </section>

      {error && <p className="text-danger">The examples didn&apos;t load. Please refresh the page.</p>}

      <ul className="card divide-y divide-line">
        {examples?.map((e) => (
          <li key={e.id} className="p-4">
            <EditableItem
              action={updateExample.bind(null, e.id)}
              deleteAction={deleteExample.bind(null, e.id)}
              deleteText="Delete this example?"
              view={
                <div className="flex flex-col gap-1">
                  <p>
                    &ldquo;{e.caption}&rdquo;
                    {!e.is_active && <span className="ml-2 text-xs text-muted">inactive</span>}
                  </p>
                  <p className="text-sm text-dim">{e.image_description}</p>
                </div>
              }
            >
              <ExampleFields e={e} />
            </EditableItem>
          </li>
        ))}
        {examples?.length === 0 && <li className="p-4 text-sm text-dim">No examples yet.</li>}
      </ul>
    </main>
  );
}
