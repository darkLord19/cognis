import { useEffect, useMemo, useState } from "react";
import type { AgentState, AuditLogEntry, Finding, RunState } from "../shared/types";
import { BodyMapViewer } from "./forge/BodyMapViewer";
import { CreateRunList, RunControl } from "./forge/RunControl";
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

export default function App() {
  const runs = useStore((state) => state.runs);
  const selectedRunId = useStore((state) => state.selectedRunId);
  const selectedAgentId = useStore((state) => state.selectedAgentId);
  const agents = useStore((state) => state.agents);
  const auditEntries = useStore((state) => state.auditEntries);
  const findings = useStore((state) => state.findings);
  const configs = useStore((state) => state.configs);
  const events = useStore((state) => state.events);
  const connectionStatus = useStore((state) => state.connectionStatus);
  const operatorMode = useStore((state) => state.operatorMode);
  const monologuesByAgent = useStore((state) => state.monologuesByAgent);
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
    setGlassRoomSession,
    setConnectionStatus,
    setOperatorMode,
    appendMonologue,
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
  const [interventionIntensity] = useState(0.5);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? null,
    [runs, selectedRunId],
  );

  const feedItems = useMemo(() => {
    const items: Array<{
      id: string;
      tick: number;
      type: "event" | "finding" | "audit";
      label: string;
      content: string;
      meta?: string | undefined;
    }> = [];

    const formatEventLabel = (type: string) => {
      return type.replace(/_/g, " ").toUpperCase();
    };

    const formatEventContent = (type: string, payload: Record<string, unknown> | undefined) => {
      if (!payload) return "";

      const p = payload as Record<string, string | number | undefined>;

      switch (type) {
        case "utterance":
          return `"${p.text}"`;
        case "tech_discovered":
          return `Invention of ${(p.techId as string)?.replace(/_/g, " ")}`;
        case "agent_born":
          return `New life detected: ${p.name || "Unnamed"}`;
        case "agent_died":
          return `Host expiration: ${p.reason || "Unknown causes"}`;
        case "memory_encoded":
          return `New cognitive imprint: ${(p.qualia as string)?.substring(0, 50)}...`;
        case "proto_word_coined":
          return `Linguistic emergence: "${p.word}" for ${p.meaning}`;
        case "intervention_applied":
          return `External influence: ${p.type} at ${Math.round((p.intensity as number) * 100)}%`;
        case "glass_room_entered":
          return "Diagnostic isolation initiated";
        case "glass_room_exited":
          return "Diagnostic isolation terminated";
        default:
          return JSON.stringify(payload).substring(0, 100);
      }
    };

    for (const rawEvent of events) {
      if (typeof rawEvent !== "object" || rawEvent === null) continue;

      const wrapper = rawEvent as {
        type: string;
        event?: {
          type: string;
          event_id?: string;
          tick?: number;
          agent_id?: string;
          payload?: Record<string, unknown>;
        };
        agent?: unknown;
      };

      // Handle wrapped simulation events
      if (wrapper.type === "event" && wrapper.event) {
        const e = wrapper.event;
        const noisyTypes = ["tick", "voxel_changed", "element_spread", "circadian_phase_changed"];
        if (noisyTypes.includes(e.type)) continue;

        // Filter by selected agent if applicable
        if (selectedAgentId && e.agent_id !== selectedAgentId) continue;

        items.push({
          id: e.event_id || Math.random().toString(),
          tick: e.tick || 0,
          type: "event",
          label: formatEventLabel(e.type),
          content: formatEventContent(e.type, e.payload),
          meta: e.agent_id,
        });
      }
    }

    // Findings are global, but we filter them if an agent is selected to keep the feed clean
    if (!selectedAgentId) {
      for (const finding of findings) {
        items.push({
          id: finding.id,
          tick: finding.tick,
          type: "finding",
          label: "EMERGENCE",
          content: finding.description,
          meta: finding.phenomenon,
        });
      }
    }

    for (const entry of auditEntries.slice(-50)) {
      // Filter by selected agent if applicable
      if (selectedAgentId && entry.agent_id !== selectedAgentId) continue;

      const auditContent =
        entry.field === "innerMonologue"
          ? (entry.new_value || "null")
          : `${entry.field}: ${entry.old_value || "null"} -> ${entry.new_value || "null"}`;

      items.push({
        id: String(entry.id),
        tick: entry.tick,
        type: "audit",
        label: "AUDIT",
        content: auditContent,
        meta: entry.agent_id || "System",
      });
    }

    return items.sort((a, b) => b.tick - a.tick || 0).slice(0, 100);
  }, [events, findings, auditEntries, selectedAgentId]);

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
          if (agent.innerMonologue) {
            appendMonologue(agent.id, Number(payload.tick) || Date.now(), agent.innerMonologue);
          }
          setAgents((current) => {
            const merged = current.filter((entry) => entry.id !== agent.id);
            return [...merged, agent].sort((left, right) => left.name.localeCompare(right.name));
          });
          setSelectedAgent((current) => (current?.id === agent.id ? agent : current));
        }
        if (payload.type === "inner_monologue") {
          const agentId = String(payload.agentId || "");
          const text = String(payload.innerMonologue || "");
          const tick = Number(payload.tick) || Date.now();
          if (agentId && text) {
            appendMonologue(agentId, tick, text);
          }
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
  }, [
    addEvent,
    appendMonologue,
    operatorMode,
    selectedRunId,
    setAgents,
    setAuditEntries,
    setConnectionStatus,
  ]);

  useEffect(() => {
    setSelectedAgent(agents.find((agent) => agent.id === selectedAgentId) ?? agents[0] ?? null);
  }, [agents, selectedAgentId]);

  async function toggleGlassRoom(enable: boolean) {
    if (!selectedRunId || !selectedAgent) return;

    try {
      if (enable) {
        const payload = await fetchJson<{
          ok: boolean;
          session: { runId: string; agentId: string; startTick: number };
        }>(`/runs/${selectedRunId}/glass-room/${selectedAgent.id}`, { method: "POST" });
        setGlassRoomSession(payload.session);
      } else {
        await fetchJson<{ ok: boolean }>(`/runs/${selectedRunId}/glass-room/${selectedAgent.id}`, {
          method: "DELETE",
        });
        setGlassRoomSession(null);
      }
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Glass Room request failed");
    }
  }

  const selectedMonologues = selectedAgent ? monologuesByAgent[selectedAgent.id] ?? [] : [];
  const latestMonologue =
    selectedMonologues[selectedMonologues.length - 1]?.text || selectedAgent?.innerMonologue || "";

  async function applyIntervention() {
    if (!selectedRunId || !selectedAgent) return;

    try {
      await fetchJson<Record<string, unknown>>(`/runs/${selectedRunId}/interventions`, {
        method: "POST",
        body: JSON.stringify({
          agentId: selectedAgent.id,
          type: interventionType,
          intensity: interventionIntensity,
        }),
      });
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Intervention failed");
    }
  }

  async function handleStart(runId: string) {
    try {
      await fetchJson(`/runs/${runId}/start`, { method: "POST" });
      const runsPayload = await fetchJson<{ runs: RunSummary[] }>("/runs");
      setRuns(runsPayload.runs);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to start run");
    }
  }

  async function handlePause(runId: string) {
    try {
      await fetchJson(`/runs/${runId}/pause`, { method: "POST" });
      const runsPayload = await fetchJson<{ runs: RunSummary[] }>("/runs");
      setRuns(runsPayload.runs);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to pause run");
    }
  }

  async function handleStop(runId: string) {
    try {
      await fetchJson(`/runs/${runId}/stop`, { method: "POST" });
      const runsPayload = await fetchJson<{ runs: RunSummary[] }>("/runs");
      setRuns(runsPayload.runs);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to stop run");
    }
  }

  async function handleCreate(config: string) {
    try {
      const run = await fetchJson<{ id: string }>("/runs", {
        method: "POST",
        body: JSON.stringify({ config }),
      });
      const runsPayload = await fetchJson<{ runs: RunSummary[] }>("/runs");
      setRuns(runsPayload.runs);
      selectRun(run.id);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create run");
    }
  }

  return (
    <div className="flex h-screen flex-col bg-[#02040a] text-slate-200 selection:bg-amber-500/30 font-light">
      {/* GLOBAL HEADER: DELOS STYLE */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/[0.03] bg-black/40 px-8 backdrop-blur-2xl">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-[0.5em] text-amber-200/70">
              Cognis Project
            </span>
            <span className="text-[9px] font-medium tracking-[0.2em] text-slate-500 uppercase">
              Host Supervision Console
            </span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-6 text-[11px] tracking-wider">
            <div className="flex items-center gap-2">
              <div
                className={`h-1 w-1 rounded-full ${connectionStatus === "live" ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]" : "bg-slate-700"}`}
              />
              <span className="font-medium text-slate-400 uppercase tracking-widest">
                {connectionStatus}
              </span>
            </div>
            {selectedRunSummary && (
              <div className="flex items-center gap-6 border-l border-white/5 pl-6">
                <span className="text-slate-500 uppercase tracking-widest">
                  Sector: <span className="text-slate-200">{selectedRunSummary.name}</span>
                </span>
                <span className="text-slate-500 uppercase tracking-widest">
                  Cycle:{" "}
                  <span className="font-mono text-amber-200/80">
                    {selectedRunSummary.currentTick}
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6">
          <RunControl
            selectedRun={selectedRun}
            onStart={handleStart}
            onPause={handlePause}
            onStop={handleStop}
          />
          <button
            type="button"
            className={`flex h-8 items-center gap-2 rounded-full border border-white/10 px-5 text-[10px] font-bold uppercase tracking-[0.2em] transition-all ${operatorMode ? "bg-amber-400/10 text-amber-200 border-amber-400/30" : "bg-white/5 text-slate-500"}`}
            onClick={() => setOperatorMode(!operatorMode)}
          >
            {operatorMode ? "Admin Access" : "Restricted"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT SIDEBAR: THE MAP */}
        <aside className="flex w-72 flex-col border-r border-white/[0.03] bg-black/20">
          <div className="flex-1 overflow-y-auto p-6 space-y-10">
            <div>
              <h3 className="mb-4 px-2 text-[9px] font-bold uppercase tracking-[0.3em] text-slate-600">
                Simulations
              </h3>
              <div className="space-y-1">
                {runs.map((run) => (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => selectRun(run.id)}
                    className={`flex w-full flex-col gap-1 rounded-xl px-3 py-3 text-left transition-all ${run.id === selectedRunId ? "bg-white/5 text-white ring-1 ring-white/10" : "text-slate-500 hover:text-slate-300"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[11px] tracking-wide truncate">
                        {run.name}
                      </span>
                      <span className="font-mono text-[8px] opacity-40 uppercase">
                        {run.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-4 px-2 text-[9px] font-bold uppercase tracking-[0.3em] text-slate-600">
                Initialize
              </h3>
              <CreateRunList configs={configs} onCreate={handleCreate} />
            </div>

            <div>
              <h3 className="mb-4 px-2 text-[9px] font-bold uppercase tracking-[0.3em] text-slate-600">
                Active Hosts ({agents.length})
              </h3>
              <div className="space-y-1">
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => selectAgent(agent.id)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all ${agent.id === selectedAgentId ? "bg-amber-400/5 text-amber-100 ring-1 ring-amber-400/20" : "text-slate-500 hover:text-slate-300"}`}
                  >
                    <span className="text-[11px] tracking-wide truncate">{agent.name}</span>
                    <span className="text-[9px] font-mono opacity-30 uppercase">
                      {agent.currentAction}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN AREA: NARRATIVE LEDGER */}
        <main className="flex flex-1 flex-col bg-black/10">
          <div className="flex items-center justify-between border-b border-white/[0.03] bg-white/[0.01] px-8 py-4">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-500">
              Narrative Ledger
            </h2>
            <div className="flex gap-6 text-[9px] text-slate-600 uppercase tracking-[0.2em] font-medium">
              <span>{findings.length} Emergence</span>
              <span>{events.length} Data Points</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scroll-smooth">
            <div className="mx-auto max-w-3xl space-y-px p-8">
              {feedItems.map((item) => (
                <div key={item.id} className="group relative flex gap-8 pb-8 last:pb-0">
                  <div className="absolute left-3 top-0 h-full w-px bg-white/[0.03] group-last:h-4" />
                  <div
                    className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-white/10 bg-slate-950 text-[9px] font-mono ${item.type === "finding" ? "border-amber-400/50 text-amber-200" : item.type === "audit" ? "border-slate-400/50 text-slate-300" : "text-slate-600"}`}
                  >
                    {item.tick}
                  </div>
                  <div className="flex-1 pt-0.5">
                    <div className="flex items-center gap-4">
                      <span
                        className={`text-[9px] font-bold uppercase tracking-[0.3em] ${item.type === "finding" ? "text-amber-200/70" : item.type === "audit" ? "text-slate-400" : "text-slate-600"}`}
                      >
                        {item.label}
                      </span>
                      {item.meta && (
                        <span className="text-[9px] text-slate-700 font-mono tracking-wider truncate uppercase">
                          {item.meta}
                        </span>
                      )}
                    </div>
                    <p
                      className={`mt-3 text-[13px] leading-relaxed tracking-wide ${item.type === "finding" ? "text-slate-200 font-normal" : "text-slate-500"}`}
                    >
                      {item.content}
                    </p>
                  </div>
                </div>
              ))}
              {feedItems.length === 0 && (
                <div className="flex h-64 items-center justify-center text-slate-700 uppercase tracking-[0.3em] text-[10px]">
                  Awaiting Host Activity...
                </div>
              )}
            </div>
          </div>
        </main>

        {/* RIGHT SIDEBAR: THE SUBJECT */}
        <aside className="flex w-[400px] flex-col border-l border-white/[0.03] bg-black/20">
          {selectedAgent ? (
            <div className="flex-1 overflow-y-auto p-8 space-y-12">
              <header>
                <div className="text-[9px] font-bold uppercase tracking-[0.4em] text-amber-200/60">
                  Host Profile
                </div>
                <h2 className="mt-3 text-3xl font-light text-white tracking-tight">
                  {selectedAgent.name}
                </h2>
                <div className="mt-4 flex gap-4 text-[10px] text-slate-500 uppercase tracking-[0.2em] font-medium">
                  <span>{selectedAgent.speciesId}</span>
                  <span className="opacity-20">|</span>
                  <span>Integrity: {selectedAgent.body.integrityDrive.toFixed(2)}</span>
                </div>
              </header>

              <div className="space-y-5">
                <div className="text-[9px] font-bold uppercase tracking-[0.4em] text-slate-600">
                  Cognitive Stream
                </div>
                <div className="rounded-2xl border border-white/[0.03] bg-white/[0.02] p-6 text-[14px] leading-relaxed text-slate-400 font-light italic">
                  "{latestMonologue}"
                </div>
              </div>

              <div className="space-y-5">
                <div className="text-[9px] font-bold uppercase tracking-[0.4em] text-slate-600">
                  Biometric Map
                </div>
                <div className="rounded-3xl border border-white/[0.03] bg-white/[0.01] p-2">
                  <BodyMapViewer bodyMap={selectedAgent.body.bodyMap} />
                </div>
              </div>

              {operatorMode && (
                <div className="space-y-10 pt-8 border-t border-white/[0.05]">
                  <div className="space-y-4">
                    <div className="text-[9px] font-bold uppercase tracking-[0.4em] text-rose-500/70">
                      Subconscious Intervention
                    </div>
                    <div className="grid gap-3">
                      <input
                        value={interventionType}
                        onChange={(e) => setInterventionType(e.target.value)}
                        className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-2.5 text-[11px] outline-none focus:border-amber-400/30 transition-colors"
                        placeholder="Incept Concept..."
                      />
                      <button
                        type="button"
                        onClick={applyIntervention}
                        className="rounded-xl bg-rose-500/5 border border-rose-500/20 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        Adjust Drive
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="text-[9px] font-bold uppercase tracking-[0.4em] text-emerald-500/70">
                      Diagnostic Environment
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => toggleGlassRoom(true)}
                        className="flex-1 rounded-xl bg-emerald-500/5 border border-emerald-500/20 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                      >
                        Enter
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleGlassRoom(false)}
                        className="flex-1 rounded-xl border border-white/5 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 hover:bg-white/5 transition-colors"
                      >
                        Exit
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-12 text-center">
              <div className="text-[10px] uppercase tracking-[0.5em] text-slate-700 font-bold">
                Select Subject
              </div>
              <div className="mt-4 h-px w-8 bg-slate-800" />
            </div>
          )}
        </aside>
      </div>

      {/* SYSTEM NOTIFICATIONS */}
      {errorMessage && (
        <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-full border border-rose-500/30 bg-[#1a0505] px-8 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-rose-300 shadow-2xl backdrop-blur-xl ring-1 ring-rose-500/20">
          Alert: {errorMessage}
        </div>
      )}
    </div>
  );
}
