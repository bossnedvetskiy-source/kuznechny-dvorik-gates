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
// The reservation is the FULL movable frame (opening plus counterweight),
// not just the tail visible while the gate is shut. Everything is measured
// in the selected side's LOCAL X direction and is independent of 3D camera.
export function getSlidingTravelPlan(opening,sideLength,otherOpenings=[],
  postWidth=.08,sideHeight=1.8){
  if(opening.type!=='sliding')return null;
  const plan=getSlidingGatePlan(opening,postWidth,sideHeight);
  const start=Number(opening.start??opening.offset??0);
  const side=Number(sideLength);
  if(!Number.isFinite(start)||!Number.isFinite(side)||side<=0)
    throw new Error('Недопустимая сторона для зоны отката');
  const toLeft=plan.direction==='left';
  const boundary=toLeft?start:start+plan.openingWidth;
  const required=plan.gateLength;
  const from=toLeft?boundary-required:boundary;
  const to=toLeft?boundary:boundary+required;
  const available=Math.max(0,toLeft?boundary:side-boundary);
  const shortage=Math.max(0,required-available);
  const wicketCollisions=otherOpenings.filter(o=>o!==opening&&o.kind==='wicket'&&
    Number.isFinite(Number(o.start))&&Number.isFinite(Number(o.end))&&
    Math.max(from,Number(o.start))<Math.min(to,Number(o.end))-.0001);
  const shift=opening.slideOpen===true?
    (toLeft?-plan.openingWidth:plan.openingWidth):0;
  const closedFrom=start+Math.min(plan.left,plan.tailFrom);
  const closedTo=start+Math.max(plan.right,plan.tailTo);
  const movingFrom=closedFrom+shift,movingTo=closedTo+shift;
  return {...plan,start,sideLength:side,boundary,required,available,shortage,
    from,to,shift,isOpen:opening.slideOpen===true,
    showZone:opening.showSlideZone!==false,
    wicketCollisions,valid:shortage<.0001&&!wicketCollisions.length,
    closedFrom,closedTo,movingFrom,movingTo};
}
export function getSlidingParkingWarning(opening,sideLength,otherOpenings=[]){
  const travel=getSlidingTravelPlan(opening,sideLength,otherOpenings);
  if(!travel)return null;
  const format=value=>value.toFixed(2).replace('.',',');
  const errors=[];
  if(travel.shortage>.0001)
    errors.push('Недостаточно места для полного открытия откатных ворот: нужно '+
      format(travel.required)+' м вдоль забора, доступно '+
      format(travel.available)+' м, не хватает '+format(travel.shortage)+' м.');
  if(travel.wicketCollisions.length)
    errors.push('Зона отката пересекает проём отдельной калитки. Измените отступ, место калитки или направление отката.');
  return errors.length?errors.join(' '):null;
}
