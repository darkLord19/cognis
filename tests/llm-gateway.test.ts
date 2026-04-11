import { expect, test } from "bun:test";
import { LLMGateway, type LLMProvider } from "../server/llm/gateway";
import { MockLLMGateway } from "../server/llm/mock-gateway";
import type { AgentState, SemanticMaskingConfig, SpeciesConfig } from "../shared/types";

test("LLMGateway: uses mock provider correctly", async () => {
  const gateway = new LLMGateway(new MockLLMGateway());
  const response = await gateway.complete("agent_1", "Hello world", "System prompt");
  expect(response).toContain("Hello worl");

  const embedding = await gateway.embed("Test");
  expect(embedding.length).toBe(768);
});

test("LLMGateway: system prompt generation uses masked labels", () => {
  const gateway = new LLMGateway(new MockLLMGateway());

  const agent: Partial<AgentState> = { name: "Bob" };
  const species: Partial<SpeciesConfig> = { name: "Human" };
  const maskingConfig: SemanticMaskingConfig = {
    enabled: true,
    qualiaUsesRealLabels: false,
    sensorLabelMap: {
      needs: "vital_deltas",
      sensations: "flux_inputs",
    },
    rotatePeriodically: false,
    rotationIntervalTicks: 0,
  };

  const prompt = gateway.systemPromptForAgent(
    agent as AgentState,
    species as SpeciesConfig,
    maskingConfig,
  );

  expect(prompt).toContain("Bob");
  expect(prompt).toContain("Human");
  expect(prompt).toContain("vital_deltas");
  expect(prompt).toContain("flux_inputs");
  expect(prompt).not.toContain("needs");
  expect(prompt).not.toContain("sensations");
});

test("LLMGateway: system prompt respects qualiaUsesRealLabels", () => {
  const gateway = new LLMGateway(new MockLLMGateway());

  const agent: Partial<AgentState> = { name: "Bob" };
  const species: Partial<SpeciesConfig> = { name: "Human" };
  const maskingConfig: SemanticMaskingConfig = {
    enabled: true,
    qualiaUsesRealLabels: true,
    sensorLabelMap: {
      needs: "vital_deltas",
    },
    rotatePeriodically: false,
    rotationIntervalTicks: 0,
  };

  const prompt = gateway.systemPromptForAgent(
    agent as AgentState,
    species as SpeciesConfig,
    maskingConfig,
  );

  expect(prompt).toContain("needs");
  expect(prompt).not.toContain("vital_deltas");
});

test("LLMGateway: queue concurrency is respected", async () => {
  let activeCalls = 0;
  let maxActiveCalls = 0;

  const slowMockProvider = {
    completion: async () => {
      activeCalls++;
      maxActiveCalls = Math.max(maxActiveCalls, activeCalls);
      await new Promise((resolve) => setTimeout(resolve, 50));
      activeCalls--;
      return "done";
    },
    embed: async () => [],
  };

  const gateway = new LLMGateway(slowMockProvider as unknown as LLMProvider);

  // Fire 10 concurrent requests
  const promises = Array.from({ length: 10 }).map(() => gateway.complete("1", "test", "test"));

  await Promise.all(promises);

  // Max concurrent should be 5 per implementation
  expect(maxActiveCalls).toBeLessThanOrEqual(5);
});
