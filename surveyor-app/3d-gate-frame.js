// Geometry-only 3D model of swing gate / pedestrian wicket leaves.
// All dimensions in metres, relative to the opening's left post AXIS.
// Visualization defaults, not a steel fabrication drawing or load calculation.
export const GATE_FRAME_VISUAL={
  outerProfileWidth:.04,  // 40x25 mm outer frame, 2 mm wall in real production
  outerProfileDepth:.025,
  railWidth:.04, railDepth:.02, // 40x20 mm mid-rail
  diagonalWidth:.020,diagonalDepth:.020,
  sideClearance:.015,  // post inside face -> leaf outside face
  centreClearance:.020, // the required 20 mm gap between swing gate leaves
  bottomClearance:.070,topClearance:.050,
  hingeRadius:.012, hingeHeight:.070,hingesPerLeaf:2
};
export function getGateFramePlan(opening,postWidth,sideHeight){
  const kind=opening.kind==='wicket'?'wicket':'gate';
  const openDirection=opening.openDirection==='outward'?'outward':'inward';
  const count=kind==='gate'?2:1;
  const value=Number(opening.width),post=Number(postWidth),height=Number(sideHeight);
  if(!Number.isFinite(value)||!Number.isFinite(post)||!Number.isFinite(height)||
    value<=0||post<=0||post>=value||height<=.2)
    throw new Error('Invalid 3D gate opening, post or height');
  const {sideClearance,centreClearance,bottomClearance,topClearance}=GATE_FRAME_VISUAL;
  const clearWidth=value-post;
  const middleGap=count===2?centreClearance:0;
  const materialWidth=clearWidth-2*sideClearance-middleGap;
  const leafWidth=materialWidth/count;
  if(leafWidth<=.12)throw new Error('Opening too narrow for a framed 3D leaf');
  const leafHeight=height-bottomClearance-topClearance;
  if(leafHeight<=.24)throw new Error('Opening too low for a framed 3D leaf');
  const postFaceLeft=post/2,postFaceRight=value-post/2;
  const leaves=Array.from({length:count},(_,i)=>{
    const left=postFaceLeft+sideClearance+i*(leafWidth+middleGap);
    const right=left+leafWidth;
    const hingeSide=kind==='gate'?(i===1?'right':'left'):
      (opening.hingeSide==='right'?'right':'left');
    // Local +Z points inside the plot on each of its four perimeter sides.
    const swingAngle=(openDirection==='inward'?1:-1)*
      (hingeSide==='left'?-1:1)*Math.PI/6;
    const outerHingeEdge=hingeSide==='left'?left:right;
    const face=hingeSide==='left'?postFaceLeft:postFaceRight;
    const hingeAxis=(outerHingeEdge+face)/2;
    return {index:i+1,kind,width:leafWidth,height:leafHeight,left,right,
      center:(left+right)/2,hingeSide,hingeAxis,hingePostFace:face,
      swingAngle,freeSide:hingeSide==='left'?'right':'left',
      hingeHeights:[bottomClearance+Math.min(.27,leafHeight*.23),
        bottomClearance+leafHeight-Math.min(.27,leafHeight*.23)]};
  });
  // Inset door replaces part of one swing leaf, without creating another
  // fence opening or another ground post. It has a step-over bottom threshold.
  const embeddedRequested=kind==='gate'&&opening.builtInWicket===true;
  const embeddedSide=opening.builtInSide==='left'?'left':'right';
  const embeddedWidth=Math.min(1.2,Math.max(.7,Number(opening.builtInWidth)||1));
  const target=leaves[embeddedSide==='left'?0:1];
  const minFixedPart=.20;
  let embedded=null, embeddedWarning=null;
  if(embeddedRequested){
    const margin=.048; // 40 mm gate perimeter with some side clearance
    const fixedNeeded=minFixedPart;
    if(embeddedWidth>target.width-2*margin-fixedNeeded){
      embeddedWarning='Для встроенной калитки шириной '+
        embeddedWidth.toFixed(2).replace('.',',')+
        ' м не хватает места в створке. Увеличьте ширину ворот или уменьшите калитку.';
    }else{
      const nearFreeRight=target.freeSide==='right';
      const left=nearFreeRight?target.width/2-margin-embeddedWidth:
        -target.width/2+margin;
      const right=left+embeddedWidth;
      const hingeSide=nearFreeRight?'left':'right';
      const hingeX=hingeSide==='left'?left:right;
      const fixedLeft=nearFreeRight?-target.width/2+margin:right;
      const fixedRight=nearFreeRight?left:target.width/2-margin;
      embedded={
        leafIndex:target.index,side:embeddedSide,width:embeddedWidth,
        localLeft:left,localRight:right,hingeSide,hingeX,
        fixedLeft,fixedRight,fixedWidth:fixedRight-fixedLeft,
        bottomThreshold:.12,frameWidth:.06,frameDepth:.04,
        hingeHeights:[bottomClearance+.30,bottomClearance+leafHeight-.30]
      };
    }
  }
  return {kind,openDirection,openingWidth:value,postWidth:post,clearWidth,leafCount:count,
    sideClearance,centreClearance:middleGap,bottomClearance,topClearance,
    leafHeight,leaves,embedded,embeddedWarning,
    totalHinges:count*GATE_FRAME_VISUAL.hingesPerLeaf+(embedded?2:0)};
}
