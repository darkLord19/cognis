import type { SenseProfile } from "../../shared/types";

export type SensoryApparatus = {
  visionRange: number;
  auditionRange: number;
  olfactionRange: number;
  empathicRange: number;
  tasteAcuity: number;
};

export function toLegacySenseProfile(input: SensoryApparatus): SenseProfile {
  return {
    sight: Math.max(0, input.visionRange),
    sound: Math.max(0, input.auditionRange),
    smell: Math.max(0, input.olfactionRange),
    empath: Math.max(0, input.empathicRange),
  };
}
