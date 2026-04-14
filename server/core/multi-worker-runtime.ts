import type { AgentState } from "../../shared/types";
import { SharedAgentState, toSnapshot } from "./shared-agent-state";

type WorkerReport = {
  physics: { activeCount: number; centroid: [number, number, number] };
  cognition: { urgentCount: number; avgIntegrity: number };
  analysis: { spread: number; stressMean: number };
};

type PhaseName = keyof WorkerReport;

function createWorker(path: string): Worker {
  return new Worker(new URL(path, import.meta.url).href, { type: "module" });
}

export class MultiWorkerRuntime {
  private readonly sharedState: SharedAgentState;
  private readonly physicsWorker: Worker | null;
  private readonly cognitionWorker: Worker | null;
  private readonly analysisWorker: Worker | null;
  private readonly readyPromise: Promise<void> | null;
  private available = true;

  constructor(capacity: number) {
    this.sharedState = new SharedAgentState(capacity);
    try {
      this.physicsWorker = createWorker("../workers/physics.worker.ts");
      this.cognitionWorker = createWorker("../workers/cognition.worker.ts");
      this.analysisWorker = createWorker("../workers/analysis.worker.ts");
      this.readyPromise = this.initializeWorkers();
    } catch (error) {
      this.available = false;
      this.readyPromise = null;
      console.warn("Multi-worker runtime unavailable; falling back to inline pipeline.", error);
      this.physicsWorker = null;
      this.cognitionWorker = null;
      this.analysisWorker = null;
    }
  }

  public isAvailable(): boolean {
    return this.available;
  }

  public syncAgents(agents: AgentState[]): void {
    if (!this.available) return;
    this.sharedState.writeAgents(agents);
  }

  public async runTick(tick: number): Promise<WorkerReport | null> {
    if (!this.available || !this.physicsWorker || !this.cognitionWorker || !this.analysisWorker) {
      return null;
    }

    try {
      await this.readyPromise;
    } catch (error) {
      this.available = false;
      console.warn("Multi-worker initialization failed; disabling worker pipeline.", error);
      return null;
    }

    const requestId = `${tick}-${crypto.randomUUID()}`;
    const [physics, cognition, analysis] = await Promise.all([
      this.dispatch<{ activeCount: number; centroid: [number, number, number] }>(
        this.physicsWorker,
        "physics_done",
        requestId,
        tick,
      ),
      this.dispatch<{ urgentCount: number; avgIntegrity: number }>(
        this.cognitionWorker,
        "cognition_done",
        requestId,
        tick,
      ),
      this.dispatch<{ spread: number; stressMean: number }>(
        this.analysisWorker,
        "analysis_done",
        requestId,
        tick,
      ),
    ]);

    return {
      physics,
      cognition,
      analysis,
    };
  }

  public terminate(): void {
    if (!this.available) return;
    if (!this.physicsWorker || !this.cognitionWorker || !this.analysisWorker) {
      this.available = false;
      return;
    }
    this.physicsWorker.terminate();
    this.cognitionWorker.terminate();
    this.analysisWorker.terminate();
    this.available = false;
  }

  private initializeWorkers(): Promise<void> {
    if (!this.physicsWorker || !this.cognitionWorker || !this.analysisWorker) {
      return Promise.resolve();
    }

    return Promise.all([
      this.awaitReady(this.physicsWorker, "physics"),
      this.awaitReady(this.cognitionWorker, "cognition"),
      this.awaitReady(this.analysisWorker, "analysis"),
    ]).then(() => undefined);
  }

  private dispatch<T extends Record<string, unknown>>(
    worker: Worker,
    doneType: `${PhaseName}_done`,
    requestId: string,
    tick: number,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        worker.removeEventListener("message", onMessage);
        reject(new Error(`Worker phase timed out: ${doneType}`));
      }, 10000);

      const onMessage = (event: MessageEvent<Record<string, unknown>>) => {
        const payload = event.data;
        if (payload.type !== doneType || payload.requestId !== requestId) {
          return;
        }
        clearTimeout(timer);
        worker.removeEventListener("message", onMessage);
        const { type: _type, requestId: _requestId, tick: _tick, ...rest } = payload;
        resolve(rest as T);
      };

      worker.addEventListener("message", onMessage);
      worker.postMessage({
        type: "phase_tick",
        requestId,
        tick,
      });
    });
  }

  private awaitReady(worker: Worker, workerName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        worker.removeEventListener("message", onMessage);
        reject(new Error(`Worker init timed out: ${workerName}`));
      }, 10000);

      const onMessage = (event: MessageEvent<Record<string, unknown>>) => {
        const payload = event.data;
        if (payload.type !== "ready" || payload.worker !== workerName) {
          return;
        }
        clearTimeout(timer);
        worker.removeEventListener("message", onMessage);
        resolve();
      };

      worker.addEventListener("message", onMessage);
      const snapshot = toSnapshot(this.sharedState);
      if (workerName === "physics") {
        worker.postMessage({
          type: "init",
          capacity: snapshot.capacity,
          positionsBuffer: snapshot.positionsBuffer,
          activeBuffer: snapshot.activeBuffer,
        });
        return;
      }

      if (workerName === "cognition") {
        worker.postMessage({
          type: "init",
          capacity: snapshot.capacity,
          bodyBuffer: snapshot.bodyBuffer,
          activeBuffer: snapshot.activeBuffer,
        });
        return;
      }

      worker.postMessage({
        type: "init",
        capacity: snapshot.capacity,
        positionsBuffer: snapshot.positionsBuffer,
        bodyBuffer: snapshot.bodyBuffer,
        activeBuffer: snapshot.activeBuffer,
      });
    });
  }
}
