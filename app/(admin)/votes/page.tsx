import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { displayName } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Votes · Humor Admin" };

const PAGE_SIZE = 100;

type Name = { first_name: string | null; last_name: string | null } | null;

type Row = {
  user_id: string;
  value: number;
  created_at: string;
  profiles: Name;
  captions: { id: string; image_id: string; content: string; score: number; profiles: Name } | null;
};

const FILTERS = [
  { value: "", label: "All" },
  { value: "up", label: "Upvotes" },
  { value: "down", label: "Downvotes" },
];

// READ only: every vote, newest first. Only superadmins can see other
// people's votes (RLS policy "Superadmins can read all votes").
export default async function VotesPage({ searchParams }: PageProps<"/votes">) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const filter = params.value === "up" || params.value === "down" ? params.value : "";
  const page = Math.max(1, Number(params.page) || 1);

  let query = supabase
    .from("caption_votes")
    .select("user_id, value, created_at, profiles(first_name, last_name), captions(id, image_id, content, score, profiles(first_name, last_name))", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (filter) query = query.eq("value", filter === "up" ? 1 : -1);

  const [{ data: votes, count, error }, { count: upCount }, { count: total }] = await Promise.all([
    query.returns<Row[]>(),
    supabase.from("caption_votes").select("*", { count: "exact", head: true }).eq("value", 1),
    supabase.from("caption_votes").select("*", { count: "exact", head: true }),
  ]);
  if (error) console.error("Loading votes failed", error);

  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const href = (p: { value?: string; page?: number }) => {
    const q = new URLSearchParams();
    if (p.value) q.set("value", p.value);
    if (p.page && p.page > 1) q.set("page", String(p.page));
    return `/votes${q.size ? `?${q}` : ""}`;
  };

  return (
    <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Votes</h1>
        <p className="text-dim">
          {total ?? 0} votes: {upCount ?? 0} up, {(total ?? 0) - (upCount ?? 0)} down. Read-only.
        </p>
      </div>

      <div className="flex gap-1 text-sm">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={href({ value: f.value })}
            aria-current={filter === f.value ? "page" : undefined}
            className={`px-3 py-1.5 rounded-md ${filter === f.value ? "bg-well font-medium" : "text-dim hover:text-ink"}`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {error && <p className="text-danger">The votes didn&apos;t load. Please refresh the page.</p>}

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Voter</th>
              <th>Vote</th>
              <th>Caption</th>
              <th>Caption by</th>
              <th className="num">Caption score</th>
            </tr>
          </thead>
          <tbody>
            {votes?.map((v) => (
              <tr key={`${v.user_id}-${v.captions?.id}`}>
                <td className="whitespace-nowrap text-dim">{new Date(v.created_at).toLocaleString()}</td>
                <td className="whitespace-nowrap">{displayName(v.profiles)}</td>
                <td className="whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`size-2.5 rounded-sm ${v.value > 0 ? "bg-up" : "bg-down"}`} />
                    {v.value > 0 ? "Up" : "Down"}
                  </span>
                </td>
                <td className="min-w-64">
                  {v.captions ? (
                    <Link href={`/media/${v.captions.image_id}`} className="hover:underline">
                      &ldquo;{v.captions.content}&rdquo;
                    </Link>
                  ) : (
                    <span className="text-muted">(deleted)</span>
                  )}
                </td>
                <td className="whitespace-nowrap">{displayName(v.captions?.profiles)}</td>
                <td className="num">{v.captions?.score ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {votes?.length === 0 && <p className="p-4 text-sm text-dim">No votes yet.</p>}
      </div>

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-4 text-sm">
          {page > 1 ? <Link href={href({ value: filter, page: page - 1 })} className="btn">Previous</Link> : <span />}
          <span className="text-dim">Page {page} of {pages}</span>
          {page < pages ? <Link href={href({ value: filter, page: page + 1 })} className="btn">Next</Link> : <span />}
        </nav>
      )}
    </main>
  );
}
