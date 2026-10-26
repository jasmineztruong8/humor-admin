import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { NavLink } from "@/components/nav-link";

// Every admin page sits under this layout. The pages call requireAdmin()
// themselves too, since a layout doesn't re-run on every navigation.
export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const { user } = await requireAdmin();

  return (
    <>
      <header className="border-b border-line bg-card">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/" className="font-semibold">
            Humor Admin
          </Link>
          <nav className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm" aria-label="Admin sections">
            <NavLink href="/">Stats</NavLink>
            <NavLink href="/users">Users</NavLink>
            <NavLink href="/media">Media</NavLink>
            <NavLink href="/votes">Votes</NavLink>
            <span className="mx-1 h-4 w-px bg-line" aria-hidden />
            <NavLink href="/requests">Requests</NavLink>
            <NavLink href="/responses">Responses</NavLink>
            <NavLink href="/chains">Chains</NavLink>
            <NavLink href="/models">Models</NavLink>
            <NavLink href="/providers">Providers</NavLink>
            <NavLink href="/examples">Examples</NavLink>
            <NavLink href="/terms">Terms</NavLink>
            <span className="mx-1 h-4 w-px bg-line" aria-hidden />
            <NavLink href="/access">Sign-up access</NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-dim">
            <span className="hidden sm:inline truncate max-w-56">{user.email}</span>
            <form action="/auth/signout" method="post">
              <button className="btn">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
