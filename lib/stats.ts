import type { CaptionRow, ImageRow, ProfileRow, VoteRow } from "@/lib/data";

// Pure functions over the loaded rows, so the dashboard's numbers can be
// unit tested without a database.

// The class meets in New York, so "what hour is it" means Eastern time.
export const TIME_ZONE = "America/New_York";

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }); // YYYY-MM-DD
const hourOf = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", hourCycle: "h23" });

export type Day = { day: string; count: number };

// One entry per day for the last `days` days (today included), zeros kept.
export function perDay(dates: string[], days: number, now = new Date()): Day[] {
  const counts = new Map<string, number>();
  for (const d of dates) {
    const key = dayKey.format(new Date(d));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from({ length: days }, (_, i) => {
    const key = dayKey.format(new Date(now.getTime() - (days - 1 - i) * 86_400_000));
    return { day: key, count: counts.get(key) ?? 0 };
  });
}

// How many things happened in each hour of the day (0-23, Eastern).
export function perHour(dates: string[]) {
  const hours = Array<number>(24).fill(0);
  for (const d of dates) hours[Number(hourOf.format(new Date(d))) % 24]++;
  return hours;
}

export type Tally = { up: number; down: number };

export function tallyVotes(votes: VoteRow[]) {
  const byCaption = new Map<string, Tally>();
  for (const v of votes) {
    const t = byCaption.get(v.caption_id) ?? { up: 0, down: 0 };
    if (v.value > 0) t.up++;
    else t.down++;
    byCaption.set(v.caption_id, t);
  }
  return byCaption;
}

// Captions that split the room: both up- and downvotes, ranked by how many
// people landed on the losing side (so 5 up / 5 down beats 9 up / 1 down).
export function mostDivisive(captions: CaptionRow[], tallies: Map<string, Tally>, limit = 5) {
  return captions
    .map((c) => ({ caption: c, ...(tallies.get(c.id) ?? { up: 0, down: 0 }) }))
    .filter((c) => c.up > 0 && c.down > 0)
    .sort((a, b) => Math.min(b.up, b.down) - Math.min(a.up, a.down) || b.up + b.down - (a.up + a.down))
    .slice(0, limit);
}

export function topCaptions(captions: CaptionRow[], limit = 5) {
  return [...captions]
    .sort((a, b) => b.score - a.score || a.created_at.localeCompare(b.created_at))
    .filter((c) => c.score > 0)
    .slice(0, limit);
}

// Who writes (well, prompts) the funniest captions: total score per author.
export function funniestPeople(captions: CaptionRow[], profiles: ProfileRow[], limit = 8) {
  const byUser = new Map<string, { score: number; captions: number }>();
  for (const c of captions) {
    const s = byUser.get(c.user_id) ?? { score: 0, captions: 0 };
    s.score += c.score;
    s.captions++;
    byUser.set(c.user_id, s);
  }
  const names = new Map(profiles.map((p) => [p.id, p]));
  return [...byUser.entries()]
    .map(([id, s]) => ({ id, profile: names.get(id), ...s }))
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score || b.captions - a.captions)
    .slice(0, limit);
}

function average(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

// Does telling the AI what to joke about make it funnier?
export function steeredVsNot(captions: CaptionRow[]) {
  const steered = captions.filter((c) => c.user_prompt);
  const unsteered = captions.filter((c) => !c.user_prompt);
  return {
    steered: { count: steered.length, avgScore: average(steered.map((c) => c.score)) },
    unsteered: { count: unsteered.length, avgScore: average(unsteered.map((c) => c.score)) },
  };
}

export function byModel(captions: CaptionRow[]) {
  const models = new Map<string, number[]>();
  for (const c of captions) models.set(c.model, [...(models.get(c.model) ?? []), c.score]);
  return [...models.entries()]
    .map(([model, scores]) => ({ model, count: scores.length, avgScore: average(scores)! }))
    .sort((a, b) => b.count - a.count);
}

// Library memes vs photos people uploaded: which get funnier captions?
export function bySource(images: ImageRow[], captions: CaptionRow[]) {
  const source = new Map(images.map((i) => [i.id, i.source]));
  const scores = { upload: [] as number[], library: [] as number[] };
  for (const c of captions) {
    const s = source.get(c.image_id);
    if (s) scores[s].push(c.score);
  }
  return {
    upload: { images: images.filter((i) => i.source === "upload").length, avgScore: average(scores.upload) },
    library: { images: images.filter((i) => i.source === "library").length, avgScore: average(scores.library) },
  };
}

// Share of people who have done each thing at least once.
export function engagement(profiles: ProfileRow[], images: ImageRow[], captions: CaptionRow[], votes: VoteRow[]) {
  const uploaded = new Set(images.map((i) => i.user_id).filter(Boolean));
  const captioned = new Set(captions.map((c) => c.user_id));
  const voted = new Set(votes.map((v) => v.user_id));
  const total = profiles.length;
  return {
    total,
    uploaded: uploaded.size,
    captioned: captioned.size,
    voted: voted.size,
    lurkers: profiles.filter((p) => !uploaded.has(p.id) && !captioned.has(p.id) && !voted.has(p.id)).length,
  };
}
