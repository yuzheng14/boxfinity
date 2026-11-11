import type { Part, Vec3, PlateItem } from './types.ts';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { partMesh } from './geometry.ts';
import { pointOnPlate } from './printing.ts';

export function partGeometry(part: Part, transform: (point: Vec3) => Vec3 = (point) => point) {
  const mesh = partMesh(part),
    geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(mesh.vertices.flatMap(transform), 3),
  );
  geometry.setIndex(mesh.triangles.flat());
  geometry.computeVertexNormals();
  return geometry;
}

// The same print-space transform is used by 3MF export and plate preview.
export function platePartGeometry(item: PlateItem) {
  return partGeometry(item.part, (point) => pointOnPlate(item.part, point, item));
}
