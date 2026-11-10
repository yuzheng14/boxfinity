import { BufferGeometry, Float32BufferAttribute } from 'three';
import { partMesh } from './geometry.mjs';
import { pointOnPlate } from './printing.mjs';

export function partGeometry(part,transform=(point)=>point){
  const mesh=partMesh(part),geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(mesh.vertices.flatMap(transform),3));
  geometry.setIndex(mesh.triangles.flat());geometry.computeVertexNormals();
  return geometry;
}

// The same print-space transform is used by 3MF export and plate preview.
export function platePartGeometry(item){
  return partGeometry(item.part,(point)=>pointOnPlate(item.part,point,item));
}
