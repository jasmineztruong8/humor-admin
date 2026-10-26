import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  is_superadmin: boolean;
  created_at: string;
};

export type ImageRow = {
  id: string;
  user_id: string | null;
  source: "upload" | "library";
  image_url: string;
  title: string | null;
  is_animated: boolean;
  created_at: string;
};

export type CaptionRow = {
  id: string;
  image_id: string;
  user_id: string;
  content: string;
  user_prompt: string | null;
  model: string;
  score: number;
  created_at: string;
};

export type VoteRow = {
  user_id: string;
  caption_id: string;
  value: 1 | -1;
  created_at: string;
};

const PAGE = 1000; // Supabase returns at most 1000 rows per request

// Reads a whole table, a page at a time. Runs as the signed-in admin, so RLS
// still decides what comes back (votes are only fully visible to superadmins).
export async function fetchAll<T>(supabase: SupabaseClient, table: string, columns: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1)
      .returns<T[]>();
    if (error) throw new Error(`Loading ${table} failed: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

// Every row created since a date, a page at a time (for charts over a window).
export async function fetchSince<T>(supabase: SupabaseClient, table: string, columns: string, since: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1)
      .returns<T[]>();
    if (error) throw new Error(`Loading ${table} failed: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

export function loadEverything(supabase: SupabaseClient) {
  return Promise.all([
    fetchAll<ProfileRow>(supabase, "profiles", "id, first_name, last_name, is_superadmin, created_at"),
    fetchAll<ImageRow>(supabase, "images", "id, user_id, source, image_url, title, is_animated, created_at"),
    fetchAll<CaptionRow>(supabase, "captions", "id, image_id, user_id, content, user_prompt, model, score, created_at"),
    fetchAll<VoteRow>(supabase, "caption_votes", "user_id, caption_id, value, created_at"),
  ]);
}

export function displayName(p: Pick<ProfileRow, "first_name" | "last_name"> | undefined | null) {
  const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ");
  return name || "(no name yet)";
}
