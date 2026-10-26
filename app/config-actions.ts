"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { clearAiConfigCache } from "@/lib/ai-config";
import type { FormState } from "@/app/actions";

// CRUD for the AI settings and signup lists. Like app/actions.ts, every
// action checks for a superadmin first, and RLS checks again in the database
// (supabase/migrations/…_ai_observability.sql in the main repo). The input
// checks below mirror the database's, so mistakes get a readable message.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/;
const DOMAIN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const WEBSITE = /^https:\/\/[^\s<>"]+$/;

type Table =
  | "llm_providers"
  | "llm_models"
  | "terms"
  | "generation_examples"
  | "allowed_signup_domains"
  | "whitelisted_emails";

const PAGES: Record<Table, string> = {
  llm_providers: "/providers",
  llm_models: "/models",
  terms: "/terms",
  generation_examples: "/examples",
  allowed_signup_domains: "/access",
  whitelisted_emails: "/access",
};

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

class Invalid extends Error {}
function check(ok: boolean, message: string): asserts ok {
  if (!ok) throw new Invalid(message);
}

function dbError(error: { code?: string; message?: string }, what: string): FormState {
  console.error(`Saving ${what} failed`, error);
  if (error.code === "23505") return { error: `That ${what} already exists.` };
  if (error.code === "23503") return { error: `That ${what} is still in use, so it can't be removed.` };
  if (error.code === "23514") return { error: `That ${what} isn't valid. Check the format and length.` };
  return { error: `Couldn't save the ${what}. Please try again.` };
}

// Creates (no id) or updates (id) one row, from values that are already valid.
async function save(table: Table, what: string, read: () => Record<string, unknown>, id?: string): Promise<FormState> {
  const { supabase } = await requireAdmin();
  let values;
  try {
    if (id !== undefined) check(UUID.test(id), `That ${what} doesn't exist anymore.`);
    values = read();
  } catch (e) {
    if (e instanceof Invalid) return { error: e.message };
    throw e;
  }

  const { data, error } = id
    ? await supabase.from(table).update(values).eq("id", id).select("id")
    : await supabase.from(table).insert(values).select("id");
  if (error) return dbError(error, what);
  if (!data?.length) return { error: `That ${what} doesn't exist anymore.` };

  clearAiConfigCache();
  revalidatePath(PAGES[table]);
  return { message: id ? "Saved!" : "Added!" };
}

async function remove(table: Table, what: string, id: string): Promise<FormState> {
  const { supabase } = await requireAdmin();
  if (!UUID.test(id)) return { error: `That ${what} doesn't exist anymore.` };

  const { data, error } = await supabase.from(table).delete().eq("id", id).select("id");
  if (error) {
    if (error.code === "23503") {
      return { error: table === "llm_providers" ? "This provider still has models. Delete or move them first." : `That ${what} is still in use.` };
    }
    console.error(`Deleting ${what} failed`, error);
    return { error: `Couldn't delete that ${what}.` };
  }
  if (!data?.length) return { error: `Couldn't delete that ${what}.` };

  clearAiConfigCache();
  revalidatePath(PAGES[table]);
}

// LLM providers ---------------------------------------------------------------

function readProvider(formData: FormData) {
  return () => {
    const slug = text(formData, "slug").toLowerCase();
    const name = text(formData, "name");
    const website = text(formData, "website");
    check(SLUG.test(slug), "The key must be lowercase letters, numbers and dashes (e.g. google).");
    check(name.length >= 1 && name.length <= 80, "Give the provider a name (80 characters max).");
    check(!website || (WEBSITE.test(website) && website.length <= 300), "The website must start with https://.");
    return { slug, name, website: website || null };
  };
}

export async function createProvider(_prev: FormState, formData: FormData) {
  return save("llm_providers", "provider", readProvider(formData));
}
export async function updateProvider(id: string, _prev: FormState, formData: FormData) {
  return save("llm_providers", "provider", readProvider(formData), id);
}
export async function deleteProvider(id: string) {
  return remove("llm_providers", "provider", id);
}

// LLM models ------------------------------------------------------------------

function readModel(formData: FormData) {
  return () => {
    const providerId = text(formData, "provider_id");
    const modelId = text(formData, "model_id");
    const name = text(formData, "name");
    const priority = Number(text(formData, "priority") || "100");
    check(UUID.test(providerId), "Pick a provider.");
    check(MODEL_ID.test(modelId), "The model ID can only use letters, numbers and . _ : / - (100 characters max).");
    check(name.length >= 1 && name.length <= 80, "Give the model a name (80 characters max).");
    check(Number.isInteger(priority) && priority >= 0 && priority <= 1000, "Priority must be a whole number from 0 to 1000.");
    return { provider_id: providerId, model_id: modelId, name, priority, is_active: formData.get("is_active") === "on" };
  };
}

export async function createModel(_prev: FormState, formData: FormData) {
  return save("llm_models", "model", readModel(formData));
}
export async function updateModel(id: string, _prev: FormState, formData: FormData) {
  return save("llm_models", "model", readModel(formData), id);
}
export async function deleteModel(id: string) {
  return remove("llm_models", "model", id);
}

// Terms -----------------------------------------------------------------------

function readTerm(formData: FormData) {
  return () => {
    const term = text(formData, "term");
    const definition = text(formData, "definition");
    check(term.length >= 1 && term.length <= 60, "Enter a term (60 characters max).");
    check(definition.length >= 1 && definition.length <= 500, "Enter a definition (500 characters max).");
    return { term, definition, updated_at: new Date().toISOString() };
  };
}

export async function createTerm(_prev: FormState, formData: FormData) {
  return save("terms", "term", readTerm(formData));
}
export async function updateTerm(id: string, _prev: FormState, formData: FormData) {
  return save("terms", "term", readTerm(formData), id);
}
export async function deleteTerm(id: string) {
  return remove("terms", "term", id);
}

// Generation examples ---------------------------------------------------------

function readExample(formData: FormData) {
  return () => {
    const description = text(formData, "image_description");
    const caption = text(formData, "caption");
    check(description.length >= 1 && description.length <= 2000, "Describe the image (2000 characters max).");
    check(caption.length >= 1 && caption.length <= 300, "Enter the caption (300 characters max).");
    return {
      image_description: description,
      caption,
      is_active: formData.get("is_active") === "on",
      updated_at: new Date().toISOString(),
    };
  };
}

export async function createExample(_prev: FormState, formData: FormData) {
  return save("generation_examples", "example", readExample(formData));
}
export async function updateExample(id: string, _prev: FormState, formData: FormData) {
  return save("generation_examples", "example", readExample(formData), id);
}
export async function deleteExample(id: string) {
  return remove("generation_examples", "example", id);
}

// Allowed signup domains ------------------------------------------------------

function readDomain(formData: FormData) {
  return () => {
    const domain = text(formData, "domain").toLowerCase().replace(/^@/, "");
    check(domain.length <= 253 && DOMAIN.test(domain), "Enter a domain like columbia.edu (no @ or https://).");
    return { domain };
  };
}

export async function createDomain(_prev: FormState, formData: FormData) {
  return save("allowed_signup_domains", "domain", readDomain(formData));
}
export async function updateDomain(id: string, _prev: FormState, formData: FormData) {
  return save("allowed_signup_domains", "domain", readDomain(formData), id);
}
export async function deleteDomain(id: string) {
  return remove("allowed_signup_domains", "domain", id);
}

// Whitelisted emails ----------------------------------------------------------

function readEmail(formData: FormData) {
  return () => {
    const email = text(formData, "email").toLowerCase();
    const note = text(formData, "note");
    check(email.length <= 254 && EMAIL.test(email), "Enter a full email address.");
    check(note.length <= 200, "Notes must be 200 characters or fewer.");
    return { email, note: note || null };
  };
}

export async function createEmail(_prev: FormState, formData: FormData) {
  return save("whitelisted_emails", "email address", readEmail(formData));
}
export async function updateEmail(id: string, _prev: FormState, formData: FormData) {
  return save("whitelisted_emails", "email address", readEmail(formData), id);
}
export async function deleteEmail(id: string) {
  return remove("whitelisted_emails", "email address", id);
}

// Prompt chain mix: re-weight the existing chains ----------------------------

export async function updateMix(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user } = await requireAdmin();

  const weights: { chainId: string; weight: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("weight:")) continue;
    const chainId = key.slice("weight:".length);
    const weight = Number(value);
    if (!UUID.test(chainId)) return { error: "Unknown chain." };
    if (!Number.isInteger(weight) || weight < 0 || weight > 100) {
      return { error: "Each weight must be a whole number from 0 to 100." };
    }
    weights.push({ chainId, weight });
  }
  if (!weights.length) return { error: "There are no chains to update." };
  if (weights.every((w) => w.weight === 0)) return { error: "At least one chain needs a weight above 0." };

  const now = new Date().toISOString();
  const results = await Promise.all(
    weights.map((w) =>
      supabase
        .from("prompt_chain_mix")
        .update({ weight: w.weight, updated_by: user.id, updated_at: now })
        .eq("chain_id", w.chainId)
        .select("chain_id"),
    ),
  );
  const failed = results.find((r) => r.error || !r.data?.length);
  if (failed) {
    console.error("Updating the chain mix failed", failed.error);
    return { error: "Couldn't save the whole mix. Please check it and try again." };
  }

  clearAiConfigCache();
  revalidatePath("/chains");
  return { message: "Saved! New captions use this mix within a minute." };
}
