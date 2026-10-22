import type { SupabaseClient, User } from "@supabase/supabase-js";

// Shared by proxy.ts and lib/auth.ts so the gate is the same rule everywhere:
// a real (non-anonymous) Google login whose profile has is_superadmin = true.
// The database applies the same rule again in RLS (private.is_superadmin()).

// Paths anyone may open: the login page and the OAuth callback.
export const PUBLIC_PATHS = ["/login", "/auth/callback"];

// Signed in, but not a superadmin: may only see the "no access" page and sign out.
export const SIGNED_IN_PATHS = ["/denied", "/auth/signout"];

export function matches(pathname: string, paths: string[]) {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function checkSuperadmin(supabase: SupabaseClient, user: User | null) {
  if (!user || user.is_anonymous) return false;
  const { data } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .maybeSingle<{ is_superadmin: boolean }>();
  return Boolean(data?.is_superadmin);
}
