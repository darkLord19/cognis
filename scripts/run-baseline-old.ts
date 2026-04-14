import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { bootstrapSimulation } from "../server/core/bootstrap";
import { EventBus } from "../server/core/event-bus";
import { RunSupervisor } from "../server/core/run-supervisor";
import { SimClock } from "../server/core/sim-clock";
import { LLMGateway } from "../server/llm/gateway";
import { MockLLMGateway } from "../server/llm/mock-gateway";
import { db } from "../server/persistence/database";
import { SpeciesRegistry } from "../server/species/registry";
import type { SimEvent } from "../shared/events";
import type { ActionType, WorldConfig } from "../shared/types";

type BaselineDump = {
  generatedAtIso: string;
  runId: string;
  branchId: string;
  ticksSimulated: number;
  survivalTicks: number;
  legacyActionDistribution: Record<"MOVE" | "REST" | "WANDER", number>;
  actionDistribution: Record<string, number>;
  qualiaSamples: string[];
  eventCounts: Record<string, number>;
};

const OUTPUT_PATH = join(process.cwd(), "tmp", "baselines", "pre-v5-2.json");
const N_TICKS = 200;

function loadBaselineConfig(): WorldConfig {
  const raw = readFileSync(
    join(process.cwd(), "data", "world-configs", "freeform-sandbox.json"),
    "utf8",
  );
  const parsed = JSON.parse(raw) as WorldConfig;
  return {
    ...parsed,
    meta: {
      ...parsed.meta,
      name: "pre-v5-2-baseline",
    },
    agents: {
      ...parsed.agents,
      count: 1,
      initialCount: 1,
    },
  };
}

function incrementCounter(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

function actionNameFromCurrent(actionType: ActionType | undefined): string {
  return actionType ?? "NONE";
}

async function main(): Promise<void> {
  const speciesRegistry = new SpeciesRegistry();
  speciesRegistry.loadAll();

  const eventCounts: Record<string, number> = {};
  const allEvents: SimEvent[] = [];
  const eventBus = new EventBus();
  eventBus.onAny((event) => {
    allEvents.push(event);
    incrementCounter(eventCounts, event.type);
  });

  const runId = `baseline-pre-v5-2-${Date.now()}`;
  const branchId = `baseline-pre-v5-2-${Date.now().toString(36)}`;
  const config = loadBaselineConfig();
  const clock = new SimClock();
  const runSupervisor = new RunSupervisor();
  const gateway = new LLMGateway(new MockLLMGateway());

  const { orchestrator, agents } = bootstrapSimulation(config, {
    runId,
    branchId,
    eventBus,
    clock,
    gateway,
    speciesRegistry,
    database: db,
    runSupervisor,
  });

  const trackedAgentId = agents[0]?.id;
  if (!trackedAgentId) {
    throw new Error("Failed to bootstrap baseline run with one agent.");
  }

  const actionDistribution: Record<string, number> = {};
  let survivalTicks = N_TICKS;

  for (let tick = 1; tick <= N_TICKS; tick++) {
    await clock.advanceTick();
    await orchestrator.tick();

    const tracked = orchestrator.getAgents().find((agent) => agent.id === trackedAgentId);
    if (!tracked) {
      survivalTicks = tick - 1;
      break;
    }

    const actionName = actionNameFromCurrent(tracked.currentAction?.type);
    incrementCounter(actionDistribution, actionName);
  }

  const qualiaSamples = allEvents
    .filter((event) => event.type === "tick")
    .map((event) => {
      const qualia = event.payload.qualia;
      return typeof qualia === "string" ? qualia : "";
    })
    .filter((sample) => sample.length > 0)
    .slice(0, 20);

  const dump: BaselineDump = {
    generatedAtIso: new Date().toISOString(),
    runId,
    branchId,
    ticksSimulated: N_TICKS,
    survivalTicks,
    legacyActionDistribution: {
      MOVE: actionDistribution.MOVE ?? 0,
      REST: actionDistribution.REST ?? 0,
      WANDER: actionDistribution.WANDER ?? 0,
    },
    actionDistribution,
    qualiaSamples,
    eventCounts,
  };

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(dump, null, 2)}\n`, "utf8");

  console.log(`Baseline written to ${OUTPUT_PATH}`);
  console.log(
    JSON.stringify(
      {
        survivalTicks: dump.survivalTicks,
        legacyActionDistribution: dump.legacyActionDistribution,
        sampledQualia: dump.qualiaSamples.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
