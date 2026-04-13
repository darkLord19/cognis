import { beforeAll, expect, test } from "bun:test";
import { SenseComputer } from "../server/perception/sense-computer";
import { db } from "../server/persistence/database";
import { SpatialIndex } from "../server/world/spatial-index";
import { VoxelGrid } from "../server/world/voxel-grid";
import type { AgentState, CircadianState, PerceptionConfig, VocalActuation } from "../shared/types";

beforeAll(() => {
  db.db.exec("PRAGMA foreign_keys = OFF;");
  db.db.exec("DELETE FROM audit_log");
  db.db.exec("DELETE FROM branches");
  db.db.exec("INSERT INTO branches (id, tick, name) VALUES ('main', 0, 'main')");
  db.db.exec("PRAGMA foreign_keys = ON;");
});

const mockAgent1 = { id: "agent1", position: { x: 0, y: 0, z: 0 } } as AgentState;
const mockAgent2 = { id: "agent2", position: { x: 25, y: 0, z: 0 } } as AgentState;

const config: PerceptionConfig = {
  physicsLimitsEnabled: true,
  emotionalFieldEnabled: true,
  emotionalFieldSuppressible: true,
  feelingResidueEnabled: true,
  residueDecayRate: 0.1,
  qualiaFidelity: "standard",
  attentionFilterEnabled: true,
  attentionCapacity: 5,
  attentionWeights: {
    relationshipStrength: 0.3,
    emotionalFieldIntensity: 0.3,
    movementVelocity: 0.2,
    novelty: 0.2,
  },
};

test("SenseComputer: darkness reduces sight range", () => {
  const grid = new VoxelGrid(10, 10, 10);
  const index = new SpatialIndex();
  index.updateAgent(mockAgent1);
  index.updateAgent(mockAgent2);
  index.rebuildIndex([mockAgent1, mockAgent2]);

  // Bright light: agent2 is at dist 25. Base range is 30 * (0.2 + 0.8 * 1.0) = 30.
  const brightState: CircadianState = {
    lightLevel: 1.0,
    surfaceTemperatureDelta: 0,
    cycleHormoneValue: 0,
    season: "spring",
  };
  const brightPercept = SenseComputer.computePerception(
    mockAgent1,
    grid,
    index,
    config,
    brightState,
    [],
  );
  expect(brightPercept.visibleAgents.some((a) => a.id === "agent2")).toBe(true);

  // Pitch black: agent2 is at dist 25. Base range is 30 * (0.2 + 0.8 * 0.0) = 6.
  const darkState: CircadianState = {
    lightLevel: 0.0,
    surfaceTemperatureDelta: 0,
    cycleHormoneValue: 0,
    season: "spring",
  };
  const darkPercept = SenseComputer.computePerception(
    mockAgent1,
    grid,
    index,
    config,
    darkState,
    [],
  );
  expect(darkPercept.visibleAgents.some((a) => a.id === "agent2")).toBe(false);
});

test("SenseComputer: vocal actuation detected by nearby agents", () => {
  const grid = new VoxelGrid(10, 10, 10);
  const index = new SpatialIndex();
  index.updateAgent(mockAgent1);
  index.updateAgent(mockAgent2);
  index.rebuildIndex([mockAgent1, mockAgent2]);

  const state: CircadianState = {
    lightLevel: 1.0,
    surfaceTemperatureDelta: 0,
    cycleHormoneValue: 0,
    season: "spring",
  };

  const actuations: VocalActuation[] = [
    { emitterId: "agent2", soundToken: "AARGH", arousal: 0.9, valence: -0.8, tick: 10 },
  ];

  const percept = SenseComputer.computePerception(
    mockAgent1,
    grid,
    index,
    config,
    state,
    actuations,
  );

  expect(percept.vocalActuations.length).toBe(1);
  expect(percept.vocalActuations[0]?.soundToken).toBe("AARGH");
  expect(percept.audioField.length).toBe(1);
  expect(percept.audioField[0]?.soundToken).toBe("AARGH");
  expect(percept.audioField[0]?.amplitude ?? 0).toBeGreaterThan(0);
});
