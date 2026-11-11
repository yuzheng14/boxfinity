import { DEFAULTS, settings, design, recommendGrids, display } from './core.mjs';
import { rectangleBetween, placementError, addPlacement, fillEmpty, exampleLayout } from './layout.mjs';
import { plate3MF, printBundle } from './export.mjs';
import { CabinetPreview } from './renderer.mjs';
import { setupMeasurementHelp } from './help.mjs';
import { preferredPrintVolume } from './printing.mjs';
const $=(selector)=>document.querySelector(selector);
const form=$('#settings-form'), stage=$('#stage'), storageKey='boxfinity.cabinet.v2';
const fields=Object.keys(DEFAULTS);
let state={settings:{...DEFAULTS},placements:[]}, result=null, selected=null, preview=null;
let tool='draw',brush={cols:1,rows:1},undo=[],redo=[],gesture=null,pending=null,toastTimer,exportResult=null,candidateKey='';
const clone=(value)=>structuredClone(value);
setupMeasurementHelp();
function toast(message){
  $('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>$('#toast').hidden=true,3500);
}
function readForm(){return Object.fromEntries(fields.map((key)=>{const raw=form.elements.namedItem(key).value;return [key,raw===''?NaN:Number(raw)];}));}
function setForm(cfg){for(const key of fields)form.elements.namedItem(key).value=cfg[key];}
function store(){try{localStorage.setItem(storageKey,JSON.stringify({app:'boxfinity',version:2,...state}));}catch{/* Browser storage is optional. */}}
function clearError(){
  $('#design-error').hidden=true;
  form.querySelectorAll('[aria-invalid]').forEach((el)=>el.removeAttribute('aria-invalid'));
}
function showError(error){
  $('#design-error').textContent=error.message;$('#design-error').hidden=false;
  $('#cell-size').textContent='—';
  if(error.field)form.elements.namedItem(error.field)?.setAttribute('aria-invalid','true');
  $('#export-button').disabled=true;$('#save-button').disabled=true;$('#export-selection').disabled=true;
  $('[data-view="plate"]').disabled=true;
  document.querySelectorAll('#fill-button,#example-button,#clear-button,#delete-button,.grid-option').forEach((button)=>button.disabled=true);
  $('#print-status').textContent='参数无效，请调整后继续';$('#print-status').classList.add('has-issues');
}
function commit(next,{message=null,history=true,syncForm=false}={}){
  try{
    const nextResult=design(next.settings,next.placements);
    if(history&&JSON.stringify(next)!==JSON.stringify(state)){undo.push(clone(state));if(undo.length>50)undo.shift();redo=[];}
    state={settings:nextResult.cfg,placements:nextResult.placements};result=nextResult;
    if(!result.boxes.some((box)=>box.id===selected))selected=null;
    clearError();if(syncForm)setForm(state.settings);render();store();if(message)toast(message);return true;
  }catch(error){showError(error);return false;}
}
function applyForm(){
  clearTimeout(pending);
  try{
    const cfg=settings(readForm());
    const changedGrid=cfg.cols!==state.settings.cols||cfg.rows!==state.settings.rows;
    commit({settings:cfg,placements:changedGrid?[]:state.placements},{message:changedGrid?'网格已更换，原布局可撤销恢复':null});
  }catch(error){showError(error);}
}
function refreshCandidates(){
  const key=JSON.stringify(state.settings);
  if(candidateKey===key)return;
  candidateKey=key;
  const options=recommendGrids(state.settings),fragment=document.createDocumentFragment();
  for(const option of options){
    const button=document.createElement('button');button.type='button';button.className='grid-option';
    const active=option.cols===state.settings.cols&&option.rows===state.settings.rows;
    button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
    button.textContent=option.name;
    button.setAttribute('aria-label',`${option.name}预设，${option.cols}列${option.rows}行`);
    button.title=`${option.cols} 列 × ${option.rows} 行`;
    button.addEventListener('click',()=>{
      if(option.cols===state.settings.cols&&option.rows===state.settings.rows)return;
      const cfg={...state.settings,cols:option.cols,rows:option.rows};
      commit({settings:cfg,placements:[]},{syncForm:true,message:'已应用预设行列，可在网格中绘制盒子；原布局可撤销'});
    });
    fragment.append(button);
  }
  $('#grid-candidates').replaceChildren(fragment);$('#no-candidates').hidden=options.length>0;
}
function renderBoxes(){
  $('#box-count').textContent=String(result.boxes.length);
  const fragment=document.createDocumentFragment();
  if(!result.boxes.length){const note=document.createElement('p');note.className='field-note';note.textContent='在右侧网格中拖选一个区域。';fragment.append(note);}
  for(const box of result.boxes){
    const button=document.createElement('button');button.className=`box-item${box.id===selected?' active':''}${box.printable?'':' oversize'}${result.warnings.some((warning)=>warning.boxId===box.id)?' has-warning':''}`;
    button.setAttribute('aria-label',`选择盒子 ${box.id}，${box.cols}乘${box.rows}`);
    button.setAttribute('aria-pressed',String(box.id===selected));
    button.innerHTML='<span class="box-index"></span><span class="box-span"></span><span class="box-state"></span>';
    button.querySelector('.box-index').textContent=String(box.id).padStart(2,'0');
    button.querySelector('.box-span').textContent=`${box.cols} × ${box.rows}`;
    const boxWarnings=result.warnings.filter((warning)=>warning.boxId===box.id);
    button.querySelector('.box-state').textContent=!box.printable?'超出最大范围':boxWarnings.some((warning)=>warning.needsSupport)?'可换向打印':boxWarnings.length?'留边提醒':'盒子 + 框套';
    button.title=[...result.issues,...boxWarnings].filter((issue)=>issue.boxId===box.id).map((issue)=>issue.message).join('；');
    button.addEventListener('click',()=>selectBox(box.id));fragment.append(button);
  }
  $('#box-list').replaceChildren(fragment);
  const box=result.boxes.find((item)=>item.id===selected);
  $('#selection-details').hidden=!box;$('#pull-button').disabled=!box||preview?.view==='plate';
  $('#delete-button').disabled=!box||!$('#design-error').hidden;
  if(box){
    $('#selection-title').textContent=`盒子 ${String(box.id).padStart(2,'0')} · ${box.cols} × ${box.rows}`;
    $('#drawer-dimensions').textContent=`${display(box.drawer.width)} × ${display(box.drawer.height)} × ${display(box.drawer.depth)} mm`;
    $('#frame-dimensions').textContent=`${display(box.frame.width)} × ${display(box.frame.depth)} × ${display(box.frame.height)} mm`;
    for(const type of ['drawer','frame']){
      const part=box[type],pose=part.print;
      const direction=pose.needsSupport?'侧放，可能需支撑':type==='frame'?'开口朝上':'底面朝下';
      $(`#${type}-print-dimensions`).textContent=`打印 XYZ：${pose.dimensions.map((n)=>display(n,2)).join(' × ')} mm\n${direction}`;
    }
    const notices=[...result.issues.filter((issue)=>issue.boxId===box.id),...result.warnings.filter((warning)=>warning.boxId===box.id)];
    $('#selection-warning').hidden=!notices.length;
    $('#selection-warning').replaceChildren(...notices.map((notice)=>{
      const line=document.createElement('p');line.className=notice.severity==='warning'?'pose-warning':'pose-error';line.textContent=notice.message;return line;
    }));
    $('#export-selection').disabled=!box.printable||!$('#design-error').hidden;
  }
}
function render(){
  refreshCandidates();renderBoxes();
  document.querySelectorAll('#fill-button,#example-button,#clear-button,.grid-option').forEach((button)=>button.disabled=false);
  $('#delete-button').disabled=selected===null;
  if(preview){preview.selected=selected;preview.update(result);}
  const {cfg,grid}=result;
  $('#cell-size').textContent=`${display(grid.unitWidth)} × ${display(grid.unitHeight)}`;
  $('#print-volume').textContent=`留边目标 XYZ：${preferredPrintVolume(cfg).map((n)=>display(n,2)).join(' × ')} mm`;
  $('#print-volume').hidden=cfg.margin===0;
  $('#margin-summary').textContent=`${display(cfg.margin)} mm`;
  $('#printer-extra').classList.toggle('has-margin',cfg.margin>0);
  $('#cabinet-caption').textContent=`${display(cfg.width)} × ${display(cfg.height)} × ${display(cfg.depth)} mm`;
  $('#grid-status').textContent=`${grid.cols} 列 × ${grid.rows} 行 · 单元 ${display(grid.unitWidth)} × ${display(grid.unitHeight)} mm`;
  $('#layout-status').textContent=`${result.boxes.length} 只盒子 · ${display(result.coverage,0)}% 已规划`;
  const status=$('#print-status');
  status.classList.toggle('has-issues',result.issues.length>0);
  status.classList.toggle('has-warnings',!result.issues.length&&result.warnings.length>0);
  status.textContent=result.issues.length?`${result.issues.length} 个零件超出打印范围`:result.boxes.length?`${result.parts.length} 个零件 · ${result.plates.length} 盘${result.warnings.length?` · ${result.warnings.length} 个零件有提醒`:''}`:'拖选网格开始设计';
  $('#empty-hint').hidden=result.boxes.length>0||preview?.view==='plate';
  $('#export-button').disabled=!result.printable;$('#save-button').disabled=false;
  $('#undo-button').disabled=!undo.length;$('#redo-button').disabled=!redo.length;
  $('[data-view="plate"]').disabled=!result.printable;
  if(preview?.view==='plate'&&!result.printable)setView('3d');
  updatePlateNavigation();
}
function selectBox(id){selected=id;preview?.select(id);renderBoxes();}
function addBox(rect){
  try{
    const next=addPlacement(state.placements,rect,result.grid),id=next.at(-1).id;
    selected=id;
    if(commit({...state,placements:next})){
      const box=result.boxes.find((box)=>box.id===id);
      if(!box.printable)toast('盒子已添加，红色零件超出打印范围，可缩小选区或调整打印范围');
    }
  }catch(error){toast(error.message);}
}
function deleteSelected(){
  if(selected===null||!$('#design-error').hidden)return;
  const next=state.placements.filter((box)=>box.id!==selected);selected=null;
  commit({...state,placements:next});
}
function restoreHistory(direction){
  clearTimeout(pending);
  const source=direction==='undo'?undo:redo,target=direction==='undo'?redo:undo;
  if(!source.length)return;
  const next=source.pop();target.push(clone(state));
  commit(next,{history:false,syncForm:true});
}
try{preview=new CabinetPreview($('#preview'),$('#grid-overlay'));}
catch(error){$('#preview-error').textContent=error.message;$('#preview-error').hidden=false;}
try{
  const saved=JSON.parse(localStorage.getItem(storageKey));
  if(saved?.app==='boxfinity'&&saved.version===2){const checked=design(saved.settings,saved.placements);state={settings:checked.cfg,placements:checked.placements};}
}catch{/* Ignore incompatible or corrupt browser drafts. */}
setForm(state.settings);commit(state,{history:false});
form.addEventListener('input',()=>{clearTimeout(pending);pending=setTimeout(applyForm,250);});
form.addEventListener('change',applyForm);
form.addEventListener('submit',(event)=>{event.preventDefault();applyForm();});
$('#undo-button').addEventListener('click',()=>restoreHistory('undo'));
$('#redo-button').addEventListener('click',()=>restoreHistory('redo'));
$('#delete-button').addEventListener('click',deleteSelected);
$('#clear-button').addEventListener('click',()=>commit({...state,placements:[]},{message:'布局已清空，可撤销恢复'}));
$('#fill-button').addEventListener('click',()=>commit({...state,placements:fillEmpty(state.placements,result.grid)}));
$('#example-button').addEventListener('click',()=>{const placements=exampleLayout(result.grid);selected=placements[0]?.id??null;commit({...state,placements},{message:'示例已载入，可继续绘制；原布局可撤销'});});
$('#reset-button').addEventListener('click',()=>{selected=null;preview?.reset();commit({settings:{...DEFAULTS},placements:[]},{syncForm:true,message:'已恢复默认，原方案可撤销'});});
for(const button of document.querySelectorAll('[data-brush]'))button.addEventListener('click',()=>{
  const [cols,rows]=button.dataset.brush.split(',').map(Number);brush={cols,rows};setTool('draw');
  document.querySelectorAll('[data-brush]').forEach((el)=>{const active=el===button;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});
});
function setTool(next){
  tool=next;
  if(preview?.view==='plate'||(next==='orbit'&&preview?.view==='front'))setView('3d');
  preview?.setTool(next);
  stage.classList.toggle('draw-tool',tool==='draw');stage.classList.toggle('orbit-tool',tool==='orbit');
  document.querySelectorAll('[data-tool]').forEach((button)=>{const active=button.dataset.tool===tool;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
  $('#tool-hint').textContent=tool==='draw'?'拖选绘制 · 双指旋转 · 捏合缩放 · Delete 删除':'双指滑动旋转 · 捏合缩放';
}
function setView(view){
  if(!preview)return;
  preview.setView(view);
  if(view==='front'&&tool==='orbit')setTool('draw');
  document.querySelectorAll('[data-view]').forEach((button)=>{const active=button.dataset.view===view;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
  $('#plate-navigation').hidden=view!=='plate';$('#empty-hint').hidden=result.boxes.length>0||view==='plate';
  $('#pull-button').disabled=selected===null||view==='plate';
  $('#view-caption').textContent=view==='plate'?'与 3MF 导出方向一致':'柜内 · 宽 × 高 × 深';
  $('#preview').setAttribute('aria-label',view==='plate'?'打印盘立体模型，拖动旋转、双指旋转、捏合缩放':'柜子三维模型，使用上方工具切换绘制或旋转');
  $('#grid-overlay').setAttribute('aria-label',view==='plate'?'打印盘零件与尺寸':'柜子正面网格');
  $('#plate-camera').hidden=view!=='plate';$('#pull-button').hidden=view==='plate';syncPlateCamera();
  $('.preview-workspace').classList.toggle('is-plate',view==='plate');
  $('#grid-overlay').classList.toggle('plate-overlay',view==='plate');
  stage.classList.toggle('plate-view',view==='plate');
  if(view==='plate')syncPlateCamera();
  else $('#tool-hint').textContent=tool==='draw'?'拖选绘制 · 双指旋转 · 捏合缩放 · Delete 删除':'双指滑动旋转 · 捏合缩放';
  updatePlateNavigation();
}
for(const button of document.querySelectorAll('[data-tool]'))button.addEventListener('click',()=>setTool(button.dataset.tool));
for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>setView(button.dataset.view));
$('#pull-button').addEventListener('click',()=>{
  if(!preview)return;preview.pull=!preview.pull;$('#pull-button').setAttribute('aria-pressed',String(preview.pull));preview.rebuild();
});
$('#zoom-in').addEventListener('click',()=>preview?.setZoom(preview.zoom*1.15));
$('#zoom-out').addEventListener('click',()=>preview?.setZoom(preview.zoom/1.15));
function syncPlateCamera(){
  if(preview?.view==='plate')$('#tool-hint').textContent='双指滑动旋转 · 捏合缩放';
  document.querySelectorAll('[data-plate-view]').forEach((button)=>button.setAttribute('aria-pressed',String(button.dataset.plateView===preview?.plateMode)));
}
for(const button of document.querySelectorAll('[data-plate-view]'))button.addEventListener('click',()=>{
  preview?.setPlateView(button.dataset.plateView);syncPlateCamera();
});
$('#view-reset').addEventListener('click',()=>{preview?.reset();syncPlateCamera();});
function updatePlateNavigation(){
  if(!result||!preview)return;
  const index=preview.plateIndex,plate=result.plates[index];
  $('#plate-counter').textContent=plate?`${index+1} / ${result.plates.length} 盘 · ${plate.items.length} 个零件`:'尚无打印盘';
  $('#previous-plate').disabled=index<=0;$('#next-plate').disabled=index>=result.plates.length-1;
  if(preview.view==='plate')$('#cabinet-caption').textContent=`${result.cfg.bedWidth} × ${result.cfg.bedDepth} mm`;
  else $('#cabinet-caption').textContent=`${display(result.cfg.width)} × ${display(result.cfg.height)} × ${display(result.cfg.depth)} mm`;
}
for(const [id,delta]of [['#previous-plate',-1],['#next-plate',1]])$(id).addEventListener('click',()=>{
  if(!preview)return;preview.plateIndex=Math.max(0,Math.min(result.plates.length-1,preview.plateIndex+delta));preview.rebuild();updatePlateNavigation();
});

// OrbitControls owns camera gestures on the canvas; capture only grid drawing here.
stage.addEventListener('pointerdown',(event)=>{
  if(!preview||event.button!==0||event.target.closest('button')||!$('#design-error').hidden)return;
  if(preview.view==='plate'||tool==='orbit')return;
  const cell=preview.cellAt(event.clientX,event.clientY);if(!cell)return;
  gesture={type:'draw',start:cell,end:cell,x:event.clientX,y:event.clientY,moved:false};
  const existing=state.placements.find((box)=>cell.col>=box.col&&cell.col<box.col+box.cols&&cell.row>=box.row&&cell.row<box.row+box.rows);
  gesture.existing=existing?.id??null;
  if(!existing){const rect={...cell,...brush};preview.ghost={...rect,invalid:!!placementError(rect,state.placements,result.grid)};preview.renderOverlay();}
  event.preventDefault();stage.setPointerCapture(event.pointerId);stage.classList.add('dragging');
});
stage.addEventListener('pointermove',(event)=>{
  if(!gesture||!preview)return;
  if(Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>5)gesture.moved=true;
  const end=preview.cellAt(event.clientX,event.clientY,true);if(!end)return;gesture.end=end;
  if(gesture.moved){const rect=rectangleBetween(gesture.start,end);preview.ghost={...rect,invalid:!!placementError(rect,state.placements,result.grid)};preview.renderOverlay();}
});
function finishGesture(event){
  if(!gesture||!preview)return;
  const current=gesture;gesture=null;stage.classList.remove('dragging');preview.ghost=null;
  if(event.type==='pointercancel'){preview.renderOverlay();return;}
  if(current.type==='draw'){
    if(!current.moved&&current.existing!==null)selectBox(current.existing);
    else addBox(current.moved?rectangleBetween(current.start,current.end):{...current.start,...brush});
  }
  preview.renderOverlay();
}
stage.addEventListener('pointerup',finishGesture);stage.addEventListener('pointercancel',finishGesture);
// Handle wheel gestures once in every view, including over the SVG editing layer.
stage.addEventListener('wheel',(event)=>{
  if(!preview)return;
  event.preventDefault();
  if(!event.ctrlKey&&(event.deltaX||event.deltaY)){
    if(preview.view==='front')setView('3d');
    else if(preview.view==='plate'&&preview.plateMode==='top'){preview.setPlateView('isometric');syncPlateCamera();}
  }
  preview.handleWheel(event);
},{passive:false});
$('#grid-overlay').addEventListener('keydown',(event)=>{
  if(event.key!=='Enter'&&event.key!==' ')return;
  const cell=event.target.closest('[data-col]');if(!cell)return;
  event.preventDefault();addBox({col:Number(cell.dataset.col),row:Number(cell.dataset.row),...brush});
});
document.addEventListener('keydown',(event)=>{
  if(event.target.matches('input,textarea,select')||document.querySelector('dialog[open]'))return;
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'){event.preventDefault();restoreHistory(event.shiftKey?'redo':'undo');}
  else if(event.key==='Delete'||event.key==='Backspace'){if(selected!==null){event.preventDefault();deleteSelected();}}
  else if(event.key==='Escape'){gesture=null;if(preview){preview.ghost=null;preview.renderOverlay();}}
});
function download(bytes,filename,type){
  const url=URL.createObjectURL(new Blob([bytes],{type})),link=Object.assign(document.createElement('a'),{href:url,download:filename});
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function downloadPlate(plate){download(plate3MF(plate),`boxfinity-cabinet-plate-${String(plate.id).padStart(2,'0')}.3mf`,'model/3mf');toast(`第 ${plate.id} 盘 3MF 已下载`);}
$('#download-plate').addEventListener('click',()=>{applyForm();const plate=result?.plates[preview?.plateIndex||0];if($('#design-error').hidden&&plate&&result.printable)downloadPlate(plate);});
function openExport(target){
  if(!target.printable)return;exportResult=target;
  $('#export-title').textContent='导出打印文件';
  $('#export-summary').textContent=`${target.boxes.length} 只盒子 + ${target.boxes.length} 个开放框套，共 ${target.plates.length} 盘。`;
  const notices=[];
  if(target.supportParts.length)notices.push(`${target.supportParts.length} 个零件需换方向，可能需要支撑`);
  if(target.marginParts.length)notices.push(`${target.marginParts.length} 个零件占用建议边距`);
  $('#export-orientation-note').textContent=notices.length?`${notices.join('；')}。模型均在最大打印范围内，切片时检查支撑、裙边等额外占位。`:'已保持建议留边，优先盒子底面朝下、框套开口朝上。导入切片软件后选择实际打印机与耗材。';
  $('#export-orientation-note').classList.toggle('pose-warning',target.warnings.length>0);
  const fragment=document.createDocumentFragment();
  for(const plate of target.plates){
    const row=document.createElement('div');row.className='export-row';
    const detail=document.createElement('div'),small=document.createElement('small'),button=document.createElement('button');
    detail.append(document.createTextNode(`打印盘 ${String(plate.id).padStart(2,'0')}`));
    small.textContent=plate.items.map(({part,orientation,usesReservedMargin})=>part.label+(orientation.needsSupport?'（换方向，可能需支撑）':'')+(usesReservedMargin?'（留边提醒）':'')).join('、');detail.append(small);
    button.className='text-button';button.textContent='下载 3MF';button.addEventListener('click',()=>downloadPlate(plate));
    row.append(detail,button);fragment.append(row);
  }
  $('#export-plates').replaceChildren(fragment);$('#export-dialog').showModal();
}
$('#export-button').addEventListener('click',()=>{applyForm();if($('#design-error').hidden)openExport(result);});
$('#export-selection').addEventListener('click',()=>{
  applyForm();if(!$('#design-error').hidden)return;
  const rect=state.placements.find((box)=>box.id===selected);if(rect)openExport(design(state.settings,[rect]));
});
$('#bundle-button').addEventListener('click',()=>{
  if(!exportResult)return;
  download(printBundle(exportResult),`boxfinity-cabinet-${exportResult.cfg.width}x${exportResult.cfg.height}.zip`,'application/zip');toast('盒子、框套与装配清单已下载');
});
$('#save-button').addEventListener('click',()=>{
  applyForm();if(!$('#design-error').hidden)return;
  download(JSON.stringify({app:'boxfinity',version:2,...state},null,2),'boxfinity-cabinet-design.json','application/json');toast('柜体方案已保存');
});
$('#import-button').addEventListener('click',()=>$('#import-file').click());
$('#import-file').addEventListener('change',async(event)=>{
  const file=event.target.files[0];if(!file)return;
  try{
    if(file.size>1_000_000)throw new Error('方案文件超过 1 MB');
    const value=JSON.parse(await file.text());
    if(value.app!=='boxfinity'||value.version!==2||!value.settings||!Array.isArray(value.placements))throw new Error('请选择新版柜内收纳方案 JSON');
    const checked=design(value.settings,value.placements);selected=null;
    commit({settings:checked.cfg,placements:checked.placements},{syncForm:true,message:'柜体方案已导入'});
  }catch(error){toast(`导入失败：${error.message}`);}
  event.target.value='';
});
$('#help-button').addEventListener('click',()=>$('#help-dialog').showModal());
for(const button of document.querySelectorAll('[data-close]'))button.addEventListener('click',()=>button.closest('dialog').close());
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',(event)=>{
  if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();
  if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();
});
