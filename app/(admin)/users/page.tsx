import { requireAdmin } from "@/lib/auth";
import { displayName, loadEverything } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users · Humor Admin" };

const SORTS = {
  joined: "Newest",
  score: "Funniest",
  captions: "Most captions",
  votes: "Most votes cast",
} as const;
type Sort = keyof typeof SORTS;

// READ only: every profile with what they've made and how they vote.
export default async function UsersPage({ searchParams }: PageProps<"/users">) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const q = String(params.q ?? "").trim().toLowerCase();
  const sort: Sort = String(params.sort) in SORTS ? (params.sort as Sort) : "joined";

  const [profiles, images, captions, votes] = await loadEverything(supabase);

  const stats = new Map(profiles.map((p) => [p.id, { images: 0, captions: 0, score: 0, up: 0, down: 0 }]));
  // Rows load in parallel, so skip any whose author was deleted in between
  for (const i of images) {
    const s = i.user_id ? stats.get(i.user_id) : undefined;
    if (s) s.images++;
  }
  for (const c of captions) {
    const s = stats.get(c.user_id);
    if (s) {
      s.captions++;
      s.score += c.score;
    }
  }
  for (const v of votes) {
    const s = stats.get(v.user_id);
    if (s) s[v.value > 0 ? "up" : "down"]++;
  }

  const rows = profiles
    .map((p) => ({ ...p, name: displayName(p), ...stats.get(p.id)! }))
    .filter((p) => !q || p.name.toLowerCase().includes(q))
    .sort((a, b) => {
      if (sort === "score") return b.score - a.score;
      if (sort === "captions") return b.captions - a.captions;
      if (sort === "votes") return b.up + b.down - (a.up + a.down);
      return b.created_at.localeCompare(a.created_at);
    });

  return (
    <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-dim">{profiles.length} profiles. Read-only: accounts are managed on The Humor Project.</p>
      </div>

      <form className="flex flex-wrap gap-2 items-center">
        <input name="q" defaultValue={q} placeholder="Search by name" className="field max-w-xs" />
        <select name="sort" defaultValue={sort} className="field w-auto">
          {Object.entries(SORTS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <button className="btn">Apply</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Joined</th>
              <th className="num">Images</th>
              <th className="num">Captions</th>
              <th className="num">Caption score</th>
              <th className="num">Votes cast</th>
              <th className="num">Upvote rate</th>
              <th>ID</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td className="whitespace-nowrap">
                  {u.name}
                  {u.is_superadmin && <span className="ml-2 text-xs text-accent font-medium">superadmin</span>}
                </td>
                <td className="whitespace-nowrap text-dim">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="num">{u.images}</td>
                <td className="num">{u.captions}</td>
                <td className="num">{u.score}</td>
                <td className="num">{u.up + u.down}</td>
                <td className="num">{u.up + u.down ? `${Math.round((u.up / (u.up + u.down)) * 100)}%` : "—"}</td>
                <td className="font-mono text-xs text-muted">{u.id.slice(0, 8)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-4 text-sm text-dim">No one matches that search.</p>}
      </div>
    </main>
  );
}
