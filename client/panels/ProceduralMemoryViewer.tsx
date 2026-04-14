type ProceduralAffordance = {
  cueSignature: string;
  targetSignature: string;
  motorPrimitiveType: string;
  confidence: number;
  attempts: number;
  successes: number;
  failures: number;
};

export function ProceduralMemoryViewer({ affordances }: { affordances: ProceduralAffordance[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.28em] text-slate-400">
          Procedural Memory
        </h3>
        <span className="text-[10px] text-slate-500">{affordances.length} patterns</span>
      </div>
      {affordances.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 px-3 py-5 text-sm text-slate-500">
          No learned affordances yet.
        </div>
      ) : (
        <div className="space-y-2">
          {affordances.slice(0, 10).map((item) => (
            <div
              key={`${item.cueSignature}-${item.targetSignature}-${item.motorPrimitiveType}`}
              className="rounded-xl border border-white/10 p-3"
            >
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                {item.motorPrimitiveType}
              </div>
              <div className="text-xs text-slate-300">
                cue: {item.cueSignature} | target: {item.targetSignature}
              </div>
              <div className="text-[11px] text-slate-400">
                confidence {(item.confidence * 100).toFixed(0)}% · {item.successes}/{item.attempts}{" "}
                successes
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
