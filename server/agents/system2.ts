import {
  INTEGRITY_DELTA_THRESHOLD,
  SYSTEM2_RANDOM_FIRE_CHANCE,
  URGENCY_THRESHOLD,
} from "../../shared/constants";
import type {
  AgentState,
  FilteredPercept,
  LexiconEntry,
  PerceptualRef,
  PrimitiveAction,
  System2Output,
  WorldConfig,
} from "../../shared/types";
import type { LLMGateway } from "../llm/gateway";
import { MerkleLogger } from "../persistence/merkle-logger";
import type { SpeciesRegistry } from "../species/registry";
import { ActuationType, type MotorPlan, type MotorPrimitive } from "./action-grammar";
import { checkImpossibleKnowledge } from "./impossible-knowledge-check";
import { buildSystem2Prompt, type System2PromptInput } from "./prompt-contract";
import type { QualiaFrame } from "./qualia-types";
import { parseSystem2Output, type System2JsonOutput } from "./system2-parser";

function toFallbackOutput(reason: string): System2Output {
  return {
    innerMonologue: reason,
    intention: "defer",
    decision: { type: "DEFER" },
    reflection: reason,
  };
}

function extractTargetRef(primitive: MotorPrimitive): string | null {
  if (primitive.target.type === "perceptual_ref") return primitive.target.ref;
  return null;
}

function firstPrimitiveToLegacyAction(
  primitive: MotorPrimitive | undefined,
  vocalization?: string,
): PrimitiveAction {
  if (!primitive) return { type: "DEFER" };
  const targetRef = extractTargetRef(primitive);

  switch (primitive.type) {
    case ActuationType.LOCOMOTE_TOWARD:
      return { type: "MOVE", forward: 1 };
    case ActuationType.LOCOMOTE_AWAY:
      return { type: "MOVE", forward: -1 };
    case ActuationType.LOCOMOTE_IDLE:
      return { type: "STOP" };
    case ActuationType.REACH_TOWARD:
      return targetRef ? { type: "REACH", targetId: targetRef } : { type: "DEFER" };
    case ActuationType.GRASP:
      return targetRef ? { type: "GRASP", targetId: targetRef } : { type: "DEFER" };
    case ActuationType.RELEASE:
    case ActuationType.PLACE:
      return targetRef ? { type: "DROP", targetId: targetRef } : { type: "DEFER" };
    case ActuationType.OPEN_MOUTH:
    case ActuationType.BITE:
    case ActuationType.CHEW:
    case ActuationType.SPIT:
    case ActuationType.LICK:
      return targetRef ? { type: "MOUTH_CONTACT", targetId: targetRef } : { type: "DEFER" };
    case ActuationType.SWALLOW:
      return targetRef ? { type: "INGEST_ATTEMPT", targetId: targetRef } : { type: "DEFER" };
    case ActuationType.REST_POSTURE:
    case ActuationType.LIE_DOWN:
    case ActuationType.CROUCH:
      return { type: "REST" };
    case ActuationType.VOCALIZE:
      return {
        type: "VOCALIZE",
        token: vocalization && vocalization.length > 0 ? vocalization : "uh",
        intensity: primitive.intensity,
      };
    default:
      return { type: "DEFER" };
  }
}

function buildQualiaFrame(agent: AgentState, tick: number, text: string): QualiaFrame {
  return {
    agentId: agent.id,
    tick,
    body: [],
    world: [],
    social: [],
    urges: [],
    memories: [],
    narratableText: text,
  };
}

function buildPerceptualRefs(percept: FilteredPercept): PerceptualRef[] {
  const refs: PerceptualRef[] = [
    {
      ref: "self",
      kind: "self",
      salience: 1,
    },
  ];

  for (const [index] of percept.primaryAttention.entries()) {
    refs.push({
      ref: `foreground_${index}`,
      kind: "visible_entity",
      approximateDirection: "front",
      salience: Math.max(0.2, 1 - index * 0.2),
    });
  }

  return refs;
}

function asMotorPlan(output: System2JsonOutput, tick: number): MotorPlan {
  return {
    source: "system2",
    urgency: 0.6,
    createdAtTick: tick,
    primitives: output.motorPlan.primitives,
    reason: "llm_system2_decision",
  };
}

function buildPromptInput(
  agent: AgentState,
  percept: FilteredPercept,
  tick: number,
  qualiaText: string,
): System2PromptInput {
  const qualia = buildQualiaFrame(agent, tick, qualiaText);
  const recentMemories = (Array.isArray(agent.episodicStore) ? agent.episodicStore : [])
    .slice(-5)
    .map((memory) => memory.qualiaText)
    .filter((item) => item.trim().length > 0);
  const semanticBeliefs = (Array.isArray(agent.semanticStore) ? agent.semanticStore : [])
    .slice(-5)
    .map((belief) => `${belief.concept}:${String(belief.value)}`);
  const availablePerceptualRefs = buildPerceptualRefs(percept);

  return {
    qualia,
    recentMemories,
    semanticBeliefs,
    availablePerceptualRefs,
    allowedActuations: Object.values(ActuationType),
  };
}

function toSystem2Output(parsed: System2JsonOutput, tick: number): System2Output {
  const motorPlan = asMotorPlan(parsed, tick);
  const output: System2Output = {
    innerMonologue: parsed.thought,
    intention: "act",
    decision: firstPrimitiveToLegacyAction(motorPlan.primitives[0], parsed.vocalization),
    reflection: parsed.memoryNote ?? "noted",
  };
  if (parsed.vocalization) {
    output.utterance = parsed.vocalization;
  }
  return output;
}

export class System2 {
  constructor(
    private gateway: LLMGateway,
    private speciesRegistry?: SpeciesRegistry,
  ) {}

  public shouldFire(
    agent: AgentState,
    bodyDelta: Record<string, unknown>,
    _percept: FilteredPercept,
    _config: WorldConfig,
  ): boolean {
    const oldIntegrity =
      typeof bodyDelta.previousIntegrityDrive === "number"
        ? bodyDelta.previousIntegrityDrive
        : (agent.body.integrityDrive ?? 0);
    const newIntegrity =
      typeof bodyDelta.currentIntegrityDrive === "number"
        ? bodyDelta.currentIntegrityDrive
        : typeof bodyDelta.integrityDrive === "number"
          ? bodyDelta.integrityDrive
          : (agent.body.integrityDrive ?? 0);
    const integrityDelta = Math.abs(newIntegrity - oldIntegrity);

    if (integrityDelta > INTEGRITY_DELTA_THRESHOLD) return true;
    if (newIntegrity > URGENCY_THRESHOLD) return true;
    if (Math.random() < SYSTEM2_RANDOM_FIRE_CHANCE) return true;
    return false;
  }

  public async think(
    agent: AgentState,
    qualiaText: string,
    filteredPercept: FilteredPercept,
    _config: WorldConfig,
    tick: number,
    branchId: string,
    options?: {
      urgencyOverride?: boolean;
      causal?: {
        qualiaPacketId: string;
        sourceTick: number;
      };
    },
  ): Promise<System2Output> {
    const species = this.speciesRegistry?.get(agent.speciesId);
    const promptInput = buildPromptInput(agent, filteredPercept, tick, qualiaText);
    if (species?.name) {
      promptInput.semanticBeliefs.push(`species:${species.name}`);
    }

    const prompt = buildSystem2Prompt(promptInput);
    const systemPrompt =
      "Return strict JSON only. Use perceptual references exactly as provided. Never output symbolic actions.";
    const rawResponse = await this.gateway.complete(agent.id, prompt, systemPrompt);
    const parsed = parseSystem2Output(rawResponse);

    let output = toFallbackOutput("invalid_output");
    if (parsed.ok) {
      const checked = checkImpossibleKnowledge({
        output: parsed.value,
        promptInput,
        lexicon: (Array.isArray(agent.lexicon) ? agent.lexicon : []) as LexiconEntry[],
      });
      output = checked.ok
        ? toSystem2Output(parsed.value, tick)
        : toFallbackOutput("knowledge_rejected");
    }

    MerkleLogger.log(
      tick,
      branchId,
      agent.id,
      "System2",
      "innerMonologue",
      null,
      output.innerMonologue,
      options?.causal?.qualiaPacketId ?? null,
      options?.causal
        ? `qualia_packet=${options.causal.qualiaPacketId};source_tick=${options.causal.sourceTick}`
        : null,
    );

    return output;
  }
}
