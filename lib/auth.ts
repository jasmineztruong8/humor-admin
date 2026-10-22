import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkSuperadmin } from "@/lib/admin";

// Every page and server action calls this first. proxy.ts already turned
// away non-admins, but the check runs again here so no route depends on the
// proxy alone. Wrapped in cache() so a page and its layout share one lookup.
export const requireAdmin = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await checkSuperadmin(supabase, user))) redirect("/denied");
  return { supabase, user };
});
