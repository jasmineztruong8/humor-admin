"use client";

import { useActionState, useState, useTransition } from "react";
import type { FormState } from "@/app/actions";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

// A form wired to a server action that's already bound to its row id, e.g.
// <ActionForm action={updateCaption.bind(null, id)}>…</ActionForm>.
// Shows the action's error or success message under the fields.
export function ActionForm({
  action,
  submitLabel,
  pendingLabel = "Saving…",
  children,
  className = "",
}: {
  action: Action;
  submitLabel: string;
  pendingLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className={`flex flex-col gap-3 ${className}`}>
      {children}
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn btn-primary">{pending ? pendingLabel : submitLabel}</button>
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        {state?.message && !pending && <p className="text-sm text-ok" aria-live="polite">{state.message}</p>}
      </div>
    </form>
  );
}

// Caption text that turns into a textarea when you click Edit.
export function EditableCaption({ content, action }: { content: string; action: Action }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await action(prev, formData);
    if (!result?.error) setEditing(false);
    return result;
  }, undefined);

  if (!editing) {
    return (
      <div className="flex items-start gap-3">
        <p className="flex-1">&ldquo;{content}&rdquo;</p>
        <button type="button" onClick={() => setEditing(true)} className="text-sm text-dim hover:text-ink cursor-pointer">
          Edit
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <textarea name="content" defaultValue={content} maxLength={300} rows={2} required autoFocus className="field" />
      <div className="flex items-center gap-2">
        <button disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Save"}</button>
        <button type="button" onClick={() => setEditing(false)} className="btn">Cancel</button>
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      </div>
    </form>
  );
}

// Confirms, then runs a server action that's already bound to the row id.
export function DeleteButton({
  action,
  confirmText,
  label = "Delete",
}: {
  action: () => Promise<FormState>;
  confirmText: string;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(confirmText)) return;
    startTransition(async () => {
      const result = await action();
      if (result?.error) alert(result.error);
    });
  }

  return (
    <button type="button" onClick={handleClick} disabled={pending} className="btn btn-danger">
      {pending ? "Deleting…" : label}
    </button>
  );
}

// One row of a CRUD list: shows `view`, and Edit swaps it for a form with
// `children` as the fields. Both actions are already bound to the row id.
export function EditableItem({
  view,
  action,
  deleteAction,
  deleteText,
  children,
}: {
  view: React.ReactNode;
  action: Action;
  deleteAction: () => Promise<FormState>;
  deleteText: string;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await action(prev, formData);
    if (!result?.error) setEditing(false);
    return result;
  }, undefined);

  if (!editing) {
    return (
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">{view}</div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setEditing(true)} className="btn">Edit</button>
          <DeleteButton action={deleteAction} confirmText={deleteText} />
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {children}
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Save"}</button>
        <button type="button" onClick={() => setEditing(false)} className="btn">Cancel</button>
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      </div>
    </form>
  );
}

// A labelled form field.
export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {hint && <span className="text-muted">{hint}</span>}
      {children}
    </label>
  );
}
