import { EventType } from "../../shared/events";
import type { AgentState, PhysiologyState, PrimitiveAction } from "../../shared/types";
import type { EventBus } from "../core/event-bus";
import {
  ActuationType,
  type MotorPlan,
  type MotorPrimitive,
  type PerceptualTarget,
} from "./action-grammar";

export type ActuationResult = {
  primitive: MotorPrimitive;
  success: boolean;
  failureReason?:
    | "target_not_found"
    | "target_out_of_range"
    | "body_part_unusable"
    | "too_heavy"
    | "blocked"
    | "invalid_state";

  bodyDelta?: Partial<PhysiologyState>;
  worldDeltaIds: string[];
  sensoryConsequences: string[]; // operator summaries only
};

/**
 * ActionExecutor handles both legacy primitive actions and v5.2 motor plans.
 * Legacy execution is kept for compatibility while migration is in progress.
 */
export class ActionExecutor {
  constructor(private eventBus: EventBus) {}

  public executeMotorPlan(
    agent: AgentState,
    plan: MotorPlan,
    tick: number,
    runId: string,
    branchId: string,
  ): ActuationResult[] {
    const results: ActuationResult[] = [];

    for (const primitive of plan.primitives) {
      this.eventBus.emit({
        event_id: crypto.randomUUID(),
        run_id: runId,
        branch_id: branchId,
        tick,
        type: EventType.ACTION_ATTEMPTED,
        agent_id: agent.id,
        payload: {
          source: plan.source,
          primitive,
        },
      });

      const result = this.executePrimitive(agent, primitive, tick);
      results.push(result);

      this.eventBus.emit({
        event_id: crypto.randomUUID(),
        run_id: runId,
        branch_id: branchId,
        tick,
        type: result.success ? EventType.ACTION_SUCCEEDED : EventType.ACTION_FAILED,
        agent_id: agent.id,
        payload: result.success
          ? { primitiveType: primitive.type }
          : { primitiveType: primitive.type, reason: result.failureReason },
      });
    }

    return results;
  }

  // Legacy compatibility execution path.
  public execute(
    agent: AgentState,
    action: PrimitiveAction,
    tick: number,
    runId: string,
    branchId: string,
  ): void {
    this.eventBus.emit({
      event_id: crypto.randomUUID(),
      run_id: runId,
      branch_id: branchId,
      tick,
      type: EventType.ACTION_ATTEMPTED,
      agent_id: agent.id,
      payload: { action },
    });

    let success = false;
    let failureReason = "";

    switch (action.type) {
      case "MOVE":
        success = this.handleMove(agent, action.forward);
        break;
      case "TURN":
        success = this.handleTurn(agent, action.deltaYaw);
        break;
      case "STOP":
        agent.currentAction = { type: "STOP" };
        success = true;
        break;
      case "REACH":
      case "GRASP":
      case "MOUTH_CONTACT":
      case "INGEST_ATTEMPT":
        agent.currentAction = action;
        success = true;
        break;
      case "VOCALIZE":
        this.handleVocalize(agent, action.token, action.intensity, tick, runId, branchId);
        success = true;
        break;
      case "REST":
        agent.currentAction = { type: "REST" };
        success = true;
        break;
      case "DEFER":
        agent.currentAction = undefined;
        success = true;
        break;
      default:
        failureReason = "unknown_action_type";
    }

    this.eventBus.emit({
      event_id: crypto.randomUUID(),
      run_id: runId,
      branch_id: branchId,
      tick,
      type: success ? EventType.ACTION_SUCCEEDED : EventType.ACTION_FAILED,
      agent_id: agent.id,
      payload: success
        ? { action_type: action.type }
        : { action_type: action.type, reason: failureReason },
    });
  }

  private executePrimitive(
    agent: AgentState,
    primitive: MotorPrimitive,
    tick: number,
  ): ActuationResult {
    switch (primitive.type) {
      case ActuationType.LOCOMOTE_TOWARD:
      case ActuationType.LOCOMOTE_AWAY:
      case ActuationType.LOCOMOTE_IDLE:
        return this.executeLocomotionPrimitive(agent, primitive);

      case ActuationType.REST_POSTURE:
      case ActuationType.LIE_DOWN:
        agent.currentAction = { type: "REST" };
        return this.success(primitive, undefined, ["posture adjusted"]);

      case ActuationType.GAZE_SCAN:
      case ActuationType.GAZE_AT:
      case ActuationType.SNIFF:
      case ActuationType.LISTEN:
      case ActuationType.OPEN_MOUTH:
      case ActuationType.REACH_TOWARD:
      case ActuationType.GRASP:
      case ActuationType.RELEASE:
      case ActuationType.PUSH:
      case ActuationType.PULL:
      case ActuationType.STRIKE:
      case ActuationType.CARRY:
      case ActuationType.PLACE:
      case ActuationType.CROUCH:
      case ActuationType.STAND_UP:
      case ActuationType.VOCALIZE:
        return this.success(primitive, undefined, ["primitive accepted"]);

      case ActuationType.LICK:
        if (!this.isPerceptualRefTarget(primitive.target)) {
          return this.fail(primitive, "invalid_state", ["lick requires perceptual reference"]);
        }
        return this.success(primitive, undefined, ["taste channel stimulated"]);

      case ActuationType.BITE:
      case ActuationType.CHEW:
        if (
          !this.isPerceptualRefTarget(primitive.target) ||
          primitive.target.ref !== "mouth_item"
        ) {
          return this.fail(primitive, "invalid_state", [
            "oral primitive requires mouth_item target",
          ]);
        }
        if (!agent.body.mouthItem) {
          return this.fail(primitive, "target_not_found", ["no mouth item present"]);
        }
        return this.success(primitive, undefined, ["oral pressure increased"]);

      case ActuationType.SWALLOW:
        if (
          !this.isPerceptualRefTarget(primitive.target) ||
          primitive.target.ref !== "mouth_item"
        ) {
          return this.fail(primitive, "invalid_state", [
            "swallow target must be perceptual ref mouth_item",
          ]);
        }
        if (!agent.body.mouthItem) {
          return this.fail(primitive, "target_not_found", ["mouth item missing"]);
        }

        agent.body.recentConsumptions = agent.body.recentConsumptions ?? [];
        agent.body.recentConsumptions.push({
          materialId: agent.body.mouthItem.materialId,
          quantity: agent.body.mouthItem.quantity,
          consumedAtTick: tick,
          onsetTick: tick,
          applied: false,
        });
        delete agent.body.mouthItem;
        return this.success(primitive, undefined, ["swallow completed"]);

      case ActuationType.SPIT:
        if (!agent.body.mouthItem) {
          return this.fail(primitive, "target_not_found", ["nothing to spit"]);
        }
        delete agent.body.mouthItem;
        return this.success(primitive, undefined, ["mouth item expelled"]);
    }
  }

  private executeLocomotionPrimitive(
    agent: AgentState,
    primitive: MotorPrimitive,
  ): ActuationResult {
    const target = primitive.target;
    if (!this.isDirectionTarget(target) && !this.isPerceptualRefTarget(target)) {
      return this.fail(primitive, "invalid_state", [
        "locomotion requires direction or perceptual_ref target",
      ]);
    }

    const baseDirection = this.resolveDirectionVector(target, primitive.type);
    const distance = Math.max(0.05, primitive.intensity) * 0.5;
    agent.position.x += baseDirection.x * distance;
    agent.position.z += baseDirection.z * distance;
    const forward = primitive.type === ActuationType.LOCOMOTE_AWAY ? -distance : distance;
    agent.currentAction = { type: "MOVE", forward };
    return this.success(primitive, undefined, ["locomotion applied"]);
  }

  private resolveDirectionVector(
    target:
      | Extract<PerceptualTarget, { type: "direction" }>
      | Extract<PerceptualTarget, { type: "perceptual_ref" }>,
    type: ActuationType,
  ): { x: number; z: number } {
    if (target.type === "perceptual_ref") {
      return type === ActuationType.LOCOMOTE_AWAY ? { x: -1, z: 0 } : { x: 1, z: 0 };
    }

    const vectorByDirection: Record<
      "front" | "left" | "right" | "behind",
      { x: number; z: number }
    > = {
      front: { x: 1, z: 0 },
      left: { x: 0, z: -1 },
      right: { x: 0, z: 1 },
      behind: { x: -1, z: 0 },
    };

    const resolved = vectorByDirection[target.direction];
    if (type === ActuationType.LOCOMOTE_AWAY) {
      return { x: -resolved.x, z: -resolved.z };
    }
    return resolved;
  }

  private isPerceptualRefTarget(
    target: PerceptualTarget,
  ): target is Extract<PerceptualTarget, { type: "perceptual_ref" }> {
    return target.type === "perceptual_ref" && typeof target.ref === "string";
  }

  private isDirectionTarget(
    target: PerceptualTarget,
  ): target is Extract<PerceptualTarget, { type: "direction" }> {
    return target.type === "direction";
  }

  private success(
    primitive: MotorPrimitive,
    bodyDelta?: Partial<PhysiologyState>,
    sensoryConsequences: string[] = [],
  ): ActuationResult {
    const result: ActuationResult = {
      primitive,
      success: true,
      worldDeltaIds: [],
      sensoryConsequences,
    };
    if (bodyDelta) {
      result.bodyDelta = bodyDelta;
    }
    return result;
  }

  private fail(
    primitive: MotorPrimitive,
    failureReason: NonNullable<ActuationResult["failureReason"]>,
    sensoryConsequences: string[] = [],
  ): ActuationResult {
    return {
      primitive,
      success: false,
      failureReason,
      worldDeltaIds: [],
      sensoryConsequences,
    };
  }

  private handleMove(agent: AgentState, forward: number): boolean {
    const yaw = Math.atan2(agent.facing.x, agent.facing.z);
    const dx = Math.sin(yaw) * forward;
    const dz = Math.cos(yaw) * forward;

    agent.position.x += dx;
    agent.position.z += dz;
    agent.currentAction = { type: "MOVE", forward };
    return true;
  }

  private handleTurn(agent: AgentState, deltaYaw: number): boolean {
    const currentYaw = Math.atan2(agent.facing.x, agent.facing.z);
    const nextYaw = currentYaw + deltaYaw;
    agent.facing.x = Math.sin(nextYaw);
    agent.facing.z = Math.cos(nextYaw);
    agent.currentAction = { type: "TURN", deltaYaw };
    return true;
  }

  private handleVocalize(
    agent: AgentState,
    token: string,
    intensity: number,
    tick: number,
    runId: string,
    branchId: string,
  ): void {
    this.eventBus.emit({
      event_id: crypto.randomUUID(),
      run_id: runId,
      branch_id: branchId,
      tick,
      type: EventType.VOCAL_ACTUATION,
      agent_id: agent.id,
      payload: {
        token,
        intensity,
        position: agent.position,
      },
    });
  }
}
