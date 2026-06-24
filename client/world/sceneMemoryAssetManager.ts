import * as THREE from "three";

export type DisposeObjectOptions = {
  detach?: boolean;
  disposeGeometry?: boolean;
  disposeMaterial?: boolean;
  disposeTextures?: boolean;
  sharedGeometries?: ReadonlySet<THREE.BufferGeometry>;
  sharedMaterials?: ReadonlySet<THREE.Material>;
  sharedTextures?: ReadonlySet<THREE.Texture>;
};

const TEXTURE_KEYS = [
  "map",
  "alphaMap",
  "aoMap",
  "bumpMap",
  "displacementMap",
  "emissiveMap",
  "envMap",
  "lightMap",
  "metalnessMap",
  "normalMap",
  "roughnessMap",
  "specularMap",
  "gradientMap",
];

export function disposeObject3D(target: THREE.Object3D | null | undefined, options: DisposeObjectOptions = {}) {
  if (!target) return;
  const opts = {
    detach: options.detach ?? true,
    disposeGeometry: options.disposeGeometry ?? true,
    disposeMaterial: options.disposeMaterial ?? true,
    disposeTextures: options.disposeTextures ?? true,
    sharedGeometries: options.sharedGeometries,
    sharedMaterials: options.sharedMaterials,
    sharedTextures: options.sharedTextures,
  };

  target.traverse((node: any) => {
    if (!(node?.isMesh || node?.isLine || node?.isPoints || node?.isSprite)) return;
    const geometry = node.geometry as THREE.BufferGeometry | undefined;
    if (opts.disposeGeometry && geometry && !opts.sharedGeometries?.has(geometry)) {
      geometry.dispose();
    }

    const materials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
    for (const material of materials) disposeMaterial(material, opts);
  });

  if (opts.detach) target.parent?.remove(target);
}

export function disposeMaterial(material: THREE.Material | null | undefined, options: DisposeObjectOptions = {}) {
  if (!material || options.sharedMaterials?.has(material)) return;

  if (options.disposeTextures ?? true) {
    for (const key of TEXTURE_KEYS) {
      const tex = (material as any)[key] as THREE.Texture | undefined;
      if (tex?.isTexture && !options.sharedTextures?.has(tex)) tex.dispose();
    }
  }

  material.dispose();
}
