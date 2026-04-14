type ActionTraceEntry = {
  tick: number;
  source: string;
  reason?: string;
  primitives: Array<{
    type: string;
    intensity: number;
    durationTicks: number;
    target: { type: string; ref?: string; direction?: string };
  }>;
};

export function ActionTraceViewer({ trace }: { trace: ActionTraceEntry[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.28em] text-slate-400">
          Action Trace
        </h3>
        <span className="text-[10px] text-slate-500">{trace.length} entries</span>
      </div>
      {trace.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 px-3 py-5 text-sm text-slate-500">
          No action trace available.
        </div>
      ) : (
        <div className="space-y-2">
          {trace
            .slice(-10)
            .reverse()
            .map((entry) => (
              <div
                key={`${entry.tick}-${entry.source}-${entry.primitives[0]?.type ?? "unknown"}`}
                className="rounded-xl border border-white/10 p-3"
              >
                <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-slate-500">
                  <span>Tick {entry.tick}</span>
                  <span>{entry.source}</span>
                </div>
                <div className="text-xs text-slate-300">
                  {(entry.primitives[0]?.type ?? "unknown").replace(/_/g, " ")}
                </div>
                {entry.reason ? (
                  <div className="text-[11px] text-slate-500">{entry.reason}</div>
                ) : null}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
