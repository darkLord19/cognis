import { expect, test } from "bun:test";
import { EventBus } from "../server/core/event-bus";
import { type RunRuntime, RunSupervisor } from "../server/core/run-supervisor";
import { SimClock } from "../server/core/sim-clock";
import { db } from "../server/persistence/database";
import { MerkleLogger } from "../server/persistence/merkle-logger";
import { WebSocketServer } from "../server/ws/server";
import { EventType } from "../shared/events";
import type { AgentState } from "../shared/types";

function createRuntime(runId: string): RunRuntime {
  const clock = new SimClock();
  const eventBus = new EventBus();
  const agent = {
    id: "agent-1",
    speciesId: "human",
    name: "Agent 1",
    generation: 1,
    body: {
      energy: 0.9,
      hydration: 0.9,
      toxinLoad: 0,
      inflammation: 0,
      painLoad: 0,
      fatigue: 0.1,
      health: 1.0,
      bodyMap: {
        head: { pain: 0, temperature: 15, damage: 0, label: "head" },
        torso: { pain: 0, temperature: 15, damage: 0, label: "torso" },
        leftArm: { pain: 0, temperature: 15, damage: 0, label: "left arm" },
        rightArm: { pain: 0, temperature: 15, damage: 0, label: "right arm" },
        leftLeg: { pain: 0, temperature: 15, damage: 0, label: "left leg" },
        rightLeg: { pain: 0, temperature: 15, damage: 0, label: "right leg" },
      },
      oxygenation: 1.0,
      coreTemperature: 15,
      arousal: 0.2,
      valence: 0.1,
      cycleHormone: 0.3,
      circadianPhase: 0.5,
      integrityDrive: 0.1,
    },
    position: { x: 0, y: 0, z: 0 },
    facing: { x: 1, y: 0, z: 0 },
    muscleStats: { strength: 1, speed: 1, endurance: 1 },
    currentAction: { type: "REST" },
    pendingSystem2: false,
    innerMonologue: "I should rest.",
    selfNarrative: "I am here.",
    episodicStore: [],
    semanticStore: [],
    feelingResidues: [],
    lexicon: [],
    relationships: [],
    mentalModels: {},
    willScore: 0,
    age: 0,
    traumaFlags: [],
    conflictFlags: [],
    parentIds: [],
    inheritedMemoryFragments: [],
  } as AgentState;

  return {
    runId,
    branchId: "main",
    clock,
    eventBus,
    orchestrator: { getAgents: () => [agent] } as unknown as RunRuntime["orchestrator"],
    worldConfig: {} as RunRuntime["worldConfig"],
    world: null,
    agents: [agent],
    status: "running",
  };
}

function createMockSocket() {
  const sent: Record<string, unknown>[] = [];
  const socket = {
    data: {
      isOperator: false,
      subscriptions: new Map(),
    },
    send(message: string) {
      sent.push(JSON.parse(message) as Record<string, unknown>);
    },
  };

  return { socket, sent };
}

test("websocket server sends snapshot, event, tick, and agent updates for subscribed runs", () => {
  const supervisor = new RunSupervisor();
  const runtime = createRuntime("run-ws");
  supervisor.registerRuntime(runtime);
  const server = new WebSocketServer(supervisor);

  const { socket, sent } = createMockSocket();
  (server as unknown as { sockets: Set<unknown> }).sockets.add(socket);
  (server as unknown as { handleSubscribe: (ws: unknown, data: unknown) => void }).handleSubscribe(
    socket,
    {
      type: "subscribe",
      runId: "run-ws",
      eventTypes: [EventType.TICK],
    },
  );

  runtime.clock.setTick(1);
  runtime.eventBus.emit({
    event_id: crypto.randomUUID(),
    branch_id: "main",
    run_id: "run-ws",
    tick: 1,
    type: EventType.TICK,
    agent_id: "agent-1",
    payload: {},
  });

  expect(sent.map((message) => message.type)).toEqual([
    "snapshot",
    "event",
    "tick",
    "agent_update",
  ]);
});

test("websocket server includes operator-only streams for authenticated subscriptions", () => {
  db.db.exec("DELETE FROM audit_log");

  const supervisor = new RunSupervisor();
  const runtime = createRuntime("run-operator");
  supervisor.registerRuntime(runtime);
  const server = new WebSocketServer(supervisor);

  const { socket, sent } = createMockSocket();
  socket.data.isOperator = true;
  (server as unknown as { sockets: Set<unknown> }).sockets.add(socket);
  (server as unknown as { handleSubscribe: (ws: unknown, data: unknown) => void }).handleSubscribe(
    socket,
    {
      type: "subscribe",
      runId: "run-operator",
      eventTypes: [EventType.INTERVENTION_APPLIED],
      includeInnerMonologue: true,
      includeAudit: true,
    },
  );

  MerkleLogger.log(2, "main", "agent-1", "Intervention", "fatigue_spike", "0", "0.5", null);
  runtime.eventBus.emit({
    event_id: crypto.randomUUID(),
    branch_id: "main",
    run_id: "run-operator",
    tick: 2,
    type: EventType.INTERVENTION_APPLIED,
    agent_id: "agent-1",
    payload: {},
  });

  expect(sent.some((message) => message.type === "inner_monologue")).toBe(true);
  expect(sent.some((message) => message.type === "audit_entry")).toBe(true);
});
