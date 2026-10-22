import Link from "next/link";
import Image from "next/image";
import { requireAdmin } from "@/lib/auth";
import { displayName, loadEverything } from "@/lib/data";
import {
  bySource,
  byModel,
  engagement,
  funniestPeople,
  mostDivisive,
  perDay,
  perHour,
  steeredVsNot,
  tallyVotes,
  topCaptions,
} from "@/lib/stats";
import { BarList, ChartCard, Compare, DailyColumns, HourStrip, StatTile, VoteSplit } from "@/components/charts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stats · Humor Admin" };

const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "—");

export default async function StatsPage() {
  const { supabase } = await requireAdmin();
  const [profiles, images, captions, votes] = await loadEverything(supabase);

  const people = new Map(profiles.map((p) => [p.id, p]));
  const imageById = new Map(images.map((i) => [i.id, i]));
  const tallies = tallyVotes(votes);
  const upvotes = votes.filter((v) => v.value > 0).length;
  const steer = steeredVsNot(captions);
  const sources = bySource(images, captions);
  const reach = engagement(profiles, images, captions, votes);
  const divisive = mostDivisive(captions, tallies);
  const divisiveMax = Math.max(1, ...divisive.flatMap((d) => [d.up, d.down]));

  return (
    <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">What&apos;s funny on The Humor Project</h1>
        <p className="text-dim">Everything people have uploaded, captioned with AI, and voted on.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatTile label="Members" value={profiles.length} note={`${reach.lurkers} haven't done anything yet`} />
        <StatTile label="Images" value={images.length} note={`${sources.upload.images} uploaded · ${sources.library.images} memes`} />
        <StatTile label="AI captions" value={captions.length} note={`${(captions.length / Math.max(1, images.length)).toFixed(1)} per image`} />
        <StatTile label="Votes cast" value={votes.length} note={`${(votes.length / Math.max(1, captions.length)).toFixed(1)} per caption`} />
        <StatTile label="Upvoted" value={pct(upvotes, votes.length)} note={`${upvotes} up · ${votes.length - upvotes} down`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Captions per day" subtitle="Last 30 days">
          <DailyColumns data={perDay(captions.map((c) => c.created_at), 30)} unit="captions" />
        </ChartCard>
        <ChartCard title="Votes per day" subtitle="Last 30 days">
          <DailyColumns data={perDay(votes.map((v) => v.created_at), 30)} unit="votes" />
        </ChartCard>
      </div>

      <ChartCard
        title="When is everyone being funny?"
        subtitle="Captions and votes by hour of day, Eastern time, all time"
      >
        <HourStrip hours={perHour([...captions, ...votes].map((r) => r.created_at))} unit="captions + votes" />
      </ChartCard>

      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Hall of fame" subtitle="The highest-scoring captions">
          {topCaptions(captions).length === 0 && <p className="text-sm text-dim">No upvoted captions yet.</p>}
          <ol className="flex flex-col gap-3">
            {topCaptions(captions).map((c, i) => {
              const image = imageById.get(c.image_id);
              return (
                <li key={c.id} className="flex gap-3 items-start">
                  <span className="text-sm text-muted w-4 pt-0.5">{i + 1}</span>
                  {image && (
                    <Link href={`/media/${image.id}`} className="shrink-0">
                      <Image src={image.image_url} alt="" width={56} height={56} unoptimized={image.is_animated} className="size-14 rounded-md object-cover bg-well" />
                    </Link>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">&ldquo;{c.content}&rdquo;</p>
                    <p className="text-xs text-muted">{displayName(people.get(c.user_id))}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">+{c.score}</span>
                </li>
              );
            })}
          </ol>
        </ChartCard>

        <ChartCard title="Most divisive" subtitle="Captions that split the room: downvotes left, upvotes right">
          {divisive.length === 0 && <p className="text-sm text-dim">Nothing has split the room yet.</p>}
          <ol className="flex flex-col gap-4">
            {divisive.map((d) => (
              <li key={d.caption.id} className="flex flex-col gap-1.5">
                <Link href={`/media/${d.caption.image_id}`} className="text-sm hover:underline">
                  &ldquo;{d.caption.content}&rdquo;
                </Link>
                <VoteSplit up={d.up} down={d.down} max={divisiveMax} />
              </li>
            ))}
          </ol>
          {divisive.length > 0 && (
            <div className="flex gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-down" />Downvotes</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-up" />Upvotes</span>
            </div>
          )}
        </ChartCard>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <ChartCard title="Funniest people" subtitle="Total score across all their captions">
          <BarList
            unit="points"
            rows={funniestPeople(captions, profiles).map((p) => ({
              key: p.id,
              label: displayName(p.profile),
              value: p.score,
              note: `${p.captions} captions`,
            }))}
          />
        </ChartCard>

        <ChartCard title="Does steering the AI help?" subtitle="Average caption score, with and without a topic from the user">
          <Compare
            rows={[
              { label: "Gave the AI a topic", value: steer.steered.avgScore, note: `${steer.steered.count} captions` },
              { label: "Let the AI decide", value: steer.unsteered.avgScore, note: `${steer.unsteered.count} captions` },
            ]}
          />
          <p className="text-sm text-dim">Uploaded photos vs. the meme library:</p>
          <Compare
            rows={[
              { label: "Photos people uploaded", value: sources.upload.avgScore, note: `${sources.upload.images} images` },
              { label: "Meme library", value: sources.library.avgScore, note: `${sources.library.images} images` },
            ]}
          />
        </ChartCard>

        <ChartCard title="Who's taking part" subtitle="Share of members who have done each at least once">
          <BarList
            unit="members"
            rows={[
              { key: "voted", label: "Voted", value: reach.voted, note: pct(reach.voted, reach.total) },
              { key: "captioned", label: "Posted a caption", value: reach.captioned, note: pct(reach.captioned, reach.total) },
              { key: "uploaded", label: "Uploaded a photo", value: reach.uploaded, note: pct(reach.uploaded, reach.total) },
            ]}
          />
        </ChartCard>
      </div>

      <ChartCard title="AI models" subtitle="Which Gemini model wrote each caption, and how funny it was">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>Model</th><th className="num">Captions</th><th className="num">Avg score</th></tr>
            </thead>
            <tbody>
              {byModel(captions).map((m) => (
                <tr key={m.model}>
                  <td className="font-mono text-xs">{m.model}</td>
                  <td className="num">{m.count}</td>
                  <td className="num">{m.avgScore.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </main>
  );
}
