import type { SimEvent } from "../../shared/events";
import { EventType } from "../../shared/events";
import type { AgentState, MaterialType, PhysiologyState } from "../../shared/types";
import type { EventBus } from "../core/event-bus";
import {
  getMaterialAffordance,
  getMaterialDefinitionByMaterialType,
  type MaterialDefinition,
} from "./material-affordances";

export type IngestionInput = {
  agent: AgentState;
  material: MaterialDefinition;
  quantity: number;
  speciesId: string;
  tick: number;
};

export type IngestionResult = {
  immediatePhysiologyDelta: Partial<PhysiologyState>;
  delayedConsumption?: {
    materialId: string;
    quantity: number;
    consumedAtTick: number;
    onsetTick: number;
    applied: boolean;
  };
  emittedEvents: SimEvent[];
};

export function processMouthContact(input: IngestionInput): IngestionResult {
  const delayed =
    input.material.toxicity > 0
      ? {
          materialId: input.material.id,
          quantity: input.quantity,
          consumedAtTick: input.tick,
          onsetTick: input.tick + input.material.toxicityOnsetTicks,
          applied: false,
        }
      : null;

  return {
    immediatePhysiologyDelta: {},
    emittedEvents: [],
    ...(delayed ? { delayedConsumption: delayed } : {}),
  };
}

export function processSwallow(input: IngestionInput): IngestionResult {
  const digestibility = input.material.digestibilityBySpecies[input.speciesId] ?? 0;

  const immediateHydration = input.material.hydrationValue * input.quantity;
  const immediateEnergy =
    input.material.toxicity > 0
      ? 0
      : input.material.nutritionalValue * digestibility * input.quantity;

  const delayed =
    input.material.toxicity > 0
      ? {
          materialId: input.material.id,
          quantity: input.quantity,
          consumedAtTick: input.tick,
          onsetTick: input.tick + input.material.toxicityOnsetTicks,
          applied: false,
        }
      : null;

  return {
    immediatePhysiologyDelta: {
      hydration: immediateHydration,
      energyReserves: immediateEnergy,
    },
    ...(delayed ? { delayedConsumption: delayed } : {}),
    emittedEvents: [],
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function resolveMaterialDefinition(material: MaterialType): MaterialDefinition {
  const mapped = getMaterialDefinitionByMaterialType(material);
  if (mapped) return mapped;

  const legacy = getMaterialAffordance(material);
  return {
    id: material,
    density: 1,
    hardness: 0.2,
    thermalMass: 0.2,
    flammabilityCoefficient: 0,
    waterSolubility: 0,
    nutritionalValue: legacy.energyGain,
    hydrationValue: legacy.hydrationGain,
    toxicity: legacy.toxinLoad,
    toxicityOnsetTicks: legacy.toxinLoad > 0 ? 5 : 0,
    analgesicValue: 0,
    digestibilityBySpecies: { proto_human: 1, human: 1 },
    touchTexture: "soft",
  };
}

/**
 * Backward-compatible ingestion runner used by current orchestrator.
 */
export class IngestionSystem {
  constructor(private eventBus: EventBus) {}

  public process(
    agent: AgentState,
    material: MaterialType,
    tick: number,
    runId: string,
    branchId: string,
  ): void {
    const definition = resolveMaterialDefinition(material);
    const result = processSwallow({
      agent,
      material: definition,
      quantity: 1,
      speciesId: agent.speciesId,
      tick,
    });

    const hydrationDelta = result.immediatePhysiologyDelta.hydration ?? 0;
    const energyDelta = result.immediatePhysiologyDelta.energyReserves ?? 0;
    const toxinDelta = definition.toxicity;

    agent.body.hydration = clamp01(agent.body.hydration + hydrationDelta);
    agent.body.energy = clamp01(agent.body.energy + energyDelta);
    agent.body.toxinLoad = clamp01(agent.body.toxinLoad + toxinDelta);

    if (agent.body.physiology) {
      agent.body.physiology.hydration = clamp01(agent.body.physiology.hydration + hydrationDelta);
      agent.body.physiology.energyReserves = clamp01(
        agent.body.physiology.energyReserves + energyDelta,
      );
      agent.body.physiology.toxinLoad = clamp01(agent.body.physiology.toxinLoad + toxinDelta);
    }

    if (result.delayedConsumption) {
      agent.body.recentConsumptions = agent.body.recentConsumptions ?? [];
      agent.body.recentConsumptions.push(result.delayedConsumption);
    }

    this.eventBus.emit({
      event_id: crypto.randomUUID(),
      run_id: runId,
      branch_id: branchId,
      tick,
      type: EventType.INGESTION_OCCURRED,
      agent_id: agent.id,
      payload: {
        material: definition.id,
        gainEnergy: energyDelta,
        gainHydration: hydrationDelta,
      },
    });

    if (hydrationDelta > 0) {
      this.eventBus.emit({
        event_id: crypto.randomUUID(),
        run_id: runId,
        branch_id: branchId,
        tick,
        type: EventType.HYDRATION_IMPROVED,
        agent_id: agent.id,
        payload: { gain: hydrationDelta },
      });
    }

    if (energyDelta > 0) {
      this.eventBus.emit({
        event_id: crypto.randomUUID(),
        run_id: runId,
        branch_id: branchId,
        tick,
        type: EventType.ENERGY_IMPROVED,
        agent_id: agent.id,
        payload: { gain: energyDelta },
      });
    }

    if (toxins(result)) {
      this.eventBus.emit({
        event_id: crypto.randomUUID(),
        run_id: runId,
        branch_id: branchId,
        tick,
        type: EventType.TOXIN_EXPOSURE,
        agent_id: agent.id,
        payload: { load: toxinDelta },
      });
    }
  }
}

function toxins(result: IngestionResult): boolean {
  return Boolean(result.delayedConsumption);
}
