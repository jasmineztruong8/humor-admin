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
