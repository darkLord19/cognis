export {};

type InitMessage = {
  type: "init";
  capacity: number;
  positionsBuffer: SharedArrayBuffer;
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
let positions: Float64Array | null = null;
let body: Float64Array | null = null;
let active: Int32Array | null = null;

function runPhase(requestId: string, tick: number): void {
  if (!positions || !body || !active || capacity === 0) {
    postMessage({ type: "analysis_done", requestId, tick, spread: 0, stressMean: 0 });
    return;
  }

  let activeCount = 0;
  let meanX = 0;
  let stressSum = 0;

  for (let index = 0; index < capacity; index++) {
    if (Atomics.load(active, index) === 0) continue;
    activeCount++;
    meanX += positions[index * 3] ?? 0;
    stressSum += body[index * 4 + 3] ?? 0;
  }

  if (activeCount === 0) {
    postMessage({ type: "analysis_done", requestId, tick, spread: 0, stressMean: 0 });
    return;
  }

  meanX /= activeCount;
  let varianceX = 0;
  for (let index = 0; index < capacity; index++) {
    if (Atomics.load(active, index) === 0) continue;
    const dx = (positions[index * 3] ?? 0) - meanX;
    varianceX += dx * dx;
  }

  postMessage({
    type: "analysis_done",
    requestId,
    tick,
    spread: varianceX / activeCount,
    stressMean: stressSum / activeCount,
  });
}

addEventListener("message", (event: MessageEvent<WorkerMessage>) => {
  const payload = event.data;
  if (payload.type === "init") {
    capacity = payload.capacity;
    positions = new Float64Array(payload.positionsBuffer);
    body = new Float64Array(payload.bodyBuffer);
    active = new Int32Array(payload.activeBuffer);
    postMessage({ type: "ready", worker: "analysis" });
    return;
  }

  if (payload.type === "phase_tick") {
    runPhase(payload.requestId, payload.tick);
  }
});
