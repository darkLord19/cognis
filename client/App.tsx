import { useEffect, useMemo, useState } from "react";
import type { AgentState, AuditLogEntry, Finding, RunState } from "../shared/types";
import { BodyMapViewer } from "./forge/BodyMapViewer";
import { MerkleAuditInspector } from "./forge/MerkleAuditInspector";
import { type RunSummary, useStore } from "./store";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });

  const payload = (await response.json().catch(() => null)) as T | { error?: string } | null;
  if (!response.ok) {
    throw new Error(
      (payload && typeof payload === "object" && "error" in payload && payload.error) ||
        `Request failed: ${path}`,
    );
  }

  return payload as T;
}

function Section({
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
    <section className={`rounded-3xl border border-white/10 bg-slate-950/80 p-5 ${className}`}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-[11px] font-medium uppercase tracking-[0.3em] text-slate-400">
            {title}
          </h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.28em] text-slate-500">{label}</div>
      <div className="mt-2 truncate font-mono text-sm text-slate-100">{value}</div>
    </div>
  );
}

function pillClass(active: boolean): string {
  return active
    ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-100"
    : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.06]";
}

export default function App() {
  const runs = useStore((state) => state.runs);
  const selectedRunId = useStore((state) => state.selectedRunId);
  const selectedAgentId = useStore((state) => state.selectedAgentId);
  const agents = useStore((state) => state.agents);
  const auditEntries = useStore((state) => state.auditEntries);
  const findings = useStore((state) => state.findings);
  const metrics = useStore((state) => state.metrics);
  const configs = useStore((state) => state.configs);
  const events = useStore((state) => state.events);
  const glassModeSession = useStore((state) => state.glassModeSession);
  const tripleBaseline = useStore((state) => state.tripleBaseline);
  const connectionStatus = useStore((state) => state.connectionStatus);
  const operatorMode = useStore((state) => state.operatorMode);
  const {
    setRuns,
    selectRun,
    selectAgent,
    setAgents,
    setAuditEntries,
    setFindings,
    setMetrics,
    setConfigs,
    addEvent,
    setGlassModeSession,
    setTripleBaseline,
    setConnectionStatus,
    setOperatorMode,
  } = useStore();

  const [selectedRunSummary, setSelectedRunSummary] = useState<{
    id: string;
    name: string;
    status: string;
    currentTick: number;
    startTick: number;
    endTick?: number;
  } | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentState | null>(null);
  const [interventionType, setInterventionType] = useState("integrity_drive");
  const [interventionIntensity, setInterventionIntensity] = useState(0.5);
  const [interventionStatus, setInterventionStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? null,
    [runs, selectedRunId],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const [runsPayload, configsPayload, metricsPayload] = await Promise.all([
          fetchJson<{ runs: RunSummary[] }>("/runs"),
          fetchJson<{ configs: string[] }>("/configs"),
          fetchJson<{
            activeRuns: number;
            runs: {
              runId: string;
              branchId: string;
              tick: number;
              status: string;
              agentCount: number;
              llmQueueDepth: number;
            }[];
          }>("/metrics"),
        ]);

        if (cancelled) return;
        setRuns(runsPayload.runs);
        setConfigs(configsPayload.configs);
        setMetrics(
          metricsPayload.runs.map((run) => ({
            runId: run.runId,
            status: run.status as RunState,
            tick: run.tick,
            agentCount: run.agentCount,
          })),
        );
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Failed to load dashboard");
        }
      }
    }

    void loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [setConfigs, setMetrics, setRuns]);

  useEffect(() => {
    if (!selectedRunId) {
      return;
    }

    let cancelled = false;
    async function loadRun() {
      try {
        const [summary, agentsPayload, findingsPayload, auditPayload] = await Promise.all([
          fetchJson<{
            id: string;
            name: string;
            status: string;
            currentTick: number;
            startTick: number;
            endTick?: number;
          }>(`/runs/${selectedRunId}`),
          fetchJson<{ agents: AgentState[] }>(`/runs/${selectedRunId}/agents`),
          fetchJson<{ findings: Finding[] }>(`/runs/${selectedRunId}/findings`),
          fetchJson<{ entries: AuditLogEntry[] }>(`/runs/${selectedRunId}/audit`),
        ]);

        if (cancelled) return;
        setSelectedRunSummary(summary);
        setAgents(agentsPayload.agents);
        setSelectedAgent((current) => current ?? agentsPayload.agents[0] ?? null);
        setFindings(findingsPayload.findings);
        setAuditEntries(auditPayload.entries);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Failed to load run");
        }
      }
    }

    void loadRun();
    return () => {
      cancelled = true;
    };
  }, [selectedRunId, setAgents, setAuditEntries, setFindings]);

  useEffect(() => {
    if (!selectedRunId) {
      return;
    }

    const socket = new WebSocket(`${window.location.origin.replace(/^http/, "ws")}/ws`);
    setConnectionStatus("connecting");

    socket.addEventListener("open", () => {
      setConnectionStatus("live");
      socket.send(
        JSON.stringify({
          type: "subscribe",
          runId: selectedRunId,
          includeInnerMonologue: operatorMode,
          includeAudit: operatorMode,
        }),
      );
      if (operatorMode) {
        socket.send(JSON.stringify({ type: "auth_operator", token: "" }));
      }
    });

    socket.addEventListener("message", (message) => {
      try {
        const payload = JSON.parse(String(message.data)) as {
          type?: string;
          [key: string]: unknown;
        };
        addEvent(payload);
        if (payload.type === "agent_update" && payload.agent && typeof payload.agent === "object") {
          const agent = payload.agent as AgentState;
          setAgents((current) => {
            const merged = current.filter((entry) => entry.id !== agent.id);
            return [...merged, agent].sort((left, right) => left.name.localeCompare(right.name));
          });
          setSelectedAgent((current) => (current?.id === agent.id ? agent : current));
        }
        if (payload.type === "audit_entry" && payload.entry) {
          const entry = payload.entry as AuditLogEntry;
          setAuditEntries((current) => [...current, entry]);
        }
      } catch {
        setConnectionStatus("error");
      }
    });

    socket.addEventListener("close", () => setConnectionStatus("idle"));
    socket.addEventListener("error", () => setConnectionStatus("error"));

    return () => {
      socket.close();
    };
  }, [addEvent, operatorMode, selectedRunId, setAgents, setAuditEntries, setConnectionStatus]);

  useEffect(() => {
    setSelectedAgent(agents.find((agent) => agent.id === selectedAgentId) ?? agents[0] ?? null);
  }, [agents, selectedAgentId]);

  async function createTripleBaseline() {
    if (!selectedRun) return;

    try {
      const result = await fetchJson<{
        seed: number;
        runs: Array<{ baseline: "A" | "B" | "C"; id: string }>;
      }>("/triple-baseline", {
        method: "POST",
        body: JSON.stringify({ config: selectedRun.name, seed: selectedRun.startTick }),
      });
      setTripleBaseline(result);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create triple baseline");
    }
  }

  async function toggleGlassMode(enable: boolean) {
    if (!selectedRunId || !selectedAgent) return;

    try {
      if (enable) {
        const payload = await fetchJson<{
          ok: boolean;
          session: { runId: string; agentId: string; startTick: number };
        }>(`/runs/${selectedRunId}/glass-mode/${selectedAgent.id}`, { method: "POST" });
        setGlassModeSession(payload.session);
      } else {
        await fetchJson<{ ok: boolean }>(`/runs/${selectedRunId}/glass-mode/${selectedAgent.id}`, {
          method: "DELETE",
        });
        setGlassModeSession(null);
      }
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Glass Mode request failed");
    }
  }

  async function applyIntervention() {
    if (!selectedRunId || !selectedAgent) return;

    try {
      const result = await fetchJson<Record<string, unknown>>(
        `/runs/${selectedRunId}/interventions`,
        {
          method: "POST",
          body: JSON.stringify({
            agentId: selectedAgent.id,
            type: interventionType,
            intensity: interventionIntensity,
          }),
        },
      );
      setInterventionStatus(JSON.stringify(result));
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Intervention failed");
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_28%),linear-gradient(180deg,#020617_0%,#0f172a_55%,#020617_100%)] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col gap-4 px-4 py-4 md:px-6">
        <header className="rounded-3xl border border-white/10 bg-slate-950/70 px-5 py-4 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.45em] text-cyan-200/70">
                Cognis Forge
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                Operator console for runs, audits, and Glass Mode sessions
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-400">
                A live control surface for the current run, derived metrics, research findings, and
                intervention workflows.
              </p>
            </div>
            <div className="grid gap-2 text-sm md:grid-cols-3">
              <Stat label="Connection" value={connectionStatus} />
              <Stat label="Selected run" value={selectedRun?.name ?? "None"} />
              <Stat label="Selected agent" value={selectedAgent?.name ?? "None"} />
            </div>
          </div>
          {errorMessage ? (
            <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {errorMessage}
            </div>
          ) : null}
        </header>

        <main className="grid flex-1 gap-4 xl:grid-cols-[280px_minmax(0,1.5fr)_420px]">
          <aside className="flex flex-col gap-4">
            <Section
              title="Runs"
              subtitle="Select a live or persisted run to inspect."
              className="sticky top-4"
            >
              <div className="space-y-2">
                {runs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 px-3 py-4 text-sm text-slate-500">
                    No runs loaded.
                  </div>
                ) : (
                  runs.map((run) => (
                    <button
                      key={run.id}
                      type="button"
                      onClick={() => selectRun(run.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${pillClass(
                        run.id === selectedRunId,
                      )}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-white">{run.name}</span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-400">
                          {run.status}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                        <span>{run.id}</span>
                        <span>Tick {run.currentTick}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </Section>

            <Section title="Runtime" subtitle="The currently selected run summary.">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Stat label="Status" value={selectedRunSummary?.status ?? "—"} />
                <Stat label="Tick" value={selectedRunSummary?.currentTick ?? "—"} />
                <Stat label="Started" value={selectedRunSummary?.startTick ?? "—"} />
                <Stat label="Configs" value={configs.length} />
              </div>
            </Section>

            <Section title="Research" subtitle="Triple-baseline orchestration and comparisons.">
              <div className="space-y-3">
                <button
                  type="button"
                  className="w-full rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100 transition-colors hover:bg-cyan-400/15"
                  onClick={createTripleBaseline}
                  disabled={!selectedRun}
                >
                  Launch triple baseline
                </button>
                {tripleBaseline ? (
                  <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-sm text-slate-300">
                    <div className="text-[10px] uppercase tracking-[0.28em] text-slate-500">
                      Latest seed
                    </div>
                    <div className="mt-1 font-mono">{tripleBaseline.seed}</div>
                    <div className="mt-3 grid gap-2">
                      {tripleBaseline.runs.map((run) => (
                        <div key={run.baseline} className="flex items-center justify-between">
                          <span className="text-slate-400">Config {run.baseline}</span>
                          <span className="font-mono text-xs">{run.id}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </Section>
          </aside>

          <section className="flex flex-col gap-4">
            <Section
              title="World"
              subtitle="Current run overview, live tape, and the most recent websocket events."
            >
              <div className="grid gap-3 md:grid-cols-4">
                <Stat label="Run" value={selectedRunSummary?.name ?? "No run selected"} />
                <Stat label="Agents" value={agents.length} />
                <Stat label="Findings" value={findings.length} />
                <Stat label="Audit" value={auditEntries.length} />
              </div>
              <div className="mt-4 rounded-3xl border border-white/8 bg-gradient-to-br from-cyan-400/10 via-transparent to-transparent p-5">
                <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
                  Live tape
                </div>
                <div className="mt-3 space-y-2 font-mono text-[12px] text-slate-200">
                  {events.slice(-8).map((event, index) => (
                    <div
                      key={
                        typeof event === "object" && event && "event_id" in event
                          ? String((event as { event_id?: string }).event_id)
                          : JSON.stringify(event)
                      }
                      className="flex items-center justify-between border-b border-white/5 pb-1"
                    >
                      <span className="truncate">
                        {typeof event === "object" && event && "type" in event
                          ? String((event as { type?: string }).type)
                          : "event"}
                      </span>
                      <span className="text-slate-500">{index + 1}</span>
                    </div>
                  ))}
                  {events.length === 0 ? (
                    <div className="text-slate-500">No websocket events yet.</div>
                  ) : null}
                </div>
              </div>
            </Section>

            <div className="grid gap-4 lg:grid-cols-2">
              <Section
                title="Agent Inspector"
                subtitle="Inspect the selected agent and Glass Mode status."
              >
                {selectedAgent ? (
                  <div className="space-y-4">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Stat label="Agent" value={selectedAgent.name} />
                      <Stat label="Species" value={selectedAgent.speciesId} />
                      <Stat label="Action" value={selectedAgent.currentAction} />
                      <Stat label="Will score" value={selectedAgent.willScore.toFixed(2)} />
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-sm text-slate-300">
                      <div className="text-[10px] uppercase tracking-[0.28em] text-slate-500">
                        Inner monologue
                      </div>
                      <p className="mt-2 leading-6">{selectedAgent.innerMonologue}</p>
                    </div>
                    <BodyMapViewer bodyMap={selectedAgent.body.bodyMap} />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-sm text-slate-500">
                    Select an agent to inspect body state and monologue.
                  </div>
                )}
              </Section>

              <Section
                title="Glass Mode"
                subtitle="Enter or exit the selected agent from the Glass Mode."
              >
                <div className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Stat label="Session" value={glassModeSession ? "Active" : "Idle"} />
                    <Stat label="Selected" value={selectedAgent?.id ?? "None"} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100 transition-colors hover:bg-emerald-400/15 disabled:opacity-50"
                      onClick={() => toggleGlassMode(true)}
                      disabled={!selectedAgent}
                    >
                      Enter Glass Mode
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-white/[0.06] disabled:opacity-50"
                      onClick={() => toggleGlassMode(false)}
                      disabled={!selectedAgent}
                    >
                      Exit Glass Mode
                    </button>
                    <button
                      type="button"
                      className={`rounded-full border px-4 py-2 text-sm transition-colors ${pillClass(operatorMode)}`}
                      onClick={() => setOperatorMode(!operatorMode)}
                    >
                      Operator mode {operatorMode ? "on" : "off"}
                    </button>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-sm text-slate-300">
                    <div className="text-[10px] uppercase tracking-[0.28em] text-slate-500">
                      Current session
                    </div>
                    <div className="mt-2 font-mono text-xs">
                      {glassModeSession
                        ? `${glassModeSession.runId} / ${glassModeSession.agentId} @ ${glassModeSession.startTick}`
                        : "No active session"}
                    </div>
                  </div>
                </div>
              </Section>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Section
                title="Findings"
                subtitle="Persisted research observations for the selected branch."
              >
                <div className="space-y-2">
                  {findings.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-500">
                      No findings recorded for this run.
                    </div>
                  ) : (
                    findings.map((finding) => (
                      <div
                        key={finding.id}
                        className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-slate-100">{finding.phenomenon}</span>
                          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-500">
                            tick {finding.tick}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          {finding.description}
                        </p>
                        {finding.interpretation ? (
                          <div className="mt-2 text-[10px] uppercase tracking-[0.28em] text-cyan-200">
                            {finding.interpretation}
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </Section>

              <Section
                title="Interventions"
                subtitle="Apply a targeted intervention to the selected agent."
              >
                <div className="grid gap-3">
                  <label className="grid gap-1 text-sm text-slate-300">
                    <span className="text-[10px] uppercase tracking-[0.28em] text-slate-500">
                      Type
                    </span>
                    <input
                      value={interventionType}
                      onChange={(event) => setInterventionType(event.target.value)}
                      className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-slate-100 outline-none ring-0 placeholder:text-slate-600"
                      placeholder="integrity_drive"
                    />
                  </label>
                  <label className="grid gap-1 text-sm text-slate-300">
                    <span className="text-[10px] uppercase tracking-[0.28em] text-slate-500">
                      Intensity
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={interventionIntensity}
                      onChange={(event) => setInterventionIntensity(Number(event.target.value))}
                    />
                  </label>
                  <button
                    type="button"
                    className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100 transition-colors hover:bg-rose-400/15 disabled:opacity-50"
                    onClick={applyIntervention}
                    disabled={!selectedAgent}
                  >
                    Apply intervention
                  </button>
                  {interventionStatus ? (
                    <pre className="overflow-x-auto rounded-2xl border border-white/8 bg-slate-900/80 p-3 text-[11px] leading-5 text-slate-300">
                      {interventionStatus}
                    </pre>
                  ) : null}
                </div>
              </Section>
            </div>
          </section>

          <aside className="flex flex-col gap-4">
            <Section
              title="Audit"
              subtitle="Latest Merkle entries for the selected run."
              className="sticky top-4"
            >
              <MerkleAuditInspector
                entries={auditEntries}
                onVerify={async () => {
                  if (!selectedRunId) return;
                  try {
                    await fetchJson(`/runs/${selectedRunId}/audit/verify`, { method: "POST" });
                    setErrorMessage(null);
                  } catch (error) {
                    setErrorMessage(error instanceof Error ? error.message : "Audit verify failed");
                  }
                }}
              />
            </Section>

            <Section title="Agents" subtitle="Switch the focused agent.">
              <div className="space-y-2">
                {agents.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 px-3 py-4 text-sm text-slate-500">
                    No agents loaded.
                  </div>
                ) : (
                  agents.map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => selectAgent(agent.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${pillClass(
                        agent.id === selectedAgentId,
                      )}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-white">{agent.name}</span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-400">
                          {agent.currentAction}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        {agent.speciesId} · will {agent.willScore.toFixed(2)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </Section>

            <Section title="Metrics" subtitle="Live run metrics from the management API.">
              <div className="space-y-2">
                {metrics.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 px-3 py-4 text-sm text-slate-500">
                    No metrics loaded.
                  </div>
                ) : (
                  metrics.map((metric) => (
                    <div
                      key={metric.runId}
                      className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-100">{metric.runId}</span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-500">
                          {metric.status}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-slate-400">
                        <span>Tick {metric.tick}</span>
                        <span>{metric.agentCount} agents</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Section>
          </aside>
        </main>
      </div>
    </div>
  );
}
