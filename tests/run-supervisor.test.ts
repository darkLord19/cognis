import { beforeEach, expect, test } from "bun:test";
import { EventBus } from "../server/core/event-bus";
import { type RunRuntime, RunSupervisor } from "../server/core/run-supervisor";
import { SimClock } from "../server/core/sim-clock";

function createRuntime(runId: string): RunRuntime {
  return {
    runId,
    branchId: "main",
    clock: new SimClock(),
    eventBus: new EventBus(),
    orchestrator: null,
    worldConfig: {} as RunRuntime["worldConfig"],
    world: null,
    agents: [],
    status: "created",
  };
}

beforeEach(() => {
  // No shared global state.
});

test("RunSupervisor registers provided runtimes instead of constructing placeholders", () => {
  const supervisor = new RunSupervisor();
  const runtime1 = createRuntime("run-1");
  const runtime2 = createRuntime("run-2");

  supervisor.registerRuntime(runtime1);
  supervisor.registerRuntime(runtime2);

  expect(supervisor.getRuntime("run-1")).toBe(runtime1);
  expect(supervisor.getRuntime("run-2")).toBe(runtime2);
  expect(supervisor.listRuntimes()).toHaveLength(2);
});

test("RunSupervisor pauses, resumes, and stops tracked runtimes", () => {
  const supervisor = new RunSupervisor();
  const runtime = createRuntime("run-1");

  supervisor.registerRuntime(runtime);

  supervisor.pauseRuntime("run-1");
  expect(runtime.status).toBe("paused");

  supervisor.resumeRuntime("run-1");
  expect(runtime.status).toBe("running");

  supervisor.stopRuntime("run-1");
  expect(runtime.status).toBe("stopped");
  expect(supervisor.getRuntime("run-1")).toBeUndefined();
});
