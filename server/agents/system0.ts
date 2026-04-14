import { type AgentState, type RawSensorBundle, SensorIndex } from "../../shared/types";
import { ActuationType, type MotorPlan } from "./action-grammar";

export type ReflexId =
  | "pain_withdrawal"
  | "startle_crouch"
  | "respiratory_gasp"
  | "collapse"
  | "thermal_recoil"
  | "jaw_reflex";

export type ReflexResult = {
  id: ReflexId;
  fired: boolean;
  motorPlan?: MotorPlan;
  causeSensor?: SensorIndex;
  intensity: number;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function maxBodyPain(agent: AgentState): number {
  return Math.max(...Object.values(agent.body.bodyMap).map((part) => part.pain));
}

function maxBodyTemperatureDeviation(agent: AgentState): number {
  return Math.max(
    ...Object.values(agent.body.bodyMap).map((part) =>
      Math.abs(part.temperature - agent.body.coreTemperature),
    ),
  );
}

function singlePrimitivePlan(
  tick: number,
  type: ActuationType,
  intensity: number,
  target:
    | { type: "self" }
    | { type: "perceptual_ref"; ref: string }
    | { type: "direction"; direction: "front" | "left" | "right" | "behind" }
    | { type: "none" },
): MotorPlan {
  return {
    source: "system0",
    urgency: clamp01(intensity),
    createdAtTick: tick,
    primitives: [
      {
        type,
        target,
        intensity: clamp01(intensity),
        durationTicks: 1,
      },
    ],
  };
}

export class System0 {
  execute(input: {
    agent: AgentState;
    sensorBundle?: RawSensorBundle;
    tick: number;
  }): ReflexResult[] {
    const { agent, sensorBundle, tick } = input;
    const results: ReflexResult[] = [];

    const pain = maxBodyPain(agent);
    const chestPressure =
      sensorBundle?.readings[SensorIndex.ChestPressure] ?? (1 - agent.body.oxygenation) ** 3;
    const radiantHeat = sensorBundle?.readings[SensorIndex.RadiantHeat] ?? 0;
    const temperatureDeviation = maxBodyTemperatureDeviation(agent);

    if (pain > 0.75) {
      results.push({
        id: "pain_withdrawal",
        fired: true,
        causeSensor: SensorIndex.PainTorso,
        intensity: pain,
        motorPlan: singlePrimitivePlan(tick, ActuationType.LOCOMOTE_AWAY, pain, {
          type: "direction",
          direction: "behind",
        }),
      });
    } else {
      results.push({
        id: "pain_withdrawal",
        fired: false,
        intensity: pain,
        causeSensor: SensorIndex.PainTorso,
      });
    }

    if (chestPressure > 0.85) {
      results.push({
        id: "respiratory_gasp",
        fired: true,
        causeSensor: SensorIndex.ChestPressure,
        intensity: chestPressure,
        motorPlan: singlePrimitivePlan(tick, ActuationType.LOCOMOTE_TOWARD, chestPressure, {
          type: "direction",
          direction: "front",
        }),
      });
    } else {
      results.push({
        id: "respiratory_gasp",
        fired: false,
        intensity: chestPressure,
        causeSensor: SensorIndex.ChestPressure,
      });
    }

    if (agent.body.health < 0.05) {
      results.push({
        id: "collapse",
        fired: true,
        intensity: 1 - agent.body.health,
        motorPlan: singlePrimitivePlan(tick, ActuationType.LIE_DOWN, 1 - agent.body.health, {
          type: "self",
        }),
      });
    } else {
      results.push({ id: "collapse", fired: false, intensity: 0 });
    }

    if (radiantHeat > 0.85 || temperatureDeviation > 8) {
      const intensity = Math.max(radiantHeat, clamp01(temperatureDeviation / 20));
      results.push({
        id: "thermal_recoil",
        fired: true,
        causeSensor: SensorIndex.RadiantHeat,
        intensity,
        motorPlan: singlePrimitivePlan(tick, ActuationType.LOCOMOTE_AWAY, intensity, {
          type: "direction",
          direction: "behind",
        }),
      });
    } else {
      results.push({
        id: "thermal_recoil",
        fired: false,
        intensity: radiantHeat,
        causeSensor: SensorIndex.RadiantHeat,
      });
    }

    if (agent.body.mouthItem && pain > 0.65) {
      results.push({
        id: "jaw_reflex",
        fired: true,
        intensity: pain,
        causeSensor: SensorIndex.PainHead,
        motorPlan: singlePrimitivePlan(tick, ActuationType.BITE, pain, {
          type: "perceptual_ref",
          ref: "mouth_item",
        }),
      });
    } else {
      results.push({
        id: "jaw_reflex",
        fired: false,
        intensity: pain,
        causeSensor: SensorIndex.PainHead,
      });
    }

    results.push({ id: "startle_crouch", fired: false, intensity: 0 });
    return results;
  }
}
