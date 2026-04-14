import type { MotorPlan } from "./action-grammar";

export class ActionArbiter {
  choose(input: {
    reflexPlan?: MotorPlan;
    proceduralPlan?: MotorPlan;
    system2Plan?: MotorPlan;
    fallbackPlan: MotorPlan;
  }): MotorPlan {
    if (input.reflexPlan) return input.reflexPlan;
    if (input.proceduralPlan && input.proceduralPlan.urgency > 0.75) return input.proceduralPlan;
    if (input.system2Plan) return input.system2Plan;
    if (input.proceduralPlan) return input.proceduralPlan;
    return input.fallbackPlan;
  }
}
