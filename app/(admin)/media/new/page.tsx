import { requireAdmin } from "@/lib/auth";
import { NewImageForm } from "@/components/new-image-form";

export const metadata = { title: "New image · Humor Admin" };

// CREATE: upload a photo; the AI describes it and writes its first caption.
export default async function NewImagePage() {
  const { user } = await requireAdmin();

  return (
    <main className="flex-1 max-w-xl w-full mx-auto px-4 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">New image</h1>
        <p className="text-dim">
          Gemini describes the photo, then writes a first caption from that description. It&apos;s posted as
          your upload and shows up on The Humor Project right away.
        </p>
      </div>
      <NewImageForm userId={user.id} />
    </main>
  );
}
