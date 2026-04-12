import type { AgentState, WorldConfig } from "../../shared/types";
import type { VoxelGrid } from "../world/voxel-grid";
import type { EventBus } from "./event-bus";
import type { Orchestrator } from "./orchestrator";
import type { SimClock } from "./sim-clock";

export interface RunContext {
  runId: string;
  branchId: string;
  config: WorldConfig;
  world: VoxelGrid;
  orchestrator: Orchestrator;
  clock: SimClock;
  eventBus: EventBus;
  agents: AgentState[];
  status: "created" | "running" | "paused" | "stopped";
}

let activeRun: RunContext | null = null;

export const RunContext = {
  set(ctx: RunContext): void {
    activeRun = ctx;
  },

  get(): RunContext | null {
    return activeRun;
  },

  clear(): void {
    activeRun = null;
  },

  isActive(): boolean {
    return activeRun !== null;
  },

  getStatus(): RunContext["status"] {
    return activeRun?.status ?? "stopped";
  },

  updateStatus(status: RunContext["status"]): void {
    if (activeRun) {
      activeRun.status = status;
    }
  },
};
