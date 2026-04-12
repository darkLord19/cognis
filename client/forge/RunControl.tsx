import type { RunSummary } from "../store";

interface RunControlProps {
  selectedRun: RunSummary | null;
  onStart: (runId: string) => Promise<void>;
  onPause: (runId: string) => Promise<void>;
  onStop: (runId: string) => Promise<void>;
}

export function RunControl({ selectedRun, onStart, onPause, onStop }: RunControlProps) {
  if (!selectedRun) return null;

  const isRunning = selectedRun.status === "running";
  const isPaused = selectedRun.status === "paused";

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5">
      <button
        type="button"
        disabled={isRunning}
        onClick={() => onStart(selectedRun.id)}
        className="flex h-9 items-center gap-2 rounded-xl px-4 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-400/10 disabled:opacity-30"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <title>Start/Resume</title>
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
        {isPaused ? "Resume" : "Start"}
      </button>
      <button
        type="button"
        disabled={!isRunning}
        onClick={() => onPause(selectedRun.id)}
        className="flex h-9 items-center gap-2 rounded-xl px-4 text-xs font-semibold text-amber-400 transition-colors hover:bg-amber-400/10 disabled:opacity-30"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <title>Pause</title>
          <rect x="6" y="4" width="4" height="16" />
          <rect x="14" y="4" width="4" height="16" />
        </svg>
        Pause
      </button>
      <div className="h-4 w-px bg-white/10 mx-1" />
      <button
        type="button"
        disabled={!isRunning && !isPaused}
        onClick={() => onStop(selectedRun.id)}
        className="flex h-9 items-center gap-2 rounded-xl px-4 text-xs font-semibold text-rose-400 transition-colors hover:bg-rose-400/10 disabled:opacity-30"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <title>Stop</title>
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        </svg>
        Stop
      </button>
    </div>
  );
}

export function CreateRunList({
  configs,
  onCreate,
}: {
  configs: string[];
  onCreate: (name: string) => Promise<void>;
}) {
  return (
    <div className="space-y-1">
      {configs.map((config) => (
        <button
          key={config}
          type="button"
          onClick={() => onCreate(config)}
          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
        >
          <span>{config}</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <title>Create</title>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      ))}
    </div>
  );
}
