import type { ActuatorProfile } from "../agents/actuator-system";

export type SpeciesActuatorProfile = ActuatorProfile;

export const DEFAULT_ACTUATOR_PROFILE: SpeciesActuatorProfile = {
  canWalk: true,
  canGrasp: true,
  hasMouth: true,
  hasJaw: true,
  canVocalize: true,
  maxReachVoxels: 2,
  maxCarryMass: 20,
  biteForce: 0.5,
  movementSpeed: 1,
  staminaCostMultiplier: 1,
};
