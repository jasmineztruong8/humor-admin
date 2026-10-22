import Link from "next/link";
import Image from "next/image";
import { requireAdmin } from "@/lib/auth";
import { displayName } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Media · Humor Admin" };

const PAGE_SIZE = 48;

type Row = {
  id: string;
  title: string | null;
  image_url: string;
  source: "upload" | "library";
  is_animated: boolean;
  created_at: string;
  profiles: { first_name: string | null; last_name: string | null } | null;
  captions: { count: number }[];
};

const FILTERS = [
  { value: "", label: "All" },
  { value: "upload", label: "Uploads" },
  { value: "library", label: "Meme library" },
];

// READ: every image, newest first, with who posted it and how many AI captions it has.
export default async function MediaPage({ searchParams }: PageProps<"/media">) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const source = params.source === "upload" || params.source === "library" ? params.source : "";
  const page = Math.max(1, Number(params.page) || 1);

  let query = supabase
    .from("images")
    .select("id, title, image_url, source, is_animated, created_at, profiles!images_user_id_fkey(first_name, last_name), captions(count)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (source) query = query.eq("source", source);
  const { data: images, count, error } = await query.returns<Row[]>();
  if (error) console.error("Loading images failed", error);

  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const href = (p: { source?: string; page?: number }) => {
    const q = new URLSearchParams();
    if (p.source) q.set("source", p.source);
    if (p.page && p.page > 1) q.set("page", String(p.page));
    return `/media${q.size ? `?${q}` : ""}`;
  };

  return (
    <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">AI-generated media</h1>
          <p className="text-dim">{count ?? 0} images. Open one to edit it, delete it, or manage its captions.</p>
        </div>
        <Link href="/media/new" className="btn btn-primary">New image</Link>
      </div>

      <div className="flex gap-1 text-sm">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={href({ source: f.value })}
            aria-current={source === f.value ? "page" : undefined}
            className={`px-3 py-1.5 rounded-md ${source === f.value ? "bg-well font-medium" : "text-dim hover:text-ink"}`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {error && <p className="text-danger">The images didn&apos;t load. Please refresh the page.</p>}

      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {images?.map((img) => (
          <li key={img.id}>
            <Link href={`/media/${img.id}`} className="card block overflow-hidden hover:border-axis">
              <Image
                src={img.image_url}
                alt={img.title ?? ""}
                width={400}
                height={300}
                unoptimized={img.is_animated}
                className="w-full aspect-[4/3] object-cover bg-well"
              />
              <div className="p-3 text-sm">
                <p className="font-medium truncate">{img.title || "Untitled"}</p>
                <p className="text-muted text-xs truncate">
                  {img.source === "library" ? "Meme library" : displayName(img.profiles)} ·{" "}
                  {img.captions[0]?.count ?? 0} captions · {new Date(img.created_at).toLocaleDateString()}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-4 text-sm">
          {page > 1 ? <Link href={href({ source, page: page - 1 })} className="btn">Previous</Link> : <span />}
          <span className="text-dim">Page {page} of {pages}</span>
          {page < pages ? <Link href={href({ source, page: page + 1 })} className="btn">Next</Link> : <span />}
        </nav>
      )}
    </main>
  );
}
