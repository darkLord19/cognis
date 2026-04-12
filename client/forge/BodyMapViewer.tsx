const partOrder = ["head", "torso", "leftArm", "rightArm", "leftLeg", "rightLeg"] as const;

export function BodyMapViewer({ bodyMap }: { bodyMap: Record<string, { pain: number }> }) {
  if (!bodyMap) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.28em] text-slate-400">
          Body Schema
        </h3>
        <span className="text-[10px] text-slate-500">Pain heatmap</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {partOrder.map((part) => {
          const pain = bodyMap[part]?.pain ?? 0;
          const intensity = Math.min(pain, 1);
          return (
            <div
              key={part}
              className="flex min-h-16 flex-col justify-between rounded-xl border border-white/8 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-slate-200 transition-colors"
              style={{
                backgroundColor: `rgba(248, 113, 113, ${0.08 + intensity * 0.42})`,
                borderColor: `rgba(248, 113, 113, ${0.12 + intensity * 0.25})`,
              }}
            >
              <span>{part}</span>
              <span className="font-mono text-slate-300">{pain.toFixed(2)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
