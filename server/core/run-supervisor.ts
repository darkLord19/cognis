import type { WorldConfig } from "../../shared/types";
import { EventBus } from "./event-bus";
import { Orchestrator } from "./orchestrator";
import { SimClock } from "./sim-clock";

export interface RunRuntime {
  runId: string;
  branchId: string;
  clock: SimClock;
  eventBus: EventBus;
  orchestrator: Orchestrator;
  worldConfig: WorldConfig;
}

export class RunSupervisor {
  private runtimes: Map<string, RunRuntime> = new Map();

  createRuntime(runId: string, branchId: string, worldConfig: WorldConfig): RunRuntime {
    const eventBus = new EventBus();
    const clock = new SimClock();
    // @ts-expect-error
    const orchestrator = new Orchestrator(worldConfig, {}, clock, eventBus, {}, {});

    const runtime: RunRuntime = {
      runId,
      branchId,
      clock,
      eventBus,
      orchestrator,
      worldConfig,
    };

    this.runtimes.set(runId, runtime);
    return runtime;
  }

  getRuntime(runId: string): RunRuntime | undefined {
    return this.runtimes.get(runId);
  }

  listRuntimes(): RunRuntime[] {
    return Array.from(this.runtimes.values());
  }

  stopRuntime(runId: string): void {
    this.runtimes.delete(runId);
  }
}
