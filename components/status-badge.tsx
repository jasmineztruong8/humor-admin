// A coloured square and a label, e.g. for a request that succeeded or failed.
export function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={`size-2.5 rounded-sm ${ok ? "bg-ok" : "bg-danger"}`} />
      {label}
    </span>
  );
}

export const RESPONSE_STATUS: Record<string, string> = {
  ok: "Answered",
  quota: "Out of quota",
  busy: "Overloaded",
  timeout: "Timed out",
  not_found: "Model not found",
  error: "Error",
};
