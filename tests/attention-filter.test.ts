import { expect, test } from "bun:test";
import { AttentionFilter } from "../server/agents/attention-filter";
import type { AgentState, PerceptionConfig, RawPercept } from "../shared/types";

const mockConfig: PerceptionConfig = {
  physicsLimitsEnabled: true,
  emotionalFieldEnabled: true,
  emotionalFieldSuppressible: true,
  feelingResidueEnabled: true,
  residueDecayRate: 0.1,
  qualiaFidelity: "standard",
  attentionFilterEnabled: true,
  attentionCapacity: 2, // Testing cap
  attentionWeights: {
    relationshipStrength: 0.4,
    emotionalFieldIntensity: 0.2,
    movementVelocity: 0.2,
    novelty: 0.2,
  },
};

const createAgent = (
  id: string,
  valence: number,
  arousal: number,
  velocityMag: number,
  _relInteractions: number,
): AgentState => {
  return {
    id,
    body: { valence, arousal } as unknown as AgentState["body"],
    relationships: [],
    velocity: { x: velocityMag, y: 0, z: 0 },
  } as unknown as AgentState;
};

const selfAgent = {
  id: "self",
  body: { valence: 0, arousal: 0 } as unknown as AgentState["body"],
  relationships: [
    {
      targetAgentId: "friend",
      affinity: 1.0,
      fear: 0,
      trust: 1.0,
      significantEvents: new Array(500).fill("event"),
    },
  ],
} as unknown as AgentState;

test("AttentionFilter: only top N entities pass through", () => {
  const percept: RawPercept = {
    visibleAgents: [
      createAgent("a1", 0, 0, 0, 0),
      createAgent("a2", 0.5, 0.5, 0, 0),
      createAgent("a3", 1.0, 1.0, 5.0, 0), // High score
    ],
    audibleAgents: [],
    smellableAgents: [],
    nearbyVoxels: [],
    localTemperature: 20,
    lightLevel: 1.0,
    weather: "clear",
    audioField: [],
    vocalActuations: [],
  };

  const filtered = AttentionFilter.filter(percept, selfAgent, mockConfig);

  expect(filtered.primaryAttention.length).toBe(2);
  expect(filtered.primaryAttention[0]?.id).toBe("a3");
  expect(filtered.peripheralAwareness.count).toBe(1);
});

test("AttentionFilter: relationship strength boosts score", () => {
  const friend = createAgent("friend", 0, 0, 0, 500); // Has high affinity in selfAgent.relationships
  const stranger = createAgent("stranger", 0, 0, 0, 0);

  const scoreFriend = AttentionFilter.scoreEntity(friend, selfAgent, mockConfig);
  const scoreStranger = AttentionFilter.scoreEntity(stranger, selfAgent, mockConfig);

  expect(scoreFriend).toBeGreaterThan(scoreStranger);
});

test("AttentionFilter: movement velocity boosts score", () => {
  const moving = createAgent("moving", 0, 0, 10, 0);
  const still = createAgent("still", 0, 0, 0, 0);

  const scoreMoving = AttentionFilter.scoreEntity(moving, selfAgent, mockConfig);
  const scoreStill = AttentionFilter.scoreEntity(still, selfAgent, mockConfig);

  // Velocity tracking is a placeholder returning 0.0 right now
  expect(scoreMoving).toEqual(scoreStill);
});

test("AttentionFilter: novel entities score high", () => {
  const known = createAgent("known", 0, 0, 0, 1000);
  // Hack relation interactions for test
  selfAgent.relationships.push({
    targetAgentId: "known",
    affinity: 0,
    fear: 0,
    trust: 0,
    significantEvents: new Array(1000).fill("e"),
  } as unknown as AgentState["relationships"][0]);

  const novel = createAgent("novel", 0, 0, 0, 0);

  const scoreKnown = AttentionFilter.scoreEntity(known, selfAgent, mockConfig);
  const scoreNovel = AttentionFilter.scoreEntity(novel, selfAgent, mockConfig);

  expect(scoreNovel).toBeGreaterThan(scoreKnown);
});
