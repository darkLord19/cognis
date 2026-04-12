import { expect, test } from "bun:test";
import { RunSupervisor } from "../server/core/run-supervisor";
import type { WorldConfig } from "../shared/types";

test("RunSupervisor manages multiple independent runtimes", () => {
  const supervisor = new RunSupervisor();
  const config = {} as unknown as WorldConfig;

  const runtime1 = supervisor.createRuntime("run1", "branch1", config);
  const runtime2 = supervisor.createRuntime("run2", "branch2", config);

  expect(runtime1.runId).toBe("run1");
  expect(runtime2.runId).toBe("run2");
  expect(supervisor.listRuntimes().length).toBe(2);

  supervisor.stopRuntime("run1");
  expect(supervisor.getRuntime("run1")).toBeUndefined();
  expect(supervisor.getRuntime("run2")).toBeDefined();
});
