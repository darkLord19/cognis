import { beforeAll, expect, test } from "bun:test";
import { EpisodicStore } from "../server/memory/episodic-store";
import { SalienceGate } from "../server/memory/salience-gate";
import { db } from "../server/persistence/database";
import { EventType, type SimEvent } from "../shared/events";
import type { AgentState, MemoryConfig } from "../shared/types";

beforeAll(() => {
  db.db.exec("PRAGMA foreign_keys = OFF;");
  db.db.exec("DELETE FROM episodic_memories");
  db.db.exec("DELETE FROM audit_log");
  db.db.exec("DELETE FROM branches");
  db.db.exec("INSERT INTO branches (id, tick, name) VALUES ('main', 0, 'main')");
  db.db.exec("PRAGMA foreign_keys = ON;");
});

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
  traumaDistortionEnabled: true,
  rehearsalResetsDecay: true,
  motivatedForgettingEnabled: true,
  suppressionDecayRate: 0.5,
  contextualForgettingEnabled: true,
  inheritanceEnabled: false,
  inheritableFraction: 0,
};

test("SalienceGate: calculates salience based on factors", () => {
  const event: SimEvent = {
    event_id: "e1",
    branch_id: "main",
    run_id: "r1",
    tick: 1,
    type: EventType.TICK,
    payload: { valence: 0.9, arousal: 0.5, isNovel: true },
  };

  const agent = {
    body: {
      bodyMap: {
        head: { pain: 0 },
        torso: { pain: 0 },
        leftArm: { pain: 0 },
        rightArm: { pain: 0 },
        leftLeg: { pain: 0 },
        rightLeg: { pain: 0 },
      },
    },
  } as unknown as AgentState;
  const salience = SalienceGate.computeSalience(event, agent, config);

  expect(salience).toBeGreaterThan(0.5);
});

test("EpisodicStore: encode and retrieve", () => {
  const event: SimEvent = {
    event_id: "e2",
    branch_id: "main",
    run_id: "r1",
    tick: 10,
    type: EventType.TICK,
    payload: { valence: 0.5, arousal: 0.5 },
  };

  const mem = EpisodicStore.encode("agent1", "main", "I saw a tree", event, 0.8, config);
  expect(mem.qualiaText).toBe("I saw a tree");

  const retrieved = EpisodicStore.retrieve("agent1", "main", 1);
  expect(retrieved.length).toBe(1);
  expect(retrieved[0]?.qualiaText).toBe("I saw a tree");
});

test("EpisodicStore: suppression is logged", () => {
  const event: SimEvent = {
    event_id: "e3",
    branch_id: "main",
    run_id: "r1",
    tick: 20,
    type: EventType.TICK,
    payload: {},
  };
  const mem = EpisodicStore.encode("agent1", "main", "scary event", event, 0.9, config);

  EpisodicStore.suppress("agent1", "main", mem.id, 21);

  const retrieved = EpisodicStore.retrieve("agent1", "main", 10);
  const suppressed = retrieved.find((m) => m.id === mem.id);
  expect(suppressed?.suppressed).toBe(true);

  const audit = db.getAuditLogs("main");
  const suppressionLog = audit.find((a) => a.suppressed === 1);
  expect(suppressionLog).toBeTruthy();
});
