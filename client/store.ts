import { create } from "zustand";
import type { AgentState, AuditLogEntry, Finding, RunState } from "../shared/types";

export type RunSummary = {
  id: string;
  name: string;
  status: RunState;
  currentTick: number;
  startTick: number;
  endTick?: number;
};

export type ForgeConnectionStatus = "idle" | "connecting" | "live" | "error";

export type TripleBaselineView = {
  seed: number;
  runs: Array<{ baseline: "A" | "B" | "C"; id: string }>;
};

type RuntimeSnapshot = {
  runId: string;
  status: RunState;
  tick: number;
  agentCount: number;
};

interface StoreState {
  runs: RunSummary[];
  selectedRunId: string | null;
  selectedAgentId: string | null;
  agents: AgentState[];
  auditEntries: AuditLogEntry[];
  findings: Finding[];
  metrics: RuntimeSnapshot[];
  configs: string[];
  events: unknown[];
  glassModeSession: { runId: string; agentId: string; startTick: number } | null;
  tripleBaseline: TripleBaselineView | null;
  connectionStatus: ForgeConnectionStatus;
  operatorMode: boolean;
  setRuns: (runs: RunSummary[]) => void;
  selectRun: (runId: string | null) => void;
  selectAgent: (agentId: string | null) => void;
  setAgents: (agents: AgentState[] | ((current: AgentState[]) => AgentState[])) => void;
  setAuditEntries: (
    entries: AuditLogEntry[] | ((current: AuditLogEntry[]) => AuditLogEntry[]),
  ) => void;
  setFindings: (findings: Finding[]) => void;
  setMetrics: (metrics: RuntimeSnapshot[]) => void;
  setConfigs: (configs: string[]) => void;
  addEvent: (event: unknown) => void;
  setGlassModeSession: (session: StoreState["glassModeSession"]) => void;
  setTripleBaseline: (view: TripleBaselineView | null) => void;
  setConnectionStatus: (status: ForgeConnectionStatus) => void;
  setOperatorMode: (enabled: boolean) => void;
}

export const useStore = create<StoreState>((set) => ({
  runs: [],
  selectedRunId: null,
  selectedAgentId: null,
  agents: [],
  auditEntries: [],
  findings: [],
  metrics: [],
  configs: [],
  events: [],
  glassModeSession: null,
  tripleBaseline: null,
  connectionStatus: "idle",
  operatorMode: false,
  setRuns: (runs) =>
    set((state) => ({
      runs,
      selectedRunId: state.selectedRunId ?? runs[0]?.id ?? null,
    })),
  selectRun: (runId) =>
    set(() => ({
      selectedRunId: runId,
      selectedAgentId: null,
    })),
  selectAgent: (agentId) => set(() => ({ selectedAgentId: agentId })),
  setAgents: (agents) =>
    set((state) => {
      const nextAgents = typeof agents === "function" ? agents(state.agents) : agents;
      return {
        agents: nextAgents,
        selectedAgentId:
          state.selectedAgentId && nextAgents.some((agent) => agent.id === state.selectedAgentId)
            ? state.selectedAgentId
            : (nextAgents[0]?.id ?? null),
      };
    }),
  setAuditEntries: (entries) =>
    set((state) => ({
      auditEntries: typeof entries === "function" ? entries(state.auditEntries) : entries,
    })),
  setFindings: (findings) => set({ findings }),
  setMetrics: (metrics) => set({ metrics }),
  setConfigs: (configs) => set({ configs }),
  addEvent: (event) => set((state) => ({ events: [...state.events, event] })),
  setGlassModeSession: (glassModeSession) => set({ glassModeSession }),
  setTripleBaseline: (tripleBaseline) => set({ tripleBaseline }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setOperatorMode: (operatorMode) => set({ operatorMode }),
}));
