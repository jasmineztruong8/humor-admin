import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { displayName } from "@/lib/data";
import { MAX_STEER_LENGTH } from "@/lib/prompts";
import { deleteCaption, deleteImage, generateCaption, updateCaption, updateImage } from "@/app/actions";
import { ActionForm, DeleteButton, EditableCaption } from "@/components/forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Image · Humor Admin" };

type Name = { first_name: string | null; last_name: string | null } | null;

type ImageDetail = {
  id: string;
  title: string | null;
  image_url: string;
  source: "upload" | "library";
  attribution: string | null;
  description: string;
  description_model: string;
  is_animated: boolean;
  created_at: string;
  profiles: Name;
};

type CaptionDetail = {
  id: string;
  content: string;
  user_prompt: string | null;
  model: string;
  score: number;
  created_at: string;
  profiles: Name;
  caption_votes: { value: number }[];
};

// READ one image with all its captions; UPDATE and DELETE both.
export default async function ImagePage({ params }: PageProps<"/media/[id]">) {
  const { supabase } = await requireAdmin();
  const { id } = await params;

  const [{ data: image }, { data: captions }] = await Promise.all([
    supabase
      .from("images")
      .select("id, title, image_url, source, attribution, description, description_model, is_animated, created_at, profiles!images_user_id_fkey(first_name, last_name)")
      .eq("id", id)
      .maybeSingle<ImageDetail>(),
    supabase
      .from("captions")
      .select("id, content, user_prompt, model, score, created_at, profiles(first_name, last_name), caption_votes(value)")
      .eq("image_id", id)
      .order("score", { ascending: false })
      .order("created_at", { ascending: false })
      .returns<CaptionDetail[]>(),
  ]);
  if (!image) notFound();

  return (
    <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 flex flex-col gap-6">
      <Link href="/media" className="text-sm text-dim hover:text-ink">← All media</Link>

      <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6 items-start">
        <div className="flex flex-col gap-3">
          <Image
            src={image.image_url}
            alt={image.title ?? ""}
            width={800}
            height={800}
            unoptimized={image.is_animated}
            className="w-full rounded-xl bg-well"
          />
          <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted">Posted by</dt>
            <dd>{image.source === "library" ? "Meme library" : displayName(image.profiles)}</dd>
            <dt className="text-muted">Added</dt>
            <dd>{new Date(image.created_at).toLocaleString()}</dd>
            <dt className="text-muted">Described by</dt>
            <dd className="font-mono text-xs pt-0.5">{image.description_model}</dd>
            {image.attribution && (
              <>
                <dt className="text-muted">Credit</dt>
                <dd>{image.attribution}</dd>
              </>
            )}
          </dl>
          <div>
            <DeleteButton
              action={deleteImage.bind(null, image.id)}
              confirmText="Delete this image, all its captions and their votes? This can't be undone."
              label="Delete image"
            />
          </div>
        </div>

        <section className="card p-5 flex flex-col gap-3">
          <h1 className="text-xl font-semibold">Edit image</h1>
          <ActionForm action={updateImage.bind(null, image.id)} submitLabel="Save changes">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Title</span>
              <input name="title" defaultValue={image.title ?? ""} maxLength={120} className="field" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">AI description</span>
              <span className="text-muted">New captions are written from this, so fixing it fixes future captions.</span>
              <textarea name="description" defaultValue={image.description} rows={7} maxLength={2000} required className="field" />
            </label>
          </ActionForm>
        </section>
      </div>

      <section className="card p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Captions</h2>
            <p className="text-sm text-dim">{captions?.length ?? 0} AI captions, best first.</p>
          </div>
        </div>

        <ActionForm
          action={generateCaption.bind(null, image.id)}
          submitLabel="Generate AI caption"
          pendingLabel="Writing…"
          className="sm:flex-row sm:items-start"
        >
          <input
            name="steer"
            maxLength={MAX_STEER_LENGTH}
            placeholder="Optional topic, e.g. dining hall food"
            className="field sm:max-w-sm"
          />
        </ActionForm>

        <ul className="flex flex-col divide-y divide-line">
          {captions?.map((c) => {
            const up = c.caption_votes.filter((v) => v.value > 0).length;
            const down = c.caption_votes.length - up;
            return (
              <li key={c.id} className="py-4 flex flex-col gap-2">
                <EditableCaption content={c.content} action={updateCaption.bind(null, c.id)} />
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                  <span className="text-ink font-semibold text-sm tabular-nums">{c.score > 0 ? `+${c.score}` : c.score}</span>
                  <span>{up} up · {down} down</span>
                  <span>{displayName(c.profiles)}</span>
                  {c.user_prompt && <span>topic: &ldquo;{c.user_prompt}&rdquo;</span>}
                  <span className="font-mono">{c.model}</span>
                  <span>{new Date(c.created_at).toLocaleString()}</span>
                  <span className="ml-auto">
                    <DeleteButton
                      action={deleteCaption.bind(null, c.id)}
                      confirmText="Delete this caption and its votes?"
                      label="Delete"
                    />
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
