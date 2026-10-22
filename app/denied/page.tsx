import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "No access · Humor Admin" };

// Signed in with Google, but the profile isn't a superadmin.
export default async function DeniedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex-1 max-w-md w-full mx-auto px-4 py-24 flex flex-col items-center gap-6 text-center">
      <h1 className="text-3xl font-semibold">No access</h1>
      <p className="text-dim">
        {user?.email ? <>You&apos;re signed in as <strong className="text-ink">{user.email}</strong>, but</> : "This account"}{" "}
        isn&apos;t a superadmin, so the admin area is closed to you.
      </p>
      <form action="/auth/signout" method="post">
        <button className="btn">Sign in with a different account</button>
      </form>
    </main>
  );
}
