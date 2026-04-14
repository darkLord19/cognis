import type { EventBus } from "../../server/core/event-bus";
import { DEATH_CONCEPT_OBSERVATIONS_REQUIRED } from "../../shared/constants";
import { EventType } from "../../shared/events";
import type { AgentState, TechNode } from "../../shared/types";

export class TechTree {
  private nodes: Map<string, TechNode> = new Map();
  private discovered: Map<string, Set<string>> = new Map();

  constructor(private eventBus: EventBus) {}

  public load(nodes: TechNode[]): void {
    for (const node of nodes) {
      this.nodes.set(node.id, node);
    }
  }

  public checkDiscovery(
    _agentId: string,
    _context: { observationType?: string; target?: string },
  ): TechNode | null {
    return null;
  }

  public checkDeathConceptDiscovery(agent: AgentState): boolean {
    if (this.hasDiscovered(agent.id, "death_concept")) return false;

    let stillness = 0;
    let absentEmotions = 0;
    let coldBody = 0;

    for (const belief of agent.semanticStore) {
      if (belief.concept === "observed_agent_stillness") stillness += belief.sourceCount;
      if (belief.concept === "observed_absent_emotional_field")
        absentEmotions += belief.sourceCount;
      if (belief.concept === "observed_cold_body") coldBody += belief.sourceCount;
    }

    if (
      stillness >= DEATH_CONCEPT_OBSERVATIONS_REQUIRED &&
      absentEmotions >= DEATH_CONCEPT_OBSERVATIONS_REQUIRED &&
      coldBody >= DEATH_CONCEPT_OBSERVATIONS_REQUIRED
    ) {
      this.markDiscovered(agent.id, "death_concept");

      this.eventBus.emit({
        event_id: crypto.randomUUID(),
        branch_id: "main",
        run_id: "default",
        tick: Date.now(),
        type: EventType.DEATH_CONCEPT_DISCOVERED,
        agent_id: agent.id,
        payload: { message: "Agent has discovered the concept of death." },
      });

      agent.selfNarrative += "\\nI understand that we end. The stillness is permanent.";

      return true;
    }

    return false;
  }

  public hasDiscovered(agentId: string, techId: string): boolean {
    const set = this.discovered.get(agentId);
    return set ? set.has(techId) : false;
  }

  private markDiscovered(agentId: string, techId: string): void {
    let set = this.discovered.get(agentId);
    if (!set) {
      set = new Set();
      this.discovered.set(agentId, set);
    }
    set.add(techId);
  }

  public canTeach(teacher: AgentState, _studentId: string, techId: string): boolean {
    if (!this.hasDiscovered(teacher.id, techId)) return false;
    const node = this.nodes.get(techId);
    if (!node?.canBeTeaching) return false;

    for (const required of node.teachingRequiresLexicon) {
      const hasWord = teacher.lexicon.some((l) => l.concept === required);
      if (!hasWord) return false;
    }

    return true;
  }

  public teach(teacher: AgentState, student: AgentState, techId: string): void {
    if (this.canTeach(teacher, student.id, techId)) {
      this.markDiscovered(student.id, techId);
      this.eventBus.emit({
        event_id: crypto.randomUUID(),
        branch_id: "main",
        run_id: "default",
        tick: Date.now(),
        type: EventType.KNOWLEDGE_TRANSFERRED,
        agent_id: teacher.id,
        target_id: student.id,
        payload: { techId },
      });
    }
  }
}
