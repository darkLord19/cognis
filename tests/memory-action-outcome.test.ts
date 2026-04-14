import { beforeAll, expect, test } from "bun:test";
import type { MotorPlan } from "../server/agents/action-grammar";
import { ActuationType } from "../server/agents/action-grammar";
import { EventBus } from "../server/core/event-bus";
import { Consolidation } from "../server/memory/consolidation";
import { EpisodicStore } from "../server/memory/episodic-store";
import { SemanticStore } from "../server/memory/semantic-store";
import { db } from "../server/persistence/database";
import { EventType, type SimEvent } from "../shared/events";
import type { AgentState, MemoryConfig } from "../shared/types";

const config: MemoryConfig = {
  episodicDecayRate: 0.1,
  episodicCapacity: 100,
  patternSeparation: true,
  semanticDecayRate: 0.05,
  semanticCapacity: 1000,
  consistencyThreshold: 0.5,
  catastrophicInterferenceEnabled: true,
  neSignalEnabled: true,
  neDecayRate: 0.1,
  neLockDuration: 10,
  consolidationPassesPerSleep: 1,
  traumaDistortionEnabled: false,
  rehearsalResetsDecay: true,
  motivatedForgettingEnabled: false,
  suppressionDecayRate: 0.5,
  contextualForgettingEnabled: false,
  inheritanceEnabled: false,
  inheritableFraction: 0,
};

beforeAll(() => {
  db.db.exec("PRAGMA foreign_keys = OFF;");
  db.db.exec("DELETE FROM episodic_memories");
  db.db.exec("DELETE FROM semantic_beliefs");
  db.db.exec("DELETE FROM branches");
  db.db.exec("INSERT INTO branches (id, tick, name) VALUES ('main', 0, 'main')");
  db.db.exec("PRAGMA foreign_keys = ON;");
});

function makeEvent(tick: number, plan: MotorPlan): SimEvent {
  return {
    event_id: `e-${tick}`,
    branch_id: "main",
    run_id: "r1",
    tick,
    type: EventType.TICK,
    payload: {
      motorPlan: plan,
      perceptualRefs: ["foreground_0"],
      outcome: {
        deltaPain: 0.05,
        deltaToxinLoad: 0,
        deltaHealth: 0.02,
        reliefScore: 0.7,
        harmScore: 0.1,
      },
      outcomeSummary: "the feeling eased after this movement",
      socialIntensity: 0.2,
      isNovel: false,
    },
  };
}

test("EpisodicStore: persists and rehydrates motorPlan/outcome/perceptualRefs", () => {
  const plan: MotorPlan = {
    source: "procedural",
    urgency: 0.6,
    createdAtTick: 5,
    primitives: [
      {
        type: ActuationType.LICK,
        target: { type: "perceptual_ref", ref: "foreground_0" },
        intensity: 0.7,
        durationTicks: 1,
      },
    ],
  };

  EpisodicStore.encode(
    "agent-memory",
    "main",
    "your mouth tightens",
    makeEvent(5, plan),
    0.92,
    config,
  );
  const retrieved = EpisodicStore.retrieve("agent-memory", "main", 1);

  expect(retrieved.length).toBe(1);
  expect(retrieved[0]?.motorPlan?.primitives[0]?.type).toBe("lick");
  expect(retrieved[0]?.outcome?.reliefScore).toBe(0.7);
  expect(retrieved[0]?.perceptualRefs?.[0]).toBe("foreground_0");
});

test("Consolidation: creates unnamed procedural relief belief from repeated outcomes", () => {
  const plan: MotorPlan = {
    source: "procedural",
    urgency: 0.6,
    createdAtTick: 7,
    primitives: [
      {
        type: ActuationType.LICK,
        target: { type: "perceptual_ref", ref: "foreground_0" },
        intensity: 0.7,
        durationTicks: 1,
      },
    ],
  };

  EpisodicStore.encode(
    "agent-memory",
    "main",
    "dry pull in your throat",
    makeEvent(7, plan),
    0.91,
    config,
  );
  EpisodicStore.encode(
    "agent-memory",
    "main",
    "the same pull returns",
    makeEvent(8, plan),
    0.93,
    config,
  );

  const agent = {
    id: "agent-memory",
    semanticStore: [],
    lexicon: [],
    relationships: [],
    feelingResidues: [],
  } as unknown as AgentState;

  Consolidation.consolidate(agent, "main", new EventBus());
  const beliefs = SemanticStore.getBeliefs("agent-memory", "main");

  expect(beliefs.some((belief) => belief.concept === "procedural_relief_pattern")).toBe(true);
});
