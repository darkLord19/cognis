export type ActuatorProfile = {
  canWalk: boolean;
  canGrasp: boolean;
  hasMouth: boolean;
  hasJaw: boolean;
  canVocalize: boolean;

  maxReachVoxels: number;
  maxCarryMass: number;
  biteForce: number;
  movementSpeed: number;
  staminaCostMultiplier: number;
};
