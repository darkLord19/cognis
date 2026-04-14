import { type MaterialDefinition, V1_MATERIALS } from "./material-affordances";

export type ResourceKernel = {
  materials: Record<string, MaterialDefinition>;
};

export const resourceKernel: ResourceKernel = {
  materials: V1_MATERIALS,
};

export function getResourceMaterial(id: string): MaterialDefinition | null {
  return resourceKernel.materials[id] ?? null;
}
