import { expect, test } from "bun:test";
import { SimClock } from "../server/core/sim-clock";
import type { TimeConfig } from "../shared/types";

test("SimClock: tick increments", async () => {
  let ticked = false;
  const clock = new SimClock((tick) => {
    ticked = true;
    expect(tick).toBe(1);
  });

  await clock.advanceTick();
  expect(ticked).toBe(true);
  expect(clock.getTick()).toBe(1);
});

test("SimClock: circadian phase 0->1 over cycleLengthTicks", async () => {
  const clock = new SimClock();
  clock.setCycleLength(4);

  expect(clock.getCircadianPhase()).toBe(0); // Tick 0 -> 0/4 = 0

  await clock.advanceTick(); // Tick 1
  expect(clock.getCircadianPhase()).toBe(0.25);

  await clock.advanceTick(); // Tick 2
  expect(clock.getCircadianPhase()).toBe(0.5);

  await clock.advanceTick(); // Tick 3
  expect(clock.getCircadianPhase()).toBe(0.75);

  await clock.advanceTick(); // Tick 4
  expect(clock.getCircadianPhase()).toBe(0);
});

test("SimClock: elastic heartbeat waits for pending minds", async () => {
  let tickCount = 0;
  const clock = new SimClock(() => {
    tickCount++;
  });

  const config: TimeConfig = {
    elasticHeartbeat: true,
    maxHeartbeatWaitMs: 100,
    tickDurationMs: 10,
  };

  clock.registerPendingMind();
  clock.start(config);

  // Wait a little bit to ensure it's blocked
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(tickCount).toBe(0);

  // Resolve the mind
  clock.resolvePendingMind();

  // Wait for tick to finish
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(tickCount).toBeGreaterThanOrEqual(1);

  clock.pause();
});

test("SimClock: elastic heartbeat proceeds after maxHeartbeatWaitMs timeout", async () => {
  let tickCount = 0;
  const clock = new SimClock(() => {
    tickCount++;
  });

  const config: TimeConfig = {
    elasticHeartbeat: true,
    maxHeartbeatWaitMs: 50,
    tickDurationMs: 10,
  };

  clock.registerPendingMind();

  const startTime = Date.now();
  clock.start(config);

  // Wait for the timeout to happen
  await new Promise((resolve) => setTimeout(resolve, 60));
  const duration = Date.now() - startTime;

  expect(duration).toBeGreaterThanOrEqual(50);
  expect(tickCount).toBeGreaterThanOrEqual(1);

  clock.pause();
  clock.resolvePendingMind(); // Clean up
});
