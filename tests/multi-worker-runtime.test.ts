import { expect, test } from "bun:test";
import { MultiWorkerRuntime } from "../server/core/multi-worker-runtime";
import type { AgentState } from "../shared/types";

function createAgent(id: string, x: number, integrityDrive: number): AgentState {
  return {
    id,
    position: { x, y: 5, z: 0 },
    body: {
      hunger: 0.5,
      thirst: 0.2,
      fatigue: 0.2,
      health: 1,
      integrityDrive,
      bodyMap: {
        head: { pain: 0.2, damage: 0, temperature: 15, label: "head" },
        torso: { pain: 0.1, damage: 0, temperature: 15, label: "torso" },
        leftArm: { pain: 0, damage: 0, temperature: 15, label: "leftArm" },
        rightArm: { pain: 0, damage: 0, temperature: 15, label: "rightArm" },
        leftLeg: { pain: 0, damage: 0, temperature: 15, label: "leftLeg" },
        rightLeg: { pain: 0, damage: 0, temperature: 15, label: "rightLeg" },
      },
    },
  } as unknown as AgentState;
}

test("MultiWorkerRuntime runs physics, cognition, and analysis phases over shared buffers", async () => {
  const runtime = new MultiWorkerRuntime(8);
  if (!runtime.isAvailable()) {
    runtime.terminate();
    throw new Error("Expected workers to be available in Bun runtime");
  }

  runtime.syncAgents([
    createAgent("a1", 0, 0.4),
    createAgent("a2", 10, 0.9),
    createAgent("a3", 20, 0.95),
  ]);

  const report = await runtime.runTick(42);
  runtime.terminate();

  expect(report).toBeTruthy();
  expect(report?.physics.activeCount).toBe(3);
  expect(report?.cognition.urgentCount).toBe(2);
  expect(report?.analysis.spread ?? 0).toBeGreaterThan(0);
});
