import type { AgentState } from "../../shared/types";

const POSITION_STRIDE = 3;
const BODY_STRIDE = 4;

function maxPain(agent: AgentState): number {
  const map = agent.body.bodyMap;
  if (!map) return 0;
  return Math.max(
    map.head.pain,
    map.torso.pain,
    map.leftArm.pain,
    map.rightArm.pain,
    map.leftLeg.pain,
    map.rightLeg.pain,
  );
}

function threatLoad(agent: AgentState): number {
  const healthScale = (agent.body.health ?? 1) > 1 ? 100 : 1;
  const healthDeficit = Math.max(0, 1 - (agent.body.health ?? healthScale) / healthScale);
  const hydrationStress = Math.max(0, 1 - (agent.body.hydration ?? 1));
  const fatigue = Math.max(0, Math.min(1, agent.body.fatigue ?? 0));
  return Math.max(0, Math.min(1, (healthDeficit + hydrationStress + fatigue) / 3));
}

export class SharedAgentState {
  public readonly positionsBuffer: SharedArrayBuffer;
  public readonly bodyBuffer: SharedArrayBuffer;
  public readonly activeBuffer: SharedArrayBuffer;
  public readonly capacity: number;

  private readonly positions: Float64Array;
  private readonly body: Float64Array;
  private readonly active: Int32Array;

  constructor(capacity: number) {
    this.capacity = Math.max(1, capacity);
    this.positionsBuffer = new SharedArrayBuffer(
      Float64Array.BYTES_PER_ELEMENT * this.capacity * POSITION_STRIDE,
    );
    this.bodyBuffer = new SharedArrayBuffer(
      Float64Array.BYTES_PER_ELEMENT * this.capacity * BODY_STRIDE,
    );
    this.activeBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * this.capacity);

    this.positions = new Float64Array(this.positionsBuffer);
    this.body = new Float64Array(this.bodyBuffer);
    this.active = new Int32Array(this.activeBuffer);
  }

  public writeAgents(agents: AgentState[]): void {
    const size = Math.min(agents.length, this.capacity);
    this.active.fill(0);

    for (let index = 0; index < size; index++) {
      const agent = agents[index];
      if (!agent) continue;

      this.active[index] = 1;
      const p = index * POSITION_STRIDE;
      this.positions[p] = agent.position.x;
      this.positions[p + 1] = agent.position.y;
      this.positions[p + 2] = agent.position.z;

      const b = index * BODY_STRIDE;
      const energyStress = Math.max(0, 1 - (agent.body.energy ?? 1));
      this.body[b] = energyStress;
      this.body[b + 1] = maxPain(agent);
      this.body[b + 2] = threatLoad(agent);
      this.body[b + 3] = agent.body.integrityDrive ?? 0;
    }
  }
}

export type SharedAgentSnapshot = {
  capacity: number;
  positionsBuffer: SharedArrayBuffer;
  bodyBuffer: SharedArrayBuffer;
  activeBuffer: SharedArrayBuffer;
};

export function toSnapshot(state: SharedAgentState): SharedAgentSnapshot {
  return {
    capacity: state.capacity,
    positionsBuffer: state.positionsBuffer,
    bodyBuffer: state.bodyBuffer,
    activeBuffer: state.activeBuffer,
  };
}
