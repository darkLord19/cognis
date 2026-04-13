export {};

type InitMessage = {
  type: "init";
  capacity: number;
  positionsBuffer: SharedArrayBuffer;
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
let active: Int32Array | null = null;

function runPhase(requestId: string, tick: number): void {
  if (!positions || !active || capacity === 0) {
    postMessage({ type: "physics_done", requestId, tick, activeCount: 0, centroid: [0, 0, 0] });
    return;
  }

  let activeCount = 0;
  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;

  for (let index = 0; index < capacity; index++) {
    if (Atomics.load(active, index) === 0) {
      continue;
    }
    activeCount++;
    const offset = index * 3;
    sumX += positions[offset] ?? 0;
    sumY += positions[offset + 1] ?? 0;
    sumZ += positions[offset + 2] ?? 0;
  }

  const centroid =
    activeCount === 0 ? [0, 0, 0] : [sumX / activeCount, sumY / activeCount, sumZ / activeCount];

  postMessage({ type: "physics_done", requestId, tick, activeCount, centroid });
}

addEventListener("message", (event: MessageEvent<WorkerMessage>) => {
  const payload = event.data;
  if (payload.type === "init") {
    capacity = payload.capacity;
    positions = new Float64Array(payload.positionsBuffer);
    active = new Int32Array(payload.activeBuffer);
    postMessage({ type: "ready", worker: "physics" });
    return;
  }

  if (payload.type === "phase_tick") {
    runPhase(payload.requestId, payload.tick);
  }
});
