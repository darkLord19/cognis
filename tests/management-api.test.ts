import { afterEach, beforeEach, expect, test } from "bun:test";
import { GlassRoomManager } from "../server/agents/glass-room";
import { createManagementApiHandler } from "../server/api/management-api";
import { RunService } from "../server/core/run-service";
import { RunSupervisor } from "../server/core/run-supervisor";
import { LLMGateway } from "../server/llm/gateway";
import { MockLLMGateway } from "../server/llm/mock-gateway";
import { db } from "../server/persistence/database";
import { SpeciesRegistry } from "../server/species/registry";

let supervisor: RunSupervisor;
let service: RunService;
let glassRoomManager: GlassRoomManager;
let handler: (req: Request) => Promise<Response>;

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

beforeEach(() => {
  db.db.exec("PRAGMA foreign_keys = OFF;");
  db.db.exec("DELETE FROM run_state_events");
  db.db.exec("DELETE FROM config_mutations");
  db.db.exec("DELETE FROM audit_log");
  db.db.exec("DELETE FROM branches");
  db.db.exec("DELETE FROM runs");
  db.db.exec("PRAGMA foreign_keys = ON;");

  supervisor = new RunSupervisor();
  glassRoomManager = new GlassRoomManager();
  const speciesRegistry = new SpeciesRegistry();
  speciesRegistry.loadAll();
  service = new RunService({
    runSupervisor: supervisor,
    gateway: new LLMGateway(new MockLLMGateway()),
    speciesRegistry,
    database: db,
  });
  handler = createManagementApiHandler({
    runService: service,
    runSupervisor: supervisor,
    glassRoomManager,
  });
});

afterEach(() => {
  supervisor.shutdownAll();
});

test("management api creates and starts a run through the shared lifecycle service", async () => {
  const createResponse = await handler(
    new Request("http://localhost/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: "earth-default", seed: 77, name: "API Run" }),
    }),
  );
  expect(createResponse.status).toBe(201);
  const created = await readJson(createResponse);
  const runId = String(created.id);

  const startResponse = await handler(
    new Request(`http://localhost/runs/${runId}/start`, { method: "POST" }),
  );
  expect(startResponse.status).toBe(200);
  const started = await readJson(startResponse);
  expect(started.status).toBe("running");
  expect(supervisor.getRuntime(runId)?.status).toBe("running");

  const runResponse = await handler(new Request(`http://localhost/runs/${runId}`));
  const run = await readJson(runResponse);
  expect(run.status).toBe("running");

  const agentsResponse = await handler(new Request(`http://localhost/runs/${runId}/agents`));
  const agents = await readJson(agentsResponse);
  expect(Array.isArray(agents.agents)).toBe(true);
});

test("management api pauses, resumes, stops, and reports health from shared runtimes", async () => {
  const created = service.createRun({ config: "earth-default", seed: 78 });
  service.startRun(created.id);

  const pauseResponse = await handler(
    new Request(`http://localhost/runs/${created.id}/pause`, { method: "POST" }),
  );
  expect(pauseResponse.status).toBe(200);
  expect((await readJson(pauseResponse)).status).toBe("paused");

  const resumeResponse = await handler(
    new Request(`http://localhost/runs/${created.id}/start`, { method: "POST" }),
  );
  expect(resumeResponse.status).toBe(200);
  expect((await readJson(resumeResponse)).status).toBe("running");

  const healthResponse = await handler(new Request("http://localhost/health"));
  const health = await readJson(healthResponse);
  expect(health.status).toBe("ok");
  expect(health.activeRuns).toBe(1);

  const stopResponse = await handler(
    new Request(`http://localhost/runs/${created.id}/stop`, { method: "POST" }),
  );
  expect(stopResponse.status).toBe(200);
  expect((await readJson(stopResponse)).status).toBe("stopped");
  expect(supervisor.getRuntime(created.id)).toBeUndefined();
});

test("management api reports resisted and applied interventions and manages glass room sessions", async () => {
  const created = service.createRun({ config: "earth-default", seed: 79 });
  service.startRun(created.id);
  const agentId = service.getAgents(created.id)[0]?.id;
  expect(agentId).toBeDefined();

  const resistedResponse = await handler(
    new Request(`http://localhost/runs/${created.id}/interventions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId,
        type: "integrity_drive_delta",
        intensity: 0.1,
      }),
    }),
  );
  const resisted = await readJson(resistedResponse);
  expect(resistedResponse.status).toBe(200);
  expect(resisted.resisted).toBe(true);

  const appliedResponse = await handler(
    new Request(`http://localhost/runs/${created.id}/interventions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId,
        type: "fatigue_spike",
        intensity: 0.5,
      }),
    }),
  );
  const applied = await readJson(appliedResponse);
  expect(appliedResponse.status).toBe(200);
  expect(applied.success).toBe(true);

  const enterResponse = await handler(
    new Request(`http://localhost/runs/${created.id}/glass-room/${agentId}`, {
      method: "POST",
    }),
  );
  expect(enterResponse.status).toBe(200);
  expect(glassRoomManager.isAgentInGlassRoom(created.id, String(agentId))).toBe(true);

  const exitResponse = await handler(
    new Request(`http://localhost/runs/${created.id}/arnold/${agentId}`, {
      method: "DELETE",
    }),
  );
  expect(exitResponse.status).toBe(200);
  expect(glassRoomManager.isAgentInGlassRoom(created.id, String(agentId))).toBe(false);
});
