import * as THREE from "three";

export type DisposeGraphOptions = {
  /** Dispose resources that are not explicitly marked shared. Defaults true for object-local cleanup. */
  disposeUnknown?: boolean;
  /** Remove the object from its parent after traversal. Defaults true. */
  removeFromParent?: boolean;
};

function isSharedResource(value: any): boolean {
  return !!value?.userData?.shared || !!value?.userData?.solcraftShared;
}

function disposeTexture(texture: any, disposeUnknown: boolean) {
  if (!texture?.isTexture) return;
  if (isSharedResource(texture)) return;
  if (disposeUnknown || texture.userData?.disposeOnRemove) texture.dispose?.();
}

function disposeMaterial(material: any, disposeUnknown: boolean) {
  if (!material || isSharedResource(material)) return;

  for (const key of [
    "map", "lightMap", "aoMap", "emissiveMap", "bumpMap", "normalMap",
    "roughnessMap", "metalnessMap", "alphaMap", "envMap", "gradientMap",
  ]) disposeTexture(material[key], disposeUnknown);

  if (disposeUnknown || material.userData?.disposeOnRemove) material.dispose?.();
}

/**
 * Removes a Three.js subtree and disposes only object-owned GPU resources.
 * Shared SolCraft prism/material caches must be marked with userData.shared=true;
 * those are intentionally skipped so one removed building cannot break others.
 */
export function safelyDisposeMeshGraph(target: THREE.Object3D | null | undefined, options: DisposeGraphOptions = {}) {
  if (!target) return;
  const disposeUnknown = options.disposeUnknown !== false;

  target.traverse((node: any) => {
    if (!node) return;

    if (node.geometry && !isSharedResource(node.geometry)) {
      if (disposeUnknown || node.geometry.userData?.disposeOnRemove) node.geometry.dispose?.();
    }

    const material = node.material;
    if (Array.isArray(material)) for (const mat of material) disposeMaterial(mat, disposeUnknown);
    else disposeMaterial(material, disposeUnknown);
  });

  if (options.removeFromParent !== false) target.parent?.remove(target);
}

export function markObjectGraphShared(target: THREE.Object3D | null | undefined) {
  target?.traverse?.((node: any) => {
    if (node.geometry?.userData) node.geometry.userData.shared = true;
    const material = node.material;
    const mats = Array.isArray(material) ? material : material ? [material] : [];
    for (const mat of mats) if (mat?.userData) mat.userData.shared = true;
  });
  return target;
}
