// DEV visual geometry for one cantilever sliding gate, independent of retail prices.
// Width is the axis-to-axis gateway dimension in metres, like swing gates.
// Tail/beam rule matches the separate KD sliding-gates calculator.
export const SLIDING_TAIL_SHAPES=['square','triangle'];
export function getSlidingGatePlan(opening,postWidth,sideHeight){
  const width=Number(opening.width),post=Number(postWidth),height=Number(sideHeight);
  if(!Number.isFinite(width)||width<2||width>5||!Number.isFinite(post)||
    post<=0||post>=width||!Number.isFinite(height)||height<.8||height>3.5)
    throw new Error('Недопустимые размеры откатных ворот 3D');
  const beam=width>=4.5?7:6;
  const tail=Math.max(0,Math.min(width/2,beam-width));
  const gateLength=width+tail;
  const sideClearance=.015;
  const left=post/2+sideClearance,right=width-post/2-sideClearance;
  const clearWidth=width-post;
  const panelWidth=right-left, bottom=.07, top=.05, leafHeight=height-bottom-top;
  const direction=opening.slideDirection==='right'?'right':'left';
  const tailShape=opening.tailShape==='triangle'?'triangle':'square';
  const tailFrom=direction==='left'?left-tail:right;
  const tailTo=direction==='left'?left:right+tail;
  const junction=direction==='left'?left:right;
  return {
    kind:'gate',type:'sliding',openingWidth:width,postWidth:post,clearWidth,
    sideClearance,beam,tail,gateLength,left,right,panelWidth,
    center:(left+right)/2,bottom,top,leafHeight,
    direction,tailShape,centerPost:opening.centerPost===true,
    tailFrom,tailTo,junction,tailTip:direction==='left'?tailFrom:tailTo,
    // -Z faces the street in local side space; a +Z offset places the gate
    // just inside the fence so its parked frame does not coplanar-z-fight.
    frameOffsetZ:.115
  };
}
export function getSlidingParkingWarning(opening,sideLength,otherOpenings=[]){
  if(opening.type!=='sliding')return null;
  const plan=getSlidingGatePlan(opening,.08,1.8);
  const sideStart=Number(opening.start);
  const from=sideStart+plan.tailFrom,to=sideStart+plan.tailTo;
  if(from<-.0001||to>sideLength+.0001)
    return 'Недостаточно места для хвостовика в пределах стороны: требуется '+plan.tail.toFixed(2).replace('.',',')+
      ' м в направлении отката. Проверьте положение ворот.';
  const overlaps=otherOpenings.some(o=>o!==opening&&o.kind==='wicket'&&
    Math.max(from,o.start)<Math.min(to,o.end)-.0001);
  return overlaps?'Хвостовик пересекает проём отдельной калитки. Измените отступ или направление отката.':null;
}
