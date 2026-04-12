import type { AuditLogEntry } from "../../shared/types";

function hashSnippet(hash: string): string {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

export function MerkleAuditInspector({
  entries,
  onVerify,
}: {
  entries: AuditLogEntry[];
  onVerify?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.28em] text-slate-400">
          Merkle Audit
        </h3>
        <button
          type="button"
          className="rounded-full border border-cyan-400/40 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-cyan-200 transition-colors hover:border-cyan-300 hover:bg-cyan-400/10"
          onClick={onVerify}
        >
          Verify chain
        </button>
      </div>
      <div className="space-y-2">
        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-sm text-slate-500">
            No audit entries loaded.
          </div>
        ) : (
          entries.slice(-5).map((entry) => (
            <div
              key={entry.id}
              className="border-l border-white/15 pl-3 text-[11px] text-slate-300"
            >
              <div className="mb-0.5 flex items-center justify-between text-[10px] uppercase tracking-[0.24em] text-slate-500">
                <span>{entry.system}</span>
                <span>{hashSnippet(entry.entry_hash)}</span>
              </div>
              <div>
                Tick {entry.tick}: {entry.field}
                {entry.agent_id ? ` · ${entry.agent_id}` : ""}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
