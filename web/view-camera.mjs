import { Vector2, Vector3, Plane, Raycaster, MathUtils } from 'three';

export function boxCorners(box){
  const points=[];
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new Vector3(x,y,z));
  return points;
}

// Fit every corner, including its depth, rather than using a 2D bounding radius.
export function fitViewCamera(camera,box,width,height,{direction,zoom=1}={}){
  const center=box.getCenter(new Vector3()),size=box.getSize(new Vector3());
  const diagonal=Math.max(size.length(),1),eye=direction.clone().normalize();
  camera.position.copy(center).add(eye);camera.lookAt(center);camera.updateMatrixWorld(true);
  const right=new Vector3(1,0,0).applyQuaternion(camera.quaternion);
  const up=new Vector3(0,1,0).applyQuaternion(camera.quaternion);
  const aspect=width/height;
  const safeX=Math.max(.3,(width-120)/width),safeY=Math.max(.3,(height-130)/height);
  const corners=boxCorners(box).map((point)=>point.sub(center));
  let distance;
  if(camera.isPerspectiveCamera){
    camera.aspect=aspect;
    const tanY=Math.tan(MathUtils.degToRad(camera.fov/2)),tanX=tanY*aspect;
    distance=Math.max(...corners.flatMap((p)=>[
      p.dot(eye)+Math.abs(p.dot(right))/(tanX*safeX),
      p.dot(eye)+Math.abs(p.dot(up))/(tanY*safeY),
    ]))*1.05;
    camera.position.copy(center).addScaledVector(eye,distance/zoom);
    camera.zoom=1;
  }else{
    const halfWidth=Math.max(...corners.map((p)=>Math.abs(p.dot(right))));
    const halfHeight=Math.max(...corners.map((p)=>Math.abs(p.dot(up))));
    const extent=Math.max(halfHeight/safeY,halfWidth/aspect/safeX,1)*1.05;
    camera.left=-extent*aspect;camera.right=extent*aspect;camera.top=extent;camera.bottom=-extent;
    distance=diagonal*2;camera.position.copy(center).addScaledVector(eye,distance);camera.zoom=zoom;
  }
  camera.near=Math.max(.05,diagonal*.0001);
  camera.far=Math.max(distance/zoom+diagonal*5,diagonal*8);
  camera.lookAt(center);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  return {center,distance};
}

export function projectPoint(camera,point,width,height){
  const p=new Vector3(...point).project(camera);
  return [(p.x+1)*width/2,(1-p.y)*height/2];
}

export function gridCellAt(camera,x,y,width,height,cfg,grid,clamp=false){
  const raycaster=new Raycaster();
  raycaster.setFromCamera(new Vector2(x/width*2-1,1-y/height*2),camera);
  const plane=new Plane(new Vector3(0,-1,0),cfg.edge-.8);
  const hit=raycaster.ray.intersectPlane(plane,new Vector3());
  if(!hit)return null;
  let col=Math.floor((hit.x-cfg.edge)/grid.unitWidth);
  let row=Math.floor((cfg.height-cfg.edge-hit.z)/grid.unitHeight);
  if(clamp){col=Math.max(0,Math.min(grid.cols-1,col));row=Math.max(0,Math.min(grid.rows-1,row));}
  return col>=0&&col<grid.cols&&row>=0&&row<grid.rows?{col,row}:null;
}
