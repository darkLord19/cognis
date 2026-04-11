import { expect, test } from "bun:test";
import { EventBus } from "../server/core/event-bus";
import { EventType, type SimEvent } from "../shared/events";

test("EventBus: basic pub/sub", () => {
  const bus = new EventBus();
  let caughtEvent: SimEvent | null = null;

  const handler = (e: SimEvent) => {
    caughtEvent = e;
  };

  bus.on(EventType.TICK, handler);

  const event: SimEvent = {
    event_id: "1",
    branch_id: "main",
    run_id: "r1",
    tick: 1,
    type: EventType.TICK,
    payload: {},
  };

  bus.emit(event);

  expect(caughtEvent).toBeTruthy();
  expect(caughtEvent!.event_id).toBe("1");

  bus.off(EventType.TICK, handler);
  caughtEvent = null;

  bus.emit(event);
  expect(caughtEvent).toBeNull();
});

test("EventBus: onAny handler", () => {
  const bus = new EventBus();
  let count = 0;

  bus.onAny(() => {
    count++;
  });

  bus.emit({
    event_id: "1",
    branch_id: "main",
    run_id: "r1",
    tick: 1,
    type: EventType.TICK,
    payload: {},
  });
  bus.emit({
    event_id: "2",
    branch_id: "main",
    run_id: "r1",
    tick: 2,
    type: EventType.VOXEL_CHANGED,
    payload: {},
  });

  expect(count).toBe(2);
});

test("EventBus: buffered DB persistence via size", () => {
  const flushedEvents: SimEvent[] = [];
  const bus = new EventBus((events) => {
    flushedEvents.push(...events);
  });

  for (let i = 0; i < 49; i++) {
    bus.emit({
      event_id: `e${i}`,
      branch_id: "main",
      run_id: "r1",
      tick: 1,
      type: EventType.TICK,
      payload: {},
    });
  }

  expect(flushedEvents.length).toBe(0);

  // Emit 50th event, should trigger flush
  bus.emit({
    event_id: "e49",
    branch_id: "main",
    run_id: "r1",
    tick: 1,
    type: EventType.TICK,
    payload: {},
  });

  expect(flushedEvents.length).toBe(50);
});

test("EventBus: buffered DB persistence via timeout", async () => {
  const flushedEvents: SimEvent[] = [];
  const bus = new EventBus((events) => {
    flushedEvents.push(...events);
  });

  bus.emit({
    event_id: "e1",
    branch_id: "main",
    run_id: "r1",
    tick: 1,
    type: EventType.TICK,
    payload: {},
  });
  expect(flushedEvents.length).toBe(0);

  await new Promise((resolve) => setTimeout(resolve, 150));
  expect(flushedEvents.length).toBe(1);
});
