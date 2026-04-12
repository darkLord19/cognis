import { afterEach, beforeEach, expect, test } from "bun:test";
import { WillEngine } from "../server/agents/will-engine";
import { InterventionPipeline } from "../server/api/intervention-pipeline";
import { RunService } from "../server/core/run-service";
import { RunSupervisor } from "../server/core/run-supervisor";
import { LLMGateway } from "../server/llm/gateway";
import { MockLLMGateway } from "../server/llm/mock-gateway";
import { db } from "../server/persistence/database";
import { SpeciesRegistry } from "../server/species/registry";
import { EventType } from "../shared/events";

let supervisor: RunSupervisor;
let service: RunService;
let pipeline: InterventionPipeline;

beforeEach(() => {
  db.db.exec("PRAGMA foreign_keys = OFF;");
  db.db.exec("DELETE FROM run_state_events");
  db.db.exec("DELETE FROM config_mutations");
  db.db.exec("DELETE FROM findings");
  db.db.exec("DELETE FROM triple_baseline_runs");
  db.db.exec("DELETE FROM audit_log");
  db.db.exec("DELETE FROM branches");
  db.db.exec("DELETE FROM runs");
  db.db.exec("PRAGMA foreign_keys = ON;");

  supervisor = new RunSupervisor();
  const speciesRegistry = new SpeciesRegistry();
  speciesRegistry.loadAll();
  service = new RunService({
    runSupervisor: supervisor,
    gateway: new LLMGateway(new MockLLMGateway()),
    speciesRegistry,
    database: db,
  });
  pipeline = new InterventionPipeline(supervisor);
});

afterEach(() => {
  supervisor.shutdownAll();
});

test("InterventionPipeline emits explicit resistance and application events", () => {
  const created = service.createRun({ config: "earth-default", seed: 91 });
  service.startRun(created.id);

  const runtime = supervisor.getRuntime(created.id);
  expect(runtime?.orchestrator).toBeDefined();

  const seenEvents: EventType[] = [];
  runtime?.eventBus.onAny((event) => {
    seenEvents.push(event.type);
  });

  const agentId = service.getAgents(created.id)[0]?.id;
  expect(agentId).toBeDefined();

  const resisted = pipeline.applyIntervention(
    created.id,
    String(agentId),
    "integrity_drive_delta",
    0.1,
  );
  expect(resisted.resisted).toBe(true);
  expect(seenEvents).toContain(EventType.INTERVENTION_RESISTED);

  const resistedAudit = db.getAuditLogs("main").at(-1);
  expect(resistedAudit?.field).toBe("intervention_resistance");

  if (!runtime?.orchestrator) {
    throw new Error("Runtime orchestrator missing");
  }

  const agent = runtime.orchestrator.getAgents()[0];
  if (!agent) {
    throw new Error("Agent missing");
  }

  const willScore = WillEngine.computeWillScore(agent, runtime.worldConfig);
  const applied = pipeline.applyIntervention(
    created.id,
    String(agentId),
    "integrity_drive_delta",
    willScore + 1,
  );
  expect(applied.success).toBe(true);
  expect(seenEvents).toContain(EventType.INTERVENTION_APPLIED);

  const auditEntries = db.getAuditLogs("main");
  const applicationEntry = auditEntries.at(-1);
  const scarringEntry = auditEntries.at(-2);
  expect(applicationEntry?.field).toBe("identity_scarring");
  expect(scarringEntry?.field).toBe("intervention_application");
});
