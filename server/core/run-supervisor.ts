import type { AgentState, RunState, WorldConfig } from "../../shared/types";
import type { VoxelGrid } from "../world/voxel-grid";
import type { EventBus } from "./event-bus";
import type { Orchestrator } from "./orchestrator";
import { RunStateStore } from "./run-state-store";
import type { SimClock } from "./sim-clock";

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

type RunSupervisorEvent =
  | { type: "registered"; runtime: RunRuntime }
  | { type: "stopped"; runId: string }
  | { type: "shutdown" };

export class RunSupervisor {
  private runtimes: Map<string, RunRuntime> = new Map();
  private listeners: Set<(event: RunSupervisorEvent) => void> = new Set();

  registerRuntime(runtime: RunRuntime): RunRuntime {
    this.runtimes.set(runtime.runId, runtime);
    this.emit({ type: "registered", runtime });
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
    this.emit({ type: "stopped", runId });
  }

  shutdownAll(): void {
    for (const runtime of this.runtimes.values()) {
      runtime.clock.pause();
      runtime.status = "stopped";
      RunStateStore.record(runtime.runId, "stopped", runtime.clock.getTick());
    }
    this.runtimes.clear();
    this.emit({ type: "shutdown" });
  }

  onRuntimeEvent(listener: (event: RunSupervisorEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: RunSupervisorEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
