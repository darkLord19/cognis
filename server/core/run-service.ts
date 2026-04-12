import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { BranchNode, WorldConfig } from "../../shared/types";
import type { LLMGateway } from "../llm/gateway";
import type { Database } from "../persistence/database";
import { MerkleLogger } from "../persistence/merkle-logger";
import { FindingsJournal } from "../research/findings-journal";
import type { SpeciesRegistry } from "../species/registry";
import { bootstrapSimulation } from "./bootstrap";
import { BranchManager } from "./branch-manager";
import { EventBus } from "./event-bus";
import { RunManager } from "./run-manager";
import { RunStateStore } from "./run-state-store";
import type { RunRuntime, RunSupervisor } from "./run-supervisor";
import { SimClock } from "./sim-clock";
import { WorldConfigManager } from "./world-config-manager";

interface CreateRunRequest {
  config?: string;
  configPath?: string;
  inlineConfig?: WorldConfig;
  name?: string;
  seed?: number;
}

type RunServiceDeps = {
  runSupervisor: RunSupervisor;
  gateway: LLMGateway;
  speciesRegistry: SpeciesRegistry;
  database: Database;
};

const DEFAULT_TIME_CONFIG = {
  elasticHeartbeat: false,
  maxHeartbeatWaitMs: 5000,
  tickDurationMs: 100,
};

export class RunService {
  constructor(private deps: RunServiceDeps) {}

  public createRun(request: CreateRunRequest): {
    id: string;
    status: "created";
    name: string;
    seed: number;
  } {
    const configSource = request.inlineConfig
      ? structuredClone(request.inlineConfig)
      : this.loadConfig(request.config || request.configPath || "earth-default");

    if (!configSource) {
      throw new Error("Config not found");
    }

    if (request.seed !== undefined) {
      configSource.meta.seed = request.seed;
    }

    if (request.name) {
      configSource.meta.name = request.name;
    }

    const configHash = WorldConfigManager.hashWorldConfig(configSource).slice(0, 12);
    const runId = `run-${configSource.meta.seed}-${configHash}`;
    const existing = RunManager.getRun(runId);
    if (!existing) {
      RunManager.createRun(runId, configSource.meta.name, 0, configSource);
      WorldConfigManager.create(configSource, runId, this.deps.database);
      BranchManager.createBranch("main", "main", 0);
      RunStateStore.record(runId, "created", 0);
    }

    return {
      id: runId,
      status: "created",
      name: configSource.meta.name,
      seed: configSource.meta.seed,
    };
  }

  public listRuns() {
    return RunStateStore.listSummaries();
  }

  public getRunSummary(runId: string) {
    const run = RunManager.getRun(runId);
    if (!run) {
      return null;
    }

    const latest = RunStateStore.getLatest(runId);
    return {
      id: run.id,
      name: run.name,
      startTick: run.start_tick,
      ...(run.end_tick === null ? {} : { endTick: run.end_tick }),
      status: latest?.status ?? run.status,
      currentTick: latest?.tick ?? run.current_tick,
    };
  }

  public getConfig(runId: string, branchId = "main", tick?: number): WorldConfig {
    const snapshot = tick ?? RunStateStore.getLatest(runId)?.tick ?? 0;
    return WorldConfigManager.load(runId, branchId, snapshot, this.deps.database);
  }

  public getAgents(runId: string) {
    const runtime = this.deps.runSupervisor.getRuntime(runId);
    if (!runtime?.orchestrator) {
      return [];
    }
    return runtime.orchestrator.getAgents();
  }

  public getHealth() {
    const runtimes = this.deps.runSupervisor.listRuntimes();
    return {
      status: "ok" as const,
      activeRuns: runtimes.length,
      runs: runtimes.map((runtime) => ({
        runId: runtime.runId,
        branchId: runtime.branchId,
        status: runtime.status,
        currentTick: runtime.clock.getTick(),
        agentCount: runtime.agents.length,
      })),
    };
  }

  public getMetrics() {
    const runtimes = this.deps.runSupervisor.listRuntimes();
    return {
      activeRuns: runtimes.length,
      runs: runtimes.map((runtime) => ({
        runId: runtime.runId,
        branchId: runtime.branchId,
        tick: runtime.clock.getTick(),
        status: runtime.status,
        agentCount: runtime.agents.length,
        llmQueueDepth: 0,
      })),
    };
  }

  public listConfigTemplates(): string[] {
    const configDir = join(import.meta.dir, "../../data/world-configs");
    return Array.from(new Bun.Glob("*.json").scanSync({ cwd: configDir }))
      .map((entry) => entry.replace(/\.json$/, ""))
      .sort();
  }

  public getAuditLog(runId: string, branchId = "main", fromTick?: number, toTick?: number) {
    const run = RunManager.getRun(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }
    return this.deps.database.getAuditLogs(branchId, fromTick, toTick);
  }

  public verifyAudit(runId: string, branchId = "main", fromTick?: number, toTick?: number) {
    const run = RunManager.getRun(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }
    return MerkleLogger.verifyChain(branchId, fromTick, toTick);
  }

  public getFindings(runId: string, branchId = "main") {
    const run = RunManager.getRun(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }
    return FindingsJournal.getFindings(branchId);
  }

  public createBranch(runId: string, name?: string): BranchNode {
    const run = RunManager.getRun(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    const runtime = this.deps.runSupervisor.getRuntime(runId);
    const parentId = runtime?.branchId ?? "main";
    const tick = runtime?.clock.getTick() ?? RunStateStore.getLatest(runId)?.tick ?? 0;
    const branchId = `${runId}-branch-${crypto.randomUUID().slice(0, 8)}`;
    const branchName = name?.trim() || branchId;

    BranchManager.createBranch(branchId, branchName, tick, parentId);

    return {
      id: branchId,
      parentId,
      tick,
      name: branchName,
    };
  }

  public startRun(runId: string): { status: "running"; currentTick: number } {
    const runtime = this.deps.runSupervisor.getRuntime(runId);
    if (runtime) {
      if (runtime.status === "paused" || runtime.status === "resuming") {
        RunStateStore.record(runId, "resuming", runtime.clock.getTick());
        this.deps.runSupervisor.resumeRuntime(runId);
      }

      runtime.status = "running";
      return { status: "running", currentTick: runtime.clock.getTick() };
    }

    const run = RunManager.getRun(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    const latest = RunStateStore.getLatest(runId);
    const resumeTick = latest?.tick ?? 0;
    const initialStatus =
      latest?.status === "paused" || latest?.status === "stopped" ? "resuming" : "starting";
    RunStateStore.record(runId, initialStatus, resumeTick);

    const eventBus = new EventBus();
    const clock = new SimClock(async () => {
      const activeRuntime = this.deps.runSupervisor.getRuntime(runId);
      if (activeRuntime?.orchestrator) {
        await activeRuntime.orchestrator.tick();
      }
    });
    clock.setTick(resumeTick);

    const config = WorldConfigManager.load(runId, "main", resumeTick, this.deps.database);
    const { orchestrator, agents, world } = bootstrapSimulation(config, {
      runId,
      branchId: "main",
      eventBus,
      clock,
      gateway: this.deps.gateway,
      speciesRegistry: this.deps.speciesRegistry,
      database: this.deps.database,
      runSupervisor: this.deps.runSupervisor,
    });

    const registeredRuntime = this.deps.runSupervisor.getRuntime(runId);
    if (!registeredRuntime) {
      throw new Error(`Runtime registration failed for ${runId}`);
    }

    this.populateRuntime(registeredRuntime, {
      orchestrator,
      agents,
      world,
      status: "running",
    });

    clock.start(config.time || DEFAULT_TIME_CONFIG);
    RunStateStore.record(runId, "running", clock.getTick());

    return { status: "running", currentTick: clock.getTick() };
  }

  public pauseRun(runId: string): { status: "paused"; currentTick: number } {
    const runtime = this.requireRuntime(runId);
    this.deps.runSupervisor.pauseRuntime(runId);
    return { status: "paused", currentTick: runtime.clock.getTick() };
  }

  public stopRun(runId: string): { status: "stopped"; currentTick: number } {
    const runtime = this.requireRuntime(runId);
    const currentTick = runtime.clock.getTick();
    this.deps.runSupervisor.stopRuntime(runId);
    return { status: "stopped", currentTick };
  }

  public getRuntime(runId: string): RunRuntime | undefined {
    return this.deps.runSupervisor.getRuntime(runId);
  }

  private requireRuntime(runId: string): RunRuntime {
    const runtime = this.deps.runSupervisor.getRuntime(runId);
    if (!runtime) {
      throw new Error(`Runtime not active: ${runId}`);
    }
    return runtime;
  }

  private populateRuntime(
    runtime: RunRuntime,
    update: Pick<RunRuntime, "orchestrator" | "agents" | "world" | "status">,
  ): void {
    runtime.orchestrator = update.orchestrator;
    runtime.agents = update.agents;
    runtime.world = update.world;
    runtime.status = update.status;
  }

  private loadConfig(nameOrPath: string): WorldConfig | null {
    if (existsSync(nameOrPath)) {
      try {
        return JSON.parse(readFileSync(nameOrPath, "utf8")) as WorldConfig;
      } catch {
        return null;
      }
    }

    const builtInPath = join(import.meta.dir, "../../data/world-configs", `${nameOrPath}.json`);
    if (existsSync(builtInPath)) {
      try {
        return JSON.parse(readFileSync(builtInPath, "utf8")) as WorldConfig;
      } catch {
        return null;
      }
    }

    return null;
  }
}
