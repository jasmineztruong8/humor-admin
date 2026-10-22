"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resizeImage } from "@/lib/image";
import { createImage, discardUpload } from "@/app/actions";
import { MAX_STEER_LENGTH } from "@/lib/prompts";

const MAX_DIMENSION = 1280;

// Uploads straight from the browser to Storage (images/<admin id>/<id>.jpg,
// which the storage policy allows for your own folder), then asks the server
// to run the AI and save the rows.
export function NewImageForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get("photo");
    if (!(file instanceof File) || !file.size) return setError("Pick a photo first.");
    if (!file.type.startsWith("image/")) return setError("That file isn't an image.");

    setError(null);
    setStatus("Uploading…");
    const path = `${userId}/${crypto.randomUUID()}.jpg`;
    try {
      const blob = await resizeImage(file, MAX_DIMENSION);
      const { error: uploadError } = await createClient()
        .storage.from("images")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (uploadError) throw uploadError;
    } catch (err) {
      console.error("Upload failed", err);
      setStatus(null);
      return setError("Couldn't upload that photo. Please try again.");
    }

    setStatus("The AI is looking at your photo…");
    try {
      const result = await createImage(path, String(form.get("title") ?? ""), String(form.get("steer") ?? ""));
      if (result.error || !result.imageId) {
        setStatus(null);
        return setError(result.error ?? "Something went wrong. Please try again.");
      }
      router.push(`/media/${result.imageId}`);
    } catch (err) {
      console.error("Creating image failed", err);
      await discardUpload(path).catch(() => {});
      setStatus(null);
      setError("Something went wrong. Please try again.");
    }
  }

  const busy = status !== null;

  return (
    <form onSubmit={handleSubmit} className="card p-5 flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Photo</span>
        <input name="photo" type="file" accept="image/*" required disabled={busy} className="text-sm" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Title <span className="text-muted font-normal">(optional)</span></span>
        <input name="title" maxLength={120} disabled={busy} className="field" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Caption topic <span className="text-muted font-normal">(optional)</span></span>
        <input name="steer" maxLength={MAX_STEER_LENGTH} placeholder="e.g. finals week" disabled={busy} className="field" />
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex items-center gap-3">
        <button disabled={busy} className="btn btn-primary">{busy ? "Working…" : "Create with AI"}</button>
        {status && <p className="text-sm text-dim" aria-live="polite">{status}</p>}
      </div>
    </form>
  );
}
