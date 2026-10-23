// Standalone product-only 3D layout. Never mutates or disables the site perimeter.
// The gate, wicket and sliding renderers consume the SAME getSiteLayout contract.
import {createDefaultSides,getSiteLayout,normalizeSwingGate,normalizeWicket,FILL_IDS} from './3d-layout.js';
import {getSlidingGatePlan} from './3d-sliding-frame.js';
import {getSlidingInstallationPlan} from './3d-sliding-installation.js';

export const PRODUCT_TYPES=['gate','wicket','pair','embedded','sliding'];
export const PRODUCT_LABELS={
  gate:'Только ворота',wicket:'Только калитка',pair:'Ворота + калитка',
  embedded:'Встроенная калитка',sliding:'Откатные ворота'
};
const clamp=(value,min,max,fallback)=>{
  const n=Number(String(value).replace(',','.'));
  return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;
};
export function normalizeProduct(source=null,fromSide=null,fromOpenings=null){
  const input=source&&typeof source==='object'?source:{};
  const side=fromSide||{};
  const postSize=[60,80,100].includes(Number(input.postSize))?
    Number(input.postSize):80;
  const kind=PRODUCT_TYPES.includes(input.type)?input.type:'pair';
  // This product-only UI accepts CLEAR widths, measured between inner
  // post faces. Do not use the axis-to-axis width of the site model.
  const gate=normalizeSwingGate(input.gate||fromOpenings?.gate,60);
  const wicket=normalizeWicket(input.wicket||fromOpenings?.wicket,60);
  const maxClearSliding=5-postSize/1000;
  // Minimum schematic stand-off to clear the guide/cantilever sweep near
  // posts, including the existing 25 mm visual safety allowance.
  const slidingTrackOffset=Math.ceil((postSize/2000+.066+.025+.005)*100)/100;
  return {
    type:kind,
    height:clamp(input.height,.8,3,side.height||1.8),
    fill:FILL_IDS.includes(input.fill)?input.fill:
      FILL_IDS.includes(side.fill)?side.fill:'sheet',
    ral:/^(9003|8017|7016|7019|7024|9005|6005|3005|5005)$/.test(input.ral)?
      input.ral:side.ral||'7024',
    postSize,
    gate:{...gate,
      type:kind==='sliding'?'sliding':'swing',
      width:clamp(gate.width,2,kind==='sliding'?maxClearSliding:6-postSize/1000,3.4),
      // Keep the isolated gate as close as the modelled carriage corridor
      // permits; never let the moving frame intersect the support posts.
      // 80 mm posts => 14 cm centre offset, rather than the previous 22 cm.
      trackOffset:kind==='sliding'?slidingTrackOffset:gate.trackOffset,
      fill:gate.fill==='side'?'side':gate.fill},
    wicket:{...wicket,width:clamp(wicket.width,.7,1.5,1)}
  };
}
export function getProductLayout(productDraft){
  const product=normalizeProduct(productDraft);
  const gateOn=product.type!=='wicket';
  const wicketOn=product.type==='wicket'||product.type==='pair';
  const sliding=product.type==='sliding';
  const embedded=product.type==='embedded';
  const postWidth=product.postSize/1000;
  // Existing 3D renderers use post-axis distances. Translate the customer
  // clear widths to post-axis distances ONLY in this temporary render layout.
  // Between-post clear = axis width minus one post profile width.
  const gate={...product.gate,enabled:gateOn,type:sliding?'sliding':'swing',
    // Workshop cantilever-gate main frame is 60x40, matching tail bracing.
    frameProfile:sliding?'60x40':product.gate.frameProfile,
    width:product.gate.width+postWidth,
    builtInWicket:embedded,offset:0,obstacles:[]};
  const wicket={...product.wicket,enabled:wicketOn,
    width:product.wicket.width+postWidth,offset:0};
  let leftParking=0,rightParking=0;
  if(sliding){
    const plan=getSlidingGatePlan(gate,product.postSize/1000,product.height);
    // In product-only mode show a CLEAR notional parking lane; it is not
    // confirmation that the customer's actual plot has enough free space.
    const reserve=plan.gateLength+.25;
    if(gate.slideDirection==='right')rightParking=reserve;
    else leftParking=reserve;
  }
  gate.offset=leftParking;
  wicket.offset=product.type==='pair'?gate.offset+gate.width:0;
  const productWidth=(gateOn?product.gate.width:0)+
    (wicketOn?product.wicket.width:0);
  const axisSpan=(gateOn?gate.width:0)+(wicketOn?wicket.width:0);
  const sideLength=Math.max(1,axisSpan+leftParking+rightParking);
  const sides=createDefaultSides({
    length:sideLength,height:product.height,step:2.5,fill:product.fill,
    ral:product.ral,postMode:'visible'
  });
  sides.A={...sides.A,enabled:true,length:sideLength,height:product.height,
    postMode:'visible'};
  const layout=getSiteLayout(sides,{A:{gate,wicket}},product.postSize);
  if(layout.edges.length!==1)throw new Error('Cannot build standalone product layout');
  const edge=layout.edges[0];
  // A product is NOT a fence: keep ONLY structural opening posts, including
  // the common middle post for a gate + separate wicket. Never create bays.
  layout.posts=layout.posts.filter(post=>post.gateSupport);
  edge.sections=[];
  edge.count=0;
  edge.span=0;
  edge.fenceLength=0;
  layout.fenceLength=0;
  layout.totalSpans=0;
  layout.perimeter=0;
  layout.warnings=[];
  if(sliding&&edge.gate){
    edge.installation=getSlidingInstallationPlan(edge.gate,sideLength,edge.openings,{
      postWidth:product.postSize/1000,sideHeight:product.height,
      postMode:'visible',posts:[edge.gate.start,edge.gate.end],sections:[]
    });
  }
  layout.product=true;
  layout.productType=product.type;
  layout.productWidth=productWidth;
  layout.productOverallWidth=axisSpan+postWidth;
  layout.productTrackOffset=sliding?gate.trackOffset:null;
  return layout;
}
