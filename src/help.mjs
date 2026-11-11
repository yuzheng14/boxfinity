// Use the browser's top layer so the help card can extend past the scrollable sidebar.
export function setupMeasurementHelp(){
  const trigger=document.querySelector('#measurement-help-button');
  const panel=document.querySelector('#measurement-help');
  const sidebar=document.querySelector('.sidebar');
  let pinned=false,closeTimer;
  const isOpen=()=>panel.matches(':popover-open');
  function position(){
    const anchor=trigger.getBoundingClientRect(),card=panel.getBoundingClientRect();
    const side=sidebar.getBoundingClientRect(),gap=12;
    const beside=side.right+gap+card.width<=innerWidth-gap;
    const left=beside?side.right+gap:anchor.left;
    const top=beside?anchor.top-12:anchor.bottom+10;
    panel.style.left=`${Math.max(gap,Math.min(left,innerWidth-card.width-gap))}px`;
    panel.style.top=`${Math.max(gap,Math.min(top,innerHeight-card.height-gap))}px`;
  }
  function open(){
    clearTimeout(closeTimer);
    if(!isOpen())panel.showPopover();
    trigger.setAttribute('aria-expanded','true');position();
  }
  function close(){
    clearTimeout(closeTimer);pinned=false;
    if(isOpen())panel.hidePopover();
    trigger.setAttribute('aria-expanded','false');
  }
  function scheduleClose(){
    clearTimeout(closeTimer);
    closeTimer=setTimeout(()=>{
      if(!pinned&&!trigger.matches(':hover')&&!panel.matches(':hover')&&document.activeElement!==trigger&&!panel.contains(document.activeElement))close();
    },140);
  }
  trigger.addEventListener('pointerenter',(event)=>{if(event.pointerType!=='touch')open();});
  trigger.addEventListener('pointerleave',scheduleClose);
  trigger.addEventListener('focus',open);
  trigger.addEventListener('blur',scheduleClose);
  trigger.addEventListener('click',()=>{if(pinned&&isOpen())close();else{pinned=true;open();}});
  panel.addEventListener('pointerenter',()=>clearTimeout(closeTimer));
  panel.addEventListener('pointerleave',scheduleClose);
  document.addEventListener('pointerdown',(event)=>{if(!trigger.contains(event.target)&&!panel.contains(event.target))close();});
  document.addEventListener('focusin',(event)=>{if(!trigger.contains(event.target)&&!panel.contains(event.target))close();});
  document.addEventListener('keydown',(event)=>{if(event.key==='Escape'&&isOpen()){event.preventDefault();close();}});
  document.querySelector('.sidebar-scroll').addEventListener('scroll',close,{passive:true});
  window.addEventListener('resize',()=>{if(isOpen())position();});
}
