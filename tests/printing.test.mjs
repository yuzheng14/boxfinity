import test from 'node:test';
import assert from 'node:assert/strict';
import {design,packPlates} from '../src/core.mjs';
import {partMesh,meshVolume} from '../src/geometry.mjs';
import {PRINT_ORIENTATIONS,availablePrintVolume,preferredPrintVolume,dimensionsFor,orientPoint,printTransform,pointOnPlate,printFit} from '../src/printing.mjs';
import {modelXML,printBundle} from '../src/export.mjs';
// Keep the original nonzero margin explicit in the legacy screenshot regression.
const cfg={width:585,height:330,depth:330,bedWidth:330,bedDepth:320,bedHeight:325,margin:3};
const layout=[
  {id:1,col:0,row:3,cols:1,rows:3}, {id:2,col:0,row:2,cols:3,rows:1},
  {id:3,col:1,row:4,cols:4,rows:2}, {id:4,col:1,row:3,cols:1,rows:1},
  {id:5,col:2,row:3,cols:2,rows:1}, {id:6,col:5,row:4,cols:3,rows:2}, {id:7,col:8,row:4,cols:1,rows:2},
];
const near=(a,b,tolerance=1e-4)=>assert.ok(Math.abs(a-b)<tolerance,`${a} ≈ ${b}`);
const transformed=(v,m)=>[v[0]*m[0]+v[1]*m[3]+v[2]*m[6]+m[9],v[0]*m[1]+v[1]*m[4]+v[2]*m[7]+m[10],v[0]*m[2]+v[1]*m[5]+v[2]*m[8]+m[11]];
function storedEntry(bytes,wanted){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),decoder=new TextDecoder();let offset=0;
  while(view.getUint32(offset,true)===0x04034b50){
    const size=view.getUint32(offset+18,true),nameLength=view.getUint16(offset+26,true),extra=view.getUint16(offset+28,true),start=offset+30+nameLength+extra;
    const name=decoder.decode(bytes.slice(offset+30,offset+30+nameLength));
    if(name===wanted)return bytes.slice(start,start+size);offset=start+size;
  }
  throw new Error(`Missing ${wanted}`);
}
test('screenshot regression: requested 3mm margin warns without blocking a physically fitting layout',()=>{
  const r=design(cfg,layout);
  assert.deepEqual(availablePrintVolume(r.cfg),[330,320,325]);assert.deepEqual(preferredPrintVolume(r.cfg),[324,314,325]);
  assert.equal(r.boxes.length,7);assert.equal(r.occupied,25);assert.equal(r.issues.length,0);assert.equal(r.warnings.length,14);assert.equal(r.printable,true);
  assert.equal(r.marginParts.length,14);assert.equal(r.supportParts.length,7);
  assert.equal(r.cfg.margin,3);assert.deepEqual(r.placements,layout);
  assert.equal(r.boxes[0].frame.height,327);assert.equal(r.boxes[0].drawer.depth,326.5);
  assert.match(r.warnings.find((issue)=>issue.partId==='frame-1').message,/最小留边 1.5 mm.*建议的 3 mm/);
  assert.match(r.warnings.find((issue)=>issue.partId==='drawer-1').message,/最小留边 1.75 mm.*建议的 3 mm/);
  assert.doesNotThrow(()=>printBundle(r));
});
test('Z-only orientation limits are warnings when an alternative pose fits',()=>{
  for(const margin of [1.5,0]){
    const r=design({...cfg,margin},layout);
    assert.equal(r.issues.length,0);assert.equal(r.warnings.length,7);assert.equal(r.printable,true);
    for(const warning of r.warnings){assert.equal(warning.severity,'warning');assert.match(warning.message,/开口朝上时.*Z 需 327.*325.*多 2 mm.*可能需要支撑/);}
    assert.equal(r.supportParts.filter((part)=>part.type==='drawer').length,0);
    assert.equal(r.boxes[0].frame.height,327,'do not silently shorten the geometry to make it fit');
    assert.deepEqual(r.placements,layout,'orientation must not modify the front-grid design');
  }
});
test('normal drawers and sleeves retain their intended bed contact whenever possible',()=>{
  const r=design({},[{id:1,col:0,row:0,cols:3,rows:2}]);
  assert.equal(r.warnings.length,0);
  for(const plate of r.plates)for(const {orientation} of plate.items){assert.equal(orientation.axes[2],2);assert.equal(orientation.needsSupport,false);}
});
test('six poses are proper rotations with nonnegative bounds and preserved volume',()=>{
  const part=design(cfg,layout).boxes[0].frame,mesh=partMesh(part);
  for(const axes of PRINT_ORIENTATIONS){
    const item={x:4,y:5,orientation:{axes}},matrix=printTransform(part,item);
    const determinant=matrix[0]*(matrix[4]*matrix[8]-matrix[5]*matrix[7])-matrix[1]*(matrix[3]*matrix[8]-matrix[5]*matrix[6])+matrix[2]*(matrix[3]*matrix[7]-matrix[4]*matrix[6]);
    assert.equal(determinant,1,'never mirror a closed mesh');
    const vertices=mesh.vertices.map((v)=>transformed(v,matrix));
    for(let i=0;i<vertices.length;i++){
      const p=pointOnPlate(part,mesh.vertices[i],item),q=orientPoint(part,mesh.vertices[i],axes);
      for(let axis=0;axis<3;axis++){near(vertices[i][axis],p[axis]);near(vertices[i][axis],q[axis]+[4,5,0][axis]);}
    }
    const dims=dimensionsFor(part,axes);
    for(let axis=0;axis<3;axis++){near(Math.min(...vertices.map((v)=>v[axis])),[4,5,0][axis]);near(Math.max(...vertices.map((v)=>v[axis])),dims[axis]+[4,5,0][axis]);}
    near(meshVolume({...mesh,vertices}),meshVolume(mesh),1e-3);
  }
});
test('packing and exported 3MF use the same feasible XYZ poses, including side poses',()=>{
  const r=design({...cfg,margin:1.5},layout),ids=[];let sidePoses=0;
  for(const plate of r.plates){
    const xml=modelXML(plate.items),matrices=[...xml.matchAll(/transform="([^"]+)"/g)].map((m)=>m[1].split(' ').map(Number));
    assert.equal(matrices.length,plate.items.length);
    plate.items.forEach((item,index)=>{
      ids.push(item.part.id);if(item.orientation.needsSupport)sidePoses++;
      assert.deepEqual(item.part.print.dimensions,item.orientation.dimensions);
      assert.deepEqual(item.part.print.axes,item.orientation.axes);
      const points=partMesh(item.part).vertices.map((v)=>transformed(v,matrices[index]));
      for(const point of points){
        assert.ok(point[0]>=r.cfg.margin-1e-4&&point[0]<=r.cfg.bedWidth-r.cfg.margin+1e-4);
        assert.ok(point[1]>=r.cfg.margin-1e-4&&point[1]<=r.cfg.bedDepth-r.cfg.margin+1e-4);
        assert.ok(point[2]>=-1e-4&&point[2]<=r.cfg.bedHeight+1e-4);
      }
    });
  }
  assert.equal(new Set(ids).size,14);assert.equal(sidePoses,7);
});
test('warning-only layouts export support reminders and actual orientations',()=>{
  const r=design({...cfg,margin:1.5},layout),bytes=printBundle(r);
  const manifest=JSON.parse(new TextDecoder().decode(storedEntry(bytes,'assembly.json')));
  assert.deepEqual(manifest.availablePrintXYZ,[330,320,325]);
  assert.deepEqual(manifest.preferredPrintXYZ,[327,317,325]);
  assert.equal(manifest.plates.flatMap((p)=>p.placements).filter((item)=>item.checkSupports).length,7);
  assert.match(new TextDecoder().decode(storedEntry(bytes,'README.txt')),/7 个侧放零件/);
});
test('genuinely oversized parts remain errors rather than support warnings',()=>{
  const r=design({...cfg,depth:400,margin:0},layout);
  assert.equal(r.issues.length,14);assert.equal(r.warnings.length,0);assert.equal(r.printable,false);assert.throws(()=>printBundle(r),/打印范围/);
});

test('relaxed-margin plates and serialized geometry stay inside the actual machine, with no overlap',()=>{
  for(const margin of [3,10,20]){
    const r=design({...cfg,margin},layout);assert.ok(r.printable);const ids=[];
    for(const plate of r.plates){
      const matrices=[...modelXML(plate.items).matchAll(/transform="([^"]+)"/g)].map((m)=>m[1].split(' ').map(Number));
      plate.items.forEach((item,index)=>{
        ids.push(item.part.id);
        const points=partMesh(item.part).vertices.map((v)=>transformed(v,matrices[index]));
        for(const p of points)for(let axis=0;axis<3;axis++)assert.ok(p[axis]>=-1e-4&&p[axis]<=[330,320,325][axis]+1e-4);
        assert.deepEqual(item.part.print.dimensions,item.orientation.dimensions);
        assert.equal(item.part.print.usesReservedMargin,Object.values(item.edgeClearances).some((gap)=>gap<margin-1e-6));
        for(const other of plate.items)if(other!==item)assert.ok(item.x+item.width+4.999<=other.x||other.x+other.width+4.999<=item.x||item.y+item.depth+4.999<=other.y||other.y+other.depth+4.999<=item.y);
      });
    }
    assert.equal(new Set(ids).size,14);assert.equal(ids.length,14);
  }
});
test('ordinary parts preserve full margins even when reusing a tighter plate',()=>{
  const config=design(cfg).cfg;
  const large={id:'large',label:'长盒',type:'drawer',width:327,depth:100,height:40};
  const small={id:'small',label:'小盒',type:'drawer',width:50,depth:40,height:30};
  const plates=packPlates([large,small],config);assert.equal(plates.length,1);
  const a=plates[0].items.find((item)=>item.part.id==='large'),b=plates[0].items.find((item)=>item.part.id==='small');
  near(a.x,1.5);assert.equal(a.usesReservedMargin,true);assert.equal(b.usesReservedMargin,false);
  for(const gap of Object.values(b.edgeClearances))assert.ok(gap>=3-1e-6);
});
test('export records actual edge clearance and the unchanged requested margin',()=>{
  const r=design(cfg,layout),bytes=printBundle(r);
  const manifest=JSON.parse(new TextDecoder().decode(storedEntry(bytes,'assembly.json')));
  assert.equal(manifest.settings.margin,3);assert.deepEqual(manifest.availablePrintXYZ,[330,320,325]);assert.deepEqual(manifest.preferredPrintXYZ,[324,314,325]);
  const placed=manifest.plates.flatMap((plate)=>plate.placements);assert.equal(placed.length,14);assert.equal(placed.filter((item)=>item.checkClearance).length,14);
  assert.equal(placed.filter((item)=>item.checkSupports).length,7);
  for(const item of placed)for(const gap of Object.values(item.edgeClearances))assert.ok(gap>=-1e-6);
});
