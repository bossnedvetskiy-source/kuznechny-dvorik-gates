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
    const hingeSide=kind==='gate'&&i===1?'right':'left';
    const outerHingeEdge=hingeSide==='left'?left:right;
    const face=hingeSide==='left'?postFaceLeft:postFaceRight;
    const hingeAxis=(outerHingeEdge+face)/2;
    return {index:i+1,kind,width:leafWidth,height:leafHeight,left,right,
      center:(left+right)/2,hingeSide,hingeAxis,hingePostFace:face,
      freeSide:hingeSide==='left'?'right':'left',
      hingeHeights:[bottomClearance+Math.min(.27,leafHeight*.23),
        bottomClearance+leafHeight-Math.min(.27,leafHeight*.23)]};
  });
  return {kind,openingWidth:value,postWidth:post,clearWidth,leafCount:count,
    sideClearance,centreClearance:middleGap,bottomClearance,topClearance,
    leafHeight,leaves,totalHinges:count*GATE_FRAME_VISUAL.hingesPerLeaf};
}
