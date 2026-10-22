import { describe, expect, it } from "vitest";
import type { CaptionRow, ImageRow, ProfileRow, VoteRow } from "@/lib/data";
import {
  bySource,
  engagement,
  funniestPeople,
  mostDivisive,
  perDay,
  perHour,
  steeredVsNot,
  tallyVotes,
  topCaptions,
} from "@/lib/stats";

const profile = (id: string, first_name: string | null = id): ProfileRow => ({
  id,
  first_name,
  last_name: "Test",
  is_superadmin: false,
  created_at: "2026-10-01T00:00:00Z",
});

const caption = (id: string, user_id: string, score: number, extra: Partial<CaptionRow> = {}): CaptionRow => ({
  id,
  image_id: "img1",
  user_id,
  content: `caption ${id}`,
  user_prompt: null,
  model: "gemini-test",
  score,
  created_at: "2026-10-10T12:00:00Z",
  ...extra,
});

const vote = (user_id: string, caption_id: string, value: 1 | -1): VoteRow => ({
  user_id,
  caption_id,
  value,
  created_at: "2026-10-10T12:00:00Z",
});

describe("perDay", () => {
  it("keeps every day in the range, zeros included, in Eastern time", () => {
    const now = new Date("2026-10-22T16:00:00Z"); // noon ET
    const days = perDay(
      [
        "2026-10-22T15:00:00Z",
        "2026-10-21T15:00:00Z",
        "2026-10-21T03:00:00Z", // 11pm ET on the 20th
      ],
      3,
      now,
    );
    expect(days).toEqual([
      { day: "2026-10-20", count: 1 },
      { day: "2026-10-21", count: 1 },
      { day: "2026-10-22", count: 1 },
    ]);
  });
});

describe("perHour", () => {
  it("buckets by Eastern hour", () => {
    const hours = perHour(["2026-10-22T04:00:00Z", "2026-10-22T04:59:00Z", "2026-10-22T17:30:00Z"]);
    expect(hours).toHaveLength(24);
    expect(hours[0]).toBe(2); // midnight ET (EDT is UTC-4)
    expect(hours[13]).toBe(1);
  });
});

describe("mostDivisive", () => {
  it("ranks by how many people were on the losing side", () => {
    const captions = [caption("a", "u1", 8), caption("b", "u1", 0), caption("c", "u1", 3)];
    const votes = [
      ...Array.from({ length: 9 }, (_, i) => vote(`x${i}`, "a", 1)),
      vote("y", "a", -1),
      ...Array.from({ length: 4 }, (_, i) => vote(`p${i}`, "b", 1)),
      ...Array.from({ length: 4 }, (_, i) => vote(`q${i}`, "b", -1)),
      vote("z", "c", 1), // no downvotes: not divisive
    ];
    const result = mostDivisive(captions, tallyVotes(votes));
    expect(result.map((r) => r.caption.id)).toEqual(["b", "a"]);
    expect(result[0]).toMatchObject({ up: 4, down: 4 });
  });
});

describe("topCaptions", () => {
  it("leaves out captions nobody liked", () => {
    const result = topCaptions([caption("a", "u1", 2), caption("b", "u1", 0), caption("c", "u1", 5)]);
    expect(result.map((c) => c.id)).toEqual(["c", "a"]);
  });
});

describe("funniestPeople", () => {
  it("adds up score per author", () => {
    const people = funniestPeople(
      [caption("a", "u1", 2), caption("b", "u1", 3), caption("c", "u2", 4)],
      [profile("u1"), profile("u2")],
    );
    expect(people.map((p) => [p.id, p.score, p.captions])).toEqual([
      ["u1", 5, 2],
      ["u2", 4, 1],
    ]);
  });
});

describe("steeredVsNot", () => {
  it("averages each group and handles an empty one", () => {
    const result = steeredVsNot([caption("a", "u1", 2, { user_prompt: "finals" }), caption("b", "u1", 4, { user_prompt: "food" })]);
    expect(result.steered).toEqual({ count: 2, avgScore: 3 });
    expect(result.unsteered).toEqual({ count: 0, avgScore: null });
  });
});

describe("bySource and engagement", () => {
  const images: ImageRow[] = [
    { id: "img1", user_id: "u1", source: "upload", image_url: "", title: null, is_animated: false, created_at: "" },
    { id: "img2", user_id: null, source: "library", image_url: "", title: null, is_animated: false, created_at: "" },
  ];

  it("splits caption scores by where the image came from", () => {
    const result = bySource(images, [caption("a", "u1", 4), caption("b", "u2", 1, { image_id: "img2" })]);
    expect(result.upload).toEqual({ images: 1, avgScore: 4 });
    expect(result.library).toEqual({ images: 1, avgScore: 1 });
  });

  it("counts who has done what, and who hasn't done anything", () => {
    const result = engagement(
      [profile("u1"), profile("u2"), profile("u3")],
      images,
      [caption("a", "u1", 0)],
      [vote("u2", "a", 1)],
    );
    expect(result).toEqual({ total: 3, uploaded: 1, captioned: 1, voted: 1, lurkers: 1 });
  });
});
