// Pinch is delivered as Ctrl+wheel by desktop browsers. Do not guess the
// device from delta size: a fast trackpad swipe must remain an orbit gesture.
export function wheelAction(event,width,height){
  const mode=event.deltaMode??0;
  const xUnit=mode===1?16:mode===2?width:1;
  const yUnit=mode===1?16:mode===2?height:1;
  const dx=event.deltaX*xUnit,dy=event.deltaY*yUnit;
  if(event.ctrlKey)return {type:'zoom',factor:Math.exp(-dy*.01)};
  return {type:'orbit',x:dx,y:dy};
}
