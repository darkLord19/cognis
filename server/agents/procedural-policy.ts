import type { AgentState, PrimitiveAction } from "../../shared/types";
import { ActuationType, type MotorPlan } from "./action-grammar";
import type { LearnedAffordance } from "./affordance-learner";
import type { QualiaFrame } from "./qualia-types";

type SeededRng = {
  next(): number;
};

function defaultRng(): SeededRng {
  return {
    next: () => Math.random(),
  };
}

function fallbackExplorationPlan(tick: number, index: number): MotorPlan {
  const exploratory: Array<MotorPlan["primitives"][number]> = [
    { type: ActuationType.GAZE_SCAN, target: { type: "none" }, intensity: 0.4, durationTicks: 1 },
    {
      type: ActuationType.LOCOMOTE_TOWARD,
      target: { type: "direction", direction: "front" },
      intensity: 0.5,
      durationTicks: 1,
    },
    { type: ActuationType.SNIFF, target: { type: "none" }, intensity: 0.4, durationTicks: 1 },
    {
      type: ActuationType.REACH_TOWARD,
      target: { type: "none" },
      intensity: 0.5,
      durationTicks: 1,
    },
    { type: ActuationType.GRASP, target: { type: "none" }, intensity: 0.5, durationTicks: 1 },
    { type: ActuationType.LICK, target: { type: "none" }, intensity: 0.5, durationTicks: 1 },
    { type: ActuationType.SPIT, target: { type: "none" }, intensity: 0.6, durationTicks: 1 },
    {
      type: ActuationType.REST_POSTURE,
      target: { type: "self" },
      intensity: 0.4,
      durationTicks: 1,
    },
  ];

  return {
    source: "procedural",
    urgency: 0.35,
    createdAtTick: tick,
    primitives: [exploratory[index % exploratory.length] as MotorPlan["primitives"][number]],
    reason: "exploration",
  };
}

function toMotorPlanFromAffordance(tick: number, affordance: LearnedAffordance): MotorPlan {
  return {
    source: "procedural",
    urgency: affordance.confidence,
    createdAtTick: tick,
    primitives: [
      {
        type: affordance.motorPrimitiveType,
        target:
          affordance.targetSignature === "unknown"
            ? { type: "none" }
            : { type: "perceptual_ref", ref: affordance.targetSignature },
        intensity: Math.max(0.3, affordance.confidence),
        durationTicks: 1,
      },
    ],
    reason: "learned_affordance",
  };
}

export class ProceduralPolicy {
  private explorationCounter = 0;
  constructor(learner?: unknown) {
    void learner;
  }

  public propose(input: {
    agent: AgentState;
    qualiaFrame: QualiaFrame;
    sensorBundle: {
      readings: Float32Array;
    };
    learnedAffordances: LearnedAffordance[];
    tick: number;
    rng?: SeededRng;
  }): MotorPlan {
    const rng = input.rng ?? defaultRng();
    const strongest = input.learnedAffordances[0];
    if (strongest && strongest.confidence > 0.55) {
      return toMotorPlanFromAffordance(input.tick, strongest);
    }

    const exploratoryOffset = Math.floor(rng.next() * 8);
    const plan = fallbackExplorationPlan(input.tick, this.explorationCounter + exploratoryOffset);
    this.explorationCounter++;
    return plan;
  }

  // Compatibility API for existing orchestrator while migration is in progress.
  public proposeAction(
    agent: AgentState,
    _contextSignature: string,
    _availableActions: string[],
  ): PrimitiveAction | null {
    if (agent.body.integrityDrive > 0.8) {
      return { type: "REST" };
    }
    return null;
  }
}
