import type { Day } from "@/lib/stats";

// Small server-rendered charts. Each mark is focusable and shows its value in
// a tooltip on hover/focus (.mark/.tip in globals.css); every chart also has
// a table view, so no value is only reachable by hovering.

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function StatTile({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return (
    <div className="card p-4 flex flex-col gap-1">
      <p className="text-sm text-dim">{label}</p>
      <p className="text-3xl font-semibold">{typeof value === "number" ? compact.format(value) : value}</p>
      {note && <p className="text-xs text-muted">{note}</p>}
    </div>
  );
}

export function ChartCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card p-5 flex flex-col gap-4 min-w-0 ${className}`}>
      <div>
        <h2 className="font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-dim">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function TableView({ children }: { children: React.ReactNode }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted">Show as table</summary>
      <div className="mt-2 max-h-64 overflow-auto">{children}</div>
    </details>
  );
}

function niceMax(max: number) {
  if (max <= 4) return Math.max(max, 1);
  const step = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / step) * step;
}

const shortDay = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

// One column per day. Columns are capped at 24px wide with a 2px gap.
export function DailyColumns({ data, unit }: { data: Day[]; unit: string }) {
  const top = niceMax(Math.max(0, ...data.map((d) => d.count)));
  const total = data.reduce((a, d) => a + d.count, 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <div className="flex flex-col justify-between text-xs text-muted tabular-nums h-36 -my-1.5 text-right w-6 shrink-0">
          <span>{compact.format(top)}</span>
          <span>{compact.format(top / 2)}</span>
          <span>0</span>
        </div>
        <div className="relative flex-1 h-36 border-b border-axis">
          <div className="absolute inset-x-0 top-0 border-t border-line" />
          <div className="absolute inset-x-0 top-1/2 border-t border-line" />
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {data.map((d) => (
              <div
                key={d.day}
                tabIndex={0}
                aria-label={`${shortDay(d.day)}: ${d.count} ${unit}`}
                className="mark flex-1 h-full flex items-end justify-center"
              >
                <div
                  className="fill w-full max-w-6 bg-series-1 rounded-t"
                  style={{ height: `${(d.count / top) * 100}%`, minHeight: d.count ? 2 : 0 }}
                />
                <span className="tip">
                  <strong>{d.count}</strong> {unit} · {shortDay(d.day)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-between text-xs text-muted pl-8">
        <span>{shortDay(data[0].day)}</span>
        <span>{total.toLocaleString()} total</span>
        <span>{shortDay(data[data.length - 1].day)}</span>
      </div>
      <TableView>
        <table className="table">
          <thead>
            <tr><th>Day</th><th className="num">{unit}</th></tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.day}><td>{shortDay(d.day)}</td><td className="num">{d.count}</td></tr>
            ))}
          </tbody>
        </table>
      </TableView>
    </div>
  );
}

const hourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;

// 24 cells, one per hour, shaded light -> dark by activity (one blue ramp).
export function HourStrip({ hours, unit }: { hours: number[]; unit: string }) {
  const max = Math.max(1, ...hours);
  const step = (n: number) => (n === 0 ? 0 : Math.min(5, Math.ceil((n / max) * 5)));
  const busiest = hours.indexOf(Math.max(...hours));

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-12 sm:grid-cols-24 gap-[2px]">
        {hours.map((n, h) => (
          <div
            key={h}
            tabIndex={0}
            aria-label={`${hourLabel(h)}: ${n} ${unit}`}
            className="mark h-10"
          >
            <div
              className="fill h-full rounded"
              style={{ background: step(n) ? `var(--seq-${step(n)})` : "var(--well)" }}
            />
            <span className="tip">
              <strong>{n}</strong> {unit} · {hourLabel(h)}–{hourLabel((h + 1) % 24)}
            </span>
          </div>
        ))}
      </div>
      <div className="hidden sm:flex justify-between text-xs text-muted">
        <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted">
        <span>Less</span>
        {[0, 1, 2, 3, 4, 5].map((s) => (
          <span
            key={s}
            className="size-3 rounded-sm"
            style={{ background: s ? `var(--seq-${s})` : "var(--well)" }}
          />
        ))}
        <span>More</span>
        {hours[busiest] > 0 && (
          <span className="ml-auto text-dim">
            Busiest: <strong className="text-ink">{hourLabel(busiest)}</strong>
          </span>
        )}
      </div>
      <TableView>
        <table className="table">
          <thead>
            <tr><th>Hour (ET)</th><th className="num">{unit}</th></tr>
          </thead>
          <tbody>
            {hours.map((n, h) => (
              <tr key={h}><td>{hourLabel(h)}</td><td className="num">{n}</td></tr>
            ))}
          </tbody>
        </table>
      </TableView>
    </div>
  );
}

// Horizontal bars, value at the tip. For ranked lists.
export function BarList({ rows, unit }: { rows: { key: string; label: string; value: number; note?: string }[]; unit: string }) {
  if (!rows.length) return <p className="text-sm text-dim">Nothing here yet.</p>;
  const max = Math.max(...rows.map((r) => r.value));

  return (
    <ol className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.key} className="flex flex-col gap-1">
          <div className="flex justify-between gap-3 text-sm">
            <span className="truncate">{r.label}</span>
            {r.note && <span className="text-muted shrink-0">{r.note}</span>}
          </div>
          <div tabIndex={0} aria-label={`${r.label}: ${r.value} ${unit}`} className="mark flex items-center gap-2">
            <div className="flex-1 h-2.5">
              <div className="fill h-full bg-series-1 rounded-r" style={{ width: `${(r.value / max) * 100}%` }} />
            </div>
            <span className="text-sm font-medium tabular-nums w-10 text-right">{r.value}</span>
            <span className="tip"><strong>{r.value}</strong> {unit}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

// Up votes grow right from the centre line, down votes grow left.
export function VoteSplit({ up, down, max }: { up: number; down: number; max: number }) {
  return (
    <div className="flex items-center gap-2 text-xs tabular-nums">
      <span className="w-8 text-right text-dim">−{down}</span>
      <div tabIndex={0} aria-label={`${up} up, ${down} down`} className="mark flex-1 flex h-2.5">
        <div className="flex-1 flex justify-end pr-[1px]">
          <div className="fill h-full bg-down rounded-l" style={{ width: `${(down / max) * 100}%` }} />
        </div>
        <div className="w-px bg-axis" />
        <div className="flex-1 pl-[1px]">
          <div className="fill h-full bg-up rounded-r" style={{ width: `${(up / max) * 100}%` }} />
        </div>
        <span className="tip"><strong>{up}</strong> up · <strong>{down}</strong> down</span>
      </div>
      <span className="w-8 text-dim">+{up}</span>
    </div>
  );
}

// Two averages side by side on one shared scale (both are average score).
export function Compare({ rows }: { rows: { label: string; value: number | null; note: string }[] }) {
  const max = Math.max(0.1, ...rows.map((r) => Math.abs(r.value ?? 0)));
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => (
        <div key={r.label} className="flex flex-col gap-1">
          <div className="flex justify-between text-sm">
            <span>{r.label}</span>
            <span className="text-muted">{r.note}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2.5 bg-well rounded-r">
              <div
                className="h-full bg-series-1 rounded-r"
                style={{ width: `${(Math.max(0, r.value ?? 0) / max) * 100}%` }}
              />
            </div>
            <span className="text-sm font-medium tabular-nums w-12 text-right">
              {r.value === null ? "—" : r.value.toFixed(2)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
