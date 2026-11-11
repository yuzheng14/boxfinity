import {
  WebGLRenderer, Scene, Group, PerspectiveCamera, OrthographicCamera,
  Vector3, Box3, Mesh, BoxGeometry, MeshBasicMaterial, BufferGeometry,
  Float32BufferAttribute, LineSegments, LineBasicMaterial, EdgesGeometry,
  NoToneMapping, SRGBColorSpace,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { display } from './core.mjs';
import { partFits } from './printing.mjs';
import { partGeometry, platePartGeometry } from './view-geometry.mjs';
import { fitViewCamera, projectPoint, gridCellAt } from './view-camera.mjs';
import { wheelAction } from './view-input.mjs';

const svgNS='http://www.w3.org/2000/svg';
const svg=(name,attrs,text)=>{
  const el=document.createElementNS(svgNS,name);
  for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));
  if(text!==undefined)el.textContent=text;
  return el;
};
const directions={cabinet:new Vector3(.55,-1,.48),plate:new Vector3(.55,-1,1.05),front:new Vector3(0,-1,0),top:new Vector3(0,0,1)};

export class CabinetPreview {
  constructor(canvas,overlay){
    this.canvas=canvas;this.overlay=overlay;this.view='3d';this.tool='draw';
    this.selected=null;this.pull=true;this.plateIndex=0;this.plateMode='isometric';this.ghost=null;
    this.scene=new Scene();this.content=new Group();this.scene.add(this.content);
    this.renderer=new WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
    this.renderer.outputColorSpace=SRGBColorSpace;
    // A technical preview: uniform colors, true occlusion, no scene lighting or shadows.
    this.renderer.toneMapping=NoToneMapping;
    this.cameras={cabinet:new PerspectiveCamera(36,1,.1,10000),plate:new PerspectiveCamera(36,1,.1,10000),front:new OrthographicCamera(),top:new OrthographicCamera()};
    for(const camera of Object.values(this.cameras))camera.up.set(0,0,1);
    this.cameras.top.up.set(0,1,0);
    this.activeCamera=this.cameras.cabinet;this.orbits=new Map();
    for(const key of ['cabinet','plate','front','top']){
      const camera=this.cameras[key],controls=new OrbitControls(camera,canvas);
      controls.enabled=false;controls.enablePan=false;controls.enableZoom=false;controls.enableDamping=false;
      controls.enableRotate=camera.isPerspectiveCamera;
      if(camera.isPerspectiveCamera){controls.minPolarAngle=.12;controls.maxPolarAngle=Math.PI/2-.1;}
      if(key==='cabinet'){controls.minAzimuthAngle=-1.25;controls.maxAzimuthAngle=1.25;}
      controls.addEventListener('change',()=>{if(this.activeCamera===camera&&!this.adjusting)this.render();});
      controls.addEventListener('start',()=>canvas.parentElement.classList.add('dragging'));
      controls.addEventListener('end',()=>canvas.parentElement.classList.remove('dragging'));
      this.orbits.set(camera,controls);
    }
    this.observer=new ResizeObserver(()=>this.render());this.observer.observe(canvas);
  }
  get controls(){return this.orbits.get(this.activeCamera);}
  get orbitEnabled(){return !!this.controls?.enabled;}
  get zoom(){
    const camera=this.activeCamera;
    if(!camera.userData.framed)return 1;
    return camera.isPerspectiveCamera?camera.userData.fitDistance/camera.position.distanceTo(this.controls.target):camera.zoom;
  }
  update(result){this.result=result;this.plateIndex=Math.max(0,Math.min(this.plateIndex,result.plates.length-1));this.rebuild();}
  setView(view){this.view=view;this.ghost=null;this.rebuild();}
  setTool(tool){this.tool=tool;this.updateControls();}
  select(id){this.selected=id;this.rebuild();}
  setPlateView(mode){this.plateMode=mode;this.frameCamera();this.render();}
  updateControls(){
    for(const [camera,controls] of this.orbits)controls.enabled=camera===this.activeCamera&&camera.isPerspectiveCamera&&(this.view==='plate'||this.tool==='orbit');
  }
  handleWheel(event){
    const action=wheelAction(event,this.canvas.clientWidth,this.canvas.clientHeight);
    if(action.type==='zoom'){this.setZoom(this.zoom*action.factor);return;}
    if(!this.activeCamera.isPerspectiveCamera)return;
    this.adjusting=true;
    this.controls.rotateLeft(-action.x*.003);
    this.controls.rotateUp(-action.y*.003);
    this.adjusting=false;this.render();
  }
  setZoom(value){
    const zoom=Math.max(.35,Math.min(4,value)),camera=this.activeCamera;
    if(camera.isPerspectiveCamera){
      camera.position.sub(this.controls.target).normalize().multiplyScalar(camera.userData.fitDistance/zoom).add(this.controls.target);
      this.controls.update();
    }else{camera.zoom=zoom;camera.updateProjectionMatrix();this.controls.update();}
    this.render();
  }
  reset(){
    if(this.view==='plate'){
      this.plateMode='isometric';this.cameras.plate.userData.framed=false;this.cameras.top.userData.framed=false;
    }else this.activeCamera.userData.framed=false;
    this.frameCamera();this.render();
  }
  disposeContent(){
    const geometries=new Set(),materials=new Set();
    this.content.traverse((object)=>{if(object.geometry)geometries.add(object.geometry);if(object.material)materials.add(object.material);});
    this.content.clear();for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();
  }
  addLines(segments,color,opacity=1){
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(segments.flat(2),3));
    const material=new LineBasicMaterial({color,transparent:opacity<1,opacity,depthWrite:false});
    this.content.add(new LineSegments(geometry,material));
  }
  addBoard(width,depth,height,x,y,z,color){
    const mesh=new Mesh(new BoxGeometry(width,depth,height),new MeshBasicMaterial({color}));
    mesh.position.set(x,y,z);this.content.add(mesh);
  }
  addPart(part,geometry){
    const selected=part.boxId===this.selected;
    const warning=part.print?.needsSupport||part.print?.usesReservedMargin;
    const fits=partFits(part,this.result.cfg);
    const color=!fits?0xc58777:selected?0xd9bc8d:part.type==='frame'?0xaab4bb:0xd4cab8;
    const mesh=new Mesh(geometry,new MeshBasicMaterial({color,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1}));
    mesh.userData.boxId=part.boxId;
    this.content.add(mesh);
    const edges=new LineSegments(new EdgesGeometry(geometry,28),new LineBasicMaterial({color:!fits?0xa35949:selected?0x9b713b:warning?0x9e895e:0x70766e,transparent:true,opacity:selected ? .9 : .6,depthWrite:false}));
    this.content.add(edges);
  }
  rebuild(){
    if(!this.result)return;
    this.disposeContent();
    const {cfg,grid,boxes,plates}=this.result,isPlate=this.view==='plate';
    const items=plates[this.plateIndex]?.items||[];
    const w=isPlate?cfg.bedWidth:cfg.width,d=isPlate?cfg.bedDepth:cfg.depth;
    const h=isPlate?Math.max(1,...items.map(({part,orientation})=>orientation?.height??part.height)):cfg.height;
    this.worldWidth=w;this.worldDepth=d;this.worldHeight=h;
    this.bounds=new Box3(new Vector3(0,!isPlate&&this.selected!==null&&this.pull?-grid.depth*.55:0,0),new Vector3(w,d,h));
    if(isPlate){
      this.addBoard(w,d,3,w/2,d/2,-2.2,0xe5e8e9);
      const lines=[];
      for(let x=0;x<=w;x+=10)lines.push([[x,0,-.4],[x,d,-.4]]);
      for(let y=0;y<=d;y+=10)lines.push([[0,y,-.4],[w,y,-.4]]);
      this.addLines(lines,0xb5bfc0,.55);
      this.addLines([[[0,0,-.3],[w,0,-.3]],[[w,0,-.3],[w,d,-.3]],[[w,d,-.3],[0,d,-.3]],[[0,d,-.3],[0,0,-.3]]],0x929e9e);
      for(const item of items)this.addPart(item.part,platePartGeometry(item));
    }else{
      // A cutaway cabinet: a solid back and floor distinguish the opening from the rear.
      this.addBoard(w,d,3,w/2,d/2,-1.5,0xe5e7e0);
      this.addBoard(w,3,h,w/2,d+1.5,h/2,0xeeeFE9);
      const corners=[[0,0,0],[w,0,0],[w,0,h],[0,0,h],[0,d,0],[w,d,0],[w,d,h],[0,d,h]];
      this.addLines([[0,1],[1,2],[2,3],[3,0]].map(([a,b])=>[corners[a],corners[b]]),0x8b958b,.85);
      this.addLines([[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]].map(([a,b])=>[corners[a],corners[b]]),0xbcc4b9,.7);
      const gridLines=[];
      const rectangle=(rect)=>{
        const x=cfg.edge+rect.col*grid.unitWidth,z=cfg.height-cfg.edge-rect.row*grid.unitHeight,y=cfg.edge-.8;
        const a=[x,y,z],b=[x+rect.cols*grid.unitWidth,y,z],c=[b[0],y,z-rect.rows*grid.unitHeight],e=[x,y,c[2]];
        gridLines.push([a,b],[b,c],[c,e],[e,a]);
      };
      for(let row=0;row<grid.rows;row++)for(let col=0;col<grid.cols;col++){
        if(!boxes.some((box)=>col>=box.col&&col<box.col+box.cols&&row>=box.row&&row<box.row+box.rows))rectangle({col,row,cols:1,rows:1});
      }
      this.addLines(gridLines,0xa4b09e,.45);
      for(const box of boxes){
        const offset=box.id===this.selected&&this.pull?grid.depth*.5:0;
        this.addPart(box.frame,partGeometry(box.frame,([x,y,z])=>[box.x+x,cfg.edge+grid.depth-z,box.z+y]));
        this.addPart(box.drawer,partGeometry(box.drawer,([x,y,z])=>[box.x+cfg.frameWall+cfg.fit+x,cfg.edge+y-offset,box.z+cfg.frameWall+cfg.fit+z]));
      }
    }
    this.frameCamera();this.render();
  }
  frameCamera(){
    if(!this.bounds||!this.canvas.clientWidth||!this.canvas.clientHeight)return;
    const key=this.view==='front'?'front':this.view==='plate'?(this.plateMode==='top'?'top':'plate'):'cabinet';
    const camera=this.activeCamera=this.cameras[key],controls=this.orbits.get(camera),framed=camera.userData.framed;
    const zoom=framed?(camera.isPerspectiveCamera?camera.userData.fitDistance/camera.position.distanceTo(controls.target):camera.zoom):1;
    const direction=framed?camera.position.clone().sub(controls.target):directions[key];
    this.adjusting=true;
    const {center,distance}=fitViewCamera(camera,this.bounds,this.canvas.clientWidth,this.canvas.clientHeight,{direction,zoom});
    camera.userData.fitDistance=distance;camera.userData.framed=true;
    controls.target.copy(center);
    controls.minDistance=distance/4;controls.maxDistance=distance/.35;
    controls.minZoom=.35;controls.maxZoom=4;controls.update();
    this.adjusting=false;this.updateControls();
  }
  project(point){return projectPoint(this.activeCamera,point,this.canvas.clientWidth,this.canvas.clientHeight);}
  cellAt(clientX,clientY,clamp=false){
    if(this.view==='plate'||!this.result)return null;
    const rect=this.canvas.getBoundingClientRect();
    return gridCellAt(this.activeCamera,clientX-rect.left,clientY-rect.top,rect.width,rect.height,this.result.cfg,this.result.grid,clamp);
  }
  rectPoints(rect){
    const {cfg,grid}=this.result,x=cfg.edge+rect.col*grid.unitWidth,z=cfg.height-cfg.edge-rect.row*grid.unitHeight,y=cfg.edge-.8;
    const w=rect.cols*grid.unitWidth,h=rect.rows*grid.unitHeight;
    return [[x,y,z],[x+w,y,z],[x+w,y,z-h],[x,y,z-h]].map((p)=>this.project(p));
  }
  render(){
    if(!this.result||!this.canvas.clientWidth||!this.canvas.clientHeight)return;
    const cw=this.canvas.clientWidth,ch=this.canvas.clientHeight;
    if(this.cameraState?.cw!==cw||this.cameraState?.ch!==ch){
      this.renderer.setSize(cw,ch,false);this.frameCamera();
    }
    this.cameraState={cw,ch};
    this.renderer.render(this.scene,this.activeCamera);this.renderOverlay();
  }
  renderOverlay() {
    const {cfg,grid,boxes}=this.result,{cw,ch}=this.cameraState;
    this.overlay.setAttribute('viewBox',`0 0 ${cw} ${ch}`);
    const root=document.createDocumentFragment();
    const label=(text,point,className)=>root.append(svg('text',{x:point[0],y:point[1],class:className,'text-anchor':'middle','dominant-baseline':'middle'},text));
    if(this.view==='plate'){
      const m=cfg.margin;
      if(m>0){
        const boundary=[[m,m,0],[cfg.bedWidth-m,m,0],[cfg.bedWidth-m,cfg.bedDepth-m,0],[m,cfg.bedDepth-m,0]].map((p)=>this.project(p));
        root.append(svg('polygon',{points:boundary.map((p)=>p.join(',')).join(' '),class:'margin-guide'}));
      }
      for(const item of this.result.plates[this.plateIndex]?.items||[]){
        const p=this.project([item.x+item.width/2,item.y+item.depth/2,(item.orientation?.height??item.part.height)+.1]);
        label(`${item.part.type==='frame'?'框套':'盒子'} ${item.part.boxId}${item.orientation?.needsSupport?' · 侧放':''}`,p,'part-label');
      }
      label(`X ${cfg.bedWidth} mm`,this.project([cfg.bedWidth/2,-14,0]),'dimension-label');
      label(`Y ${cfg.bedDepth} mm`,this.project([cfg.bedWidth+18,cfg.bedDepth/2,0]),'dimension-label');
    }else{
      for(let row=0;row<grid.rows;row++)for(let col=0;col<grid.cols;col++){
        if(boxes.some((box)=>col>=box.col&&col<box.col+box.cols&&row>=box.row&&row<box.row+box.rows))continue;
        const points=this.rectPoints({col,row,cols:1,rows:1});
        root.append(svg('polygon',{points:points.map((p)=>p.join(',')).join(' '),class:'grid-cell','data-col':col,'data-row':row,role:'button',tabindex:0,'aria-label':`第${col+1}列，第${row+1}行`}));
      }
      for(const box of boxes){
        const points=this.rectPoints(box),selected=box.id===this.selected;
        const offset=selected&&this.pull?grid.depth*.5:0;
        const center=this.project([box.x+box.frame.width/2,cfg.edge-offset-.2,box.z+box.frame.depth/2]);
        label(`${box.cols} × ${box.rows}`,center,`box-label${selected?' selected':''}`);
        if(box.cols*box.rows>=2)label(String(box.id).padStart(2,'0'),[center[0],center[1]+17],'box-number');
      }
      if(this.ghost){
        const points=this.rectPoints(this.ghost);
        root.append(svg('polygon',{points:points.map((p)=>p.join(',')).join(' '),class:`ghost${this.ghost.invalid?' invalid':''}`}));
        label(`${this.ghost.cols} × ${this.ghost.rows}`,[(points[0][0]+points[2][0])/2,(points[0][1]+points[2][1])/2],'ghost-label');
      }
      label(`宽 ${display(cfg.width)} mm`,this.project([cfg.width/2,-4,-22]),'dimension-label');
      label(`高 ${display(cfg.height)} mm`,this.project([-28,-4,cfg.height/2]),'dimension-label');
    }
    this.overlay.replaceChildren(root);
  }
}
