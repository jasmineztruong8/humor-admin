import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { PUBLIC_PATHS, SIGNED_IN_PATHS, checkSuperadmin, matches } from "@/lib/admin";

// Runs before every request (pages and server actions alike). It refreshes
// the Supabase session cookie and is the first wall: signed-out visitors go
// to /login, signed-in non-admins go to /denied. Every page and action checks
// again with requireAdmin(), and RLS checks a third time in the database.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // Don't put code between createServerClient and getUser(): this call is
  // what triggers the token refresh.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  if (matches(pathname, PUBLIC_PATHS)) return response;

  // Redirects keep the refreshed session cookies
  const redirectTo = (path: string) => {
    const redirect = NextResponse.redirect(new URL(path, request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!user) return redirectTo("/login");
  if (matches(pathname, SIGNED_IN_PATHS)) return response;
  if (!(await checkSuperadmin(supabase, user))) return redirectTo("/denied");

  return response;
}

export const config = {
  matcher: [
    // Everything except static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
