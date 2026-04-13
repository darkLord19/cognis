import { URGENCY_THRESHOLD } from "../../shared/constants";

type InitMessage = {
  type: "init";
  capacity: number;
  bodyBuffer: SharedArrayBuffer;
  activeBuffer: SharedArrayBuffer;
};

type TickMessage = {
  type: "phase_tick";
  requestId: string;
  tick: number;
};

type WorkerMessage = InitMessage | TickMessage;

let capacity = 0;
let body: Float64Array | null = null;
let active: Int32Array | null = null;

function runPhase(requestId: string, tick: number): void {
  if (!body || !active || capacity === 0) {
    postMessage({ type: "cognition_done", requestId, tick, urgentCount: 0, avgIntegrity: 0 });
    return;
  }

  let activeCount = 0;
  let urgentCount = 0;
  let integritySum = 0;

  for (let index = 0; index < capacity; index++) {
    if (Atomics.load(active, index) === 0) continue;
    activeCount++;
    const integrity = body[index * 4 + 3] ?? 0;
    integritySum += integrity;
    if (integrity > URGENCY_THRESHOLD) {
      urgentCount++;
    }
  }

  postMessage({
    type: "cognition_done",
    requestId,
    tick,
    urgentCount,
    avgIntegrity: activeCount === 0 ? 0 : integritySum / activeCount,
  });
}

addEventListener("message", (event: MessageEvent<WorkerMessage>) => {
  const payload = event.data;
  if (payload.type === "init") {
    capacity = payload.capacity;
    body = new Float64Array(payload.bodyBuffer);
    active = new Int32Array(payload.activeBuffer);
    postMessage({ type: "ready", worker: "cognition" });
    return;
  }

  if (payload.type === "phase_tick") {
    runPhase(payload.requestId, payload.tick);
  }
});
