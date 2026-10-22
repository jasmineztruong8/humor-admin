"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { AiUnavailableError, describeImage, writeCaption } from "@/lib/gemini";
import { MAX_CAPTION_LENGTH, cleanSteer } from "@/lib/prompts";

export type FormState = { error?: string; message?: string } | undefined;

// Every action checks for a superadmin first (proxy.ts did too, but actions
// don't rely on it). RLS in the database checks the same thing a third time:
// only superadmins can edit media, and anyone's media can only be deleted by
// its owner or a superadmin.

const UPLOAD_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/;
const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 2000;

function aiErrorMessage(e: unknown) {
  console.error("Gemini call failed", e);
  if (e instanceof AiUnavailableError) {
    return e.reason === "quota"
      ? "The AI has used up its free requests for today. Please try again tomorrow."
      : "The AI is busy right now. Please try again in a moment.";
  }
  return "Something went wrong with the AI. Please try again.";
}

// CREATE. The photo is already in Storage (uploaded from the browser to
// images/<admin id>/<random id>.jpg). The AI describes it and writes a first
// caption, then both are saved as the admin's own upload.
export async function createImage(storagePath: string, title: string, steer: string): Promise<{ imageId?: string; error?: string }> {
  const { supabase, user } = await requireAdmin();

  if (!UPLOAD_PATH.test(storagePath) || !storagePath.startsWith(`${user.id}/`)) {
    return { error: "Invalid upload." };
  }
  const fail = async (error: string) => {
    await supabase.storage.from("images").remove([storagePath]);
    return { error };
  };

  const { data: file, error: downloadError } = await supabase.storage.from("images").download(storagePath);
  if (downloadError || !file) return fail("Couldn't find the upload. Please try again.");

  let described, caption;
  try {
    described = await describeImage({ data: Buffer.from(await file.arrayBuffer()), mimeType: "image/jpeg" });
    caption = await writeCaption(described.description, cleanSteer(steer));
  } catch (e) {
    return fail(aiErrorMessage(e));
  }

  const { data: image, error } = await supabase
    .from("images")
    .insert({
      user_id: user.id,
      source: "upload",
      storage_path: storagePath,
      image_url: supabase.storage.from("images").getPublicUrl(storagePath).data.publicUrl,
      title: title.trim().slice(0, MAX_TITLE_LENGTH) || null,
      description: described.description,
      description_prompt: described.prompt,
      description_model: described.model,
      is_animated: false,
    })
    .select("id")
    .single();
  if (error || !image) return fail("Couldn't save the image. Please try again.");

  const { error: captionError } = await supabase.from("captions").insert({
    image_id: image.id,
    user_id: user.id,
    content: caption.content,
    user_prompt: cleanSteer(steer),
    prompt: caption.prompt,
    model: caption.model,
  });
  if (captionError) console.error("Saving first caption failed", captionError);

  revalidatePath("/media");
  return { imageId: image.id };
}

// The admin cancelled before saving: remove the uploaded file.
export async function discardUpload(storagePath: string): Promise<void> {
  const { supabase, user } = await requireAdmin();
  if (UPLOAD_PATH.test(storagePath) && storagePath.startsWith(`${user.id}/`)) {
    await supabase.storage.from("images").remove([storagePath]);
  }
}

// CREATE: another AI caption for an existing image, from its saved description.
export async function generateCaption(imageId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user } = await requireAdmin();

  const { data: image } = await supabase.from("images").select("description").eq("id", imageId).maybeSingle();
  if (!image) return { error: "That image doesn't exist anymore." };

  const steer = cleanSteer(formData.get("steer"));
  let caption;
  try {
    caption = await writeCaption(image.description, steer);
  } catch (e) {
    return { error: aiErrorMessage(e) };
  }

  const { error } = await supabase.from("captions").insert({
    image_id: imageId,
    user_id: user.id,
    content: caption.content,
    user_prompt: steer,
    prompt: caption.prompt,
    model: caption.model,
  });
  if (error) return { error: "Couldn't save the caption. Please try again." };

  revalidatePath(`/media/${imageId}`);
  return { message: `Added: “${caption.content}”` };
}

// UPDATE: an image's title and AI description (e.g. to fix a wrong description).
export async function updateImage(imageId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!description) return { error: "The description can't be empty: it's what captions are written from." };
  if (title.length > MAX_TITLE_LENGTH) return { error: `Titles must be ${MAX_TITLE_LENGTH} characters or fewer.` };
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return { error: `Descriptions must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.` };
  }

  const { data, error } = await supabase
    .from("images")
    .update({ title: title || null, description })
    .eq("id", imageId)
    .select("id");
  if (error || !data?.length) return { error: "Couldn't save the image. Please try again." };

  revalidatePath(`/media/${imageId}`);
  return { message: "Saved!" };
}

// UPDATE: a caption's text.
export async function updateCaption(captionId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();

  const content = String(formData.get("content") ?? "").trim();
  if (!content) return { error: "A caption can't be empty." };
  if (content.length > MAX_CAPTION_LENGTH) return { error: `Captions must be ${MAX_CAPTION_LENGTH} characters or fewer.` };

  const { data, error } = await supabase
    .from("captions")
    .update({ content })
    .eq("id", captionId)
    .select("image_id");
  if (error || !data?.length) return { error: "Couldn't save the caption. Please try again." };

  revalidatePath(`/media/${data[0].image_id}`);
  return { message: "Saved!" };
}

// DELETE: a caption (its votes cascade).
export async function deleteCaption(captionId: string): Promise<FormState> {
  const { supabase } = await requireAdmin();

  const { data, error } = await supabase.from("captions").delete().eq("id", captionId).select("image_id");
  if (error || !data?.length) return { error: "Couldn't delete that caption." };

  revalidatePath(`/media/${data[0].image_id}`);
}

// DELETE: an image row (its captions and votes cascade), then its file.
export async function deleteImage(imageId: string): Promise<FormState> {
  const { supabase } = await requireAdmin();

  const { data, error } = await supabase.from("images").delete().eq("id", imageId).select("storage_path");
  if (error || !data?.length) return { error: "Couldn't delete that image." };

  await supabase.storage.from("images").remove([data[0].storage_path]);
  revalidatePath("/media");
  redirect("/media");
}
