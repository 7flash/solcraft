import * as THREE from "three";
import type { PrismRecipePart } from "./buildingRecipes";

export type AddRecipePrism = (part: PrismRecipePart, renderOrder?: number) => THREE.Object3D | null | undefined;

export function maxRecipeHeight(parts: PrismRecipePart[]) {
  let maxY = 0;
  for (const p of parts) maxY = Math.max(maxY, Number(p.y || 0) + Number(p.h || 0));
  return maxY;
}

export function renderRecipeParts(parts: PrismRecipePart[], add: AddRecipePrism, renderOrder = 4) {
  const objects: THREE.Object3D[] = [];
  for (const p of parts) {
    const obj = add(p, renderOrder);
    if (obj) objects.push(obj);
  }
  return objects;
}
