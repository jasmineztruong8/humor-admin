import { GoogleSignInButton } from "@/components/google-sign-in-button";

export const metadata = { title: "Sign in · Humor Admin" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;

  return (
    <main className="flex-1 max-w-md w-full mx-auto px-4 py-24 flex flex-col items-center gap-6 text-center">
      <h1 className="text-3xl font-semibold">Humor Admin</h1>
      <p className="text-dim">
        The admin area for The Humor Project. Superadmins only.
      </p>
      {error && <p className="text-danger">Sign-in didn&apos;t work. Please try again.</p>}
      <GoogleSignInButton />
    </main>
  );
}
