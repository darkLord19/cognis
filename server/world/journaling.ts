import type { EventBus } from "../../server/core/event-bus";
import { EventType } from "../../shared/events";
import type { AgentState, VoxelMarking } from "../../shared/types";
import type { VoxelGrid } from "./voxel-grid";

export type DiscoveredMarking = {
  meaning: string;
  status: "full" | "partial" | "none";
};

export class JournalingSystem {
  constructor(private eventBus: EventBus) {}

  public checkDiscovery(_agent: AgentState, _world: VoxelGrid): boolean {
    return false;
  }

  public markVoxel(
    agentId: string,
    x: number,
    y: number,
    z: number,
    text: string,
    language: string,
    tick: number,
    world: VoxelGrid,
  ): void {
    const v = world.get(x, y, z);
    if (!v) return;

    if (!v.metadata) {
      v.metadata = {};
    }

    if (!v.metadata.markings) {
      v.metadata.markings = [];
    }

    const marking: VoxelMarking = {
      agentId,
      tick,
      text,
      language,
    };

    v.metadata.markings.push(marking);
    world.set(x, y, z, v);

    this.eventBus.emit({
      event_id: crypto.randomUUID(),
      branch_id: "main",
      run_id: "default",
      tick,
      type: EventType.VOXEL_MARKED,
      agent_id: agentId,
      payload: { x, y, z, text },
    });
  }

  public discoverMarking(
    agent: AgentState,
    x: number,
    y: number,
    z: number,
    world: VoxelGrid,
  ): DiscoveredMarking | null {
    const v = world.get(x, y, z);
    if (!v?.metadata?.markings || v.metadata.markings.length === 0) return null;

    const marking = v.metadata.markings[v.metadata.markings.length - 1];
    if (!marking) return null;

    const words = marking.text.split(" ");
    let knownWords = 0;

    for (const word of words) {
      const known = agent.lexicon.some((l) => l.word === word);
      if (known) knownWords++;
    }

    const overlap = knownWords / words.length;

    if (overlap === 1.0) {
      return { meaning: "meaning recovered", status: "full" };
    } else if (overlap > 0) {
      return {
        meaning: "mysterious symbols, you sense meaning you cannot grasp",
        status: "partial",
      };
    } else {
      return { meaning: "marks on the stone, their purpose unknown", status: "none" };
    }
  }
}
