import type { AgentState, RunState, WorldConfig } from "../../shared/types";
import { EventBus } from "./event-bus";
import type { Orchestrator } from "./orchestrator";
import { RunStateStore } from "./run-state-store";
import { SimClock } from "./sim-clock";
import type { VoxelGrid } from "../world/voxel-grid";

export interface RunRuntime {
  runId: string;
  branchId: string;
  clock: SimClock;
  eventBus: EventBus;
  orchestrator: Orchestrator | null;
  worldConfig: WorldConfig;
  world: VoxelGrid | null;
  agents: AgentState[];
  status: RunState;
}

export class RunSupervisor {
  private runtimes: Map<string, RunRuntime> = new Map();

  registerRuntime(runtime: RunRuntime): RunRuntime {
    this.runtimes.set(runtime.runId, runtime);
    return runtime;
  }

  getRuntime(runId: string): RunRuntime | undefined {
    return this.runtimes.get(runId);
  }

  listRuntimes(): RunRuntime[] {
    return Array.from(this.runtimes.values());
  }

  pauseRuntime(runId: string): void {
    const runtime = this.runtimes.get(runId);
    if (!runtime) {
      return;
    }

    runtime.clock.pause();
    runtime.status = "paused";
    RunStateStore.record(runId, "paused", runtime.clock.getTick());
  }

  resumeRuntime(runId: string): void {
    const runtime = this.runtimes.get(runId);
    if (!runtime) {
      return;
    }

    runtime.status = "running";
    RunStateStore.record(runId, "running", runtime.clock.getTick());
    runtime.clock.resume();
  }

  stopRuntime(runId: string): void {
    const runtime = this.runtimes.get(runId);
    if (!runtime) {
      return;
    }

    runtime.clock.pause();
    runtime.status = "stopped";
    RunStateStore.record(runId, "stopped", runtime.clock.getTick());
    this.runtimes.delete(runId);
  }

  shutdownAll(): void {
    for (const runtime of this.runtimes.values()) {
      runtime.clock.pause();
      runtime.status = "stopped";
      RunStateStore.record(runtime.runId, "stopped", runtime.clock.getTick());
    }
    this.runtimes.clear();
  }
}
