// DEV-only top view planner. All dimensions and coordinates are metres.
// Sides: A bottom (+X), B right (+Z), V top (-X), G left (+Z).
// Opposite sides may have distinct lengths; in that case an open contour is intentional.
export const SIDE_IDS=['A','B','V','G'];
export const SIDE_NAMES={A:'А',B:'Б',V:'В',G:'Г'};
export const FILL_IDS=['picket','picket-double','horizontal','horizontal-double','sheet','jalousie'];
export const POST_MODES=['visible','behind'];
export const isHorizontalFill=fill=>fill==='horizontal'||fill==='horizontal-double';
export const normalizePostMode=(fill,mode)=>
  isHorizontalFill(fill)?'visible':mode==='behind'?'behind':'visible';
// Full-width vertical steel pickets only: NEVER trim terminal pickets.
// Without fitting, a visible end-margin warns that the selected gap is not exact.
// A one-click fit reduces the gap while keeping every 120 mm plank whole.
// Values are metres; independent sides can have different true fitted gaps.
export function verticalPicketPlan(spanWidth, requestedGap, fit=false, plank=.12){
  const width=Math.max(0,Number(spanWidth)||0);
  const gap=Math.max(0,Number(requestedGap)||0);
  const empty={strips:[],count:0,edgeMargin:width/2,gapUsed:gap,recommendedGap:null,
    canFit:false,adjusted:false,fullWidth:plank,width};
  if(width+1e-9<plank)return empty;
  const normalCount=Math.max(1,Math.floor((width+gap+1e-9)/(plank+gap)));
  const normalOccupied=normalCount*plank+(normalCount-1)*gap;
  const remainder=Math.max(0,width-normalOccupied);
  const maxWholeCount=Math.floor((width+1e-9)/plank);
  // Need one more full plank to reduce the gap and use up the empty end margins.
  // If no extra plank can fit, a gap reduction alone is not possible.
  const needFit=remainder>.0001;
  const fitCount=needFit?normalCount+1:normalCount;
  const canFit=!needFit || (fitCount<=maxWholeCount && fitCount>=2);
  const recommendedGap=!needFit?gap:
    canFit?(width-fitCount*plank)/(fitCount-1):null;
  const adjusted=Boolean(fit && needFit && canFit);
  const count=adjusted?fitCount:normalCount;
  const gapUsed=adjusted?Math.max(0,recommendedGap):gap;
  const occupied=count*plank+(count-1)*gapUsed;
  const edgeMargin=Math.max(0,(width-occupied)/2);
  const strips=[];
  for(let i=0;i<count;i++){
    strips.push({x:-width/2+edgeMargin+plank/2+i*(plank+gapUsed),width:plank});
  }
  return {strips,count,edgeMargin,gapUsed,recommendedGap,canFit,adjusted,fullWidth:plank,width};
}
export function verticalPicketLayout(spanWidth,gap,plank=.12){
  return verticalPicketPlan(spanWidth,gap,false,plank).strips;
}
export const RAL_IDS=['9003','8017','7016','7019','7024','9005','6005','3005','5005'];
const clamp=(n,min,max,fallback)=>{
  const value=Number(String(n).replace(',','.'));
  return Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback;
};
export function createDefaultSides(legacy={}) {
  const a={
    enabled:true,
    length:clamp(legacy.length,1,60,12),
    height:clamp(legacy.height,.8,3,1.8),
    step:clamp(legacy.step,1,3,2.5),
    fill:FILL_IDS.includes(legacy.fill)?legacy.fill:'picket',
    postMode:normalizePostMode(legacy.fill,legacy.postMode),
    ral:RAL_IDS.includes(legacy.ral)?legacy.ral:'7024'
  };
  return {
    A:a,
    B:{...a,enabled:false,length:10},
    V:{...a,enabled:false,length:a.length},
    G:{...a,enabled:false,length:10}
  };
}
export function normalizeSides(saved,legacy={}) {
  const defaults=createDefaultSides(legacy);
  return Object.fromEntries(SIDE_IDS.map(id=>{
    const previous=saved?.[id] && typeof saved[id]==='object'?saved[id]:{};
    const d=defaults[id];
    return [id,{
      enabled:typeof previous.enabled==='boolean'?previous.enabled:d.enabled,
      length:clamp(previous.length,1,60,d.length),
      height:clamp(previous.height,.8,3,d.height),
      step:clamp(previous.step,1,3,d.step),
      fill:FILL_IDS.includes(previous.fill)?previous.fill:d.fill,
      postMode:normalizePostMode(FILL_IDS.includes(previous.fill)?previous.fill:d.fill,previous.postMode??d.postMode),
      ral:RAL_IDS.includes(previous.ral)?previous.ral:d.ral
    }];
  }));
}
// Stage 4.1: one driveway opening on side A only (client price is not calculated).
// offset is measured from the left-hand beginning of A along its positive X axis.
export function normalizeSwingGate(saved, sideLength=12){
  const input=saved&&typeof saved==='object'?saved:{};
  const width=clamp(input.width,2,6,3.4);
  const offset=clamp(input.offset,0,Math.max(0,sideLength-width),1);
  return {enabled:input.enabled===true,type:'swing',width,offset};
}
export function getSiteLayout(sides, gateConfig=null) {
  const {A,B,V,G}=normalizeSides(sides);
  const requestedGate=normalizeSwingGate(gateConfig,A.length);
  const gateValid=requestedGate.enabled && A.enabled && A.length>=requestedGate.width;
  const gate=gateValid?{...requestedGate,sideId:'A',
    start:requestedGate.offset,end:requestedGate.offset+requestedGate.width}:null;
  const candidates=[
    {id:'A',side:A,start:{x:0,z:0},end:{x:A.length,z:0}},
    {id:'B',side:B,start:{x:A.length,z:0},end:{x:A.length,z:B.length}},
    {id:'V',side:V,start:{x:A.length,z:B.length},end:{x:A.length-V.length,z:B.length}},
    {id:'G',side:G,start:{x:0,z:G.length},end:{x:0,z:0}}
  ];
  const edges=candidates.filter(e=>e.side.enabled).map(e=>{
    const lengths=(e.id==='A' && gate)?
      [[0,gate.start],[gate.end,e.side.length]]:
      [[0,e.side.length]];
    const sections=lengths.filter(([from,to])=>to-from>.00001).map(([from,to])=>{
      const length=to-from;
      const count=Math.max(1,Math.ceil(length/e.side.step));
      return {from,to,length,count,span:length/count};
    });
    const count=sections.reduce((sum,section)=>sum+section.count,0);
    return {...e,sections,count,span:sections[0]?.span||0,
      fenceLength:sections.reduce((sum,section)=>sum+section.length,0),
      gate:e.id==='A'?gate:null};
  });
  const byCoordinate=new Map();
  const includePost=(x,z,height,id,gateSupport=false)=>{
    const key=Math.round(x*10000)+'|'+Math.round(z*10000);
    const entry=byCoordinate.get(key);
    if(entry){
      entry.height=Math.max(entry.height,height);
      if(!entry.sides.includes(id))entry.sides.push(id);
      if(gateSupport)entry.gateSupport=true;
    }else byCoordinate.set(key,{x,z,height,sides:[id],gateSupport});
  };
  for(const edge of edges){
    for(const section of edge.sections){
      for(let i=0;i<=section.count;i++){
        const fraction=(section.from+section.length*i/section.count)/edge.side.length;
        includePost(
          edge.start.x+(edge.end.x-edge.start.x)*fraction,
          edge.start.z+(edge.end.z-edge.start.z)*fraction,
          edge.side.height,edge.id
        );
      }
    }
    if(edge.gate){
      for(const localX of [edge.gate.start,edge.gate.end]){
        const f=localX/edge.side.length;
        includePost(edge.start.x+(edge.end.x-edge.start.x)*f,
          edge.start.z+(edge.end.z-edge.start.z)*f,edge.side.height,edge.id,true);
      }
    }
  }
  const posts=[...byCoordinate.values()];
  const perimeter=edges.reduce((sum,e)=>sum+e.side.length,0);
  const fenceLength=edges.reduce((sum,e)=>sum+e.fenceLength,0);
  const totalSpans=edges.reduce((sum,e)=>sum+e.count,0);
  const allVertices=edges.flatMap(e=>[e.start,e.end]);
  const minX=Math.min(0,...allVertices.map(p=>p.x));
  const maxX=Math.max(0,...allVertices.map(p=>p.x));
  const minZ=Math.min(0,...allVertices.map(p=>p.z));
  const maxZ=Math.max(0,...allVertices.map(p=>p.z));
  const warnings=[];
  if(A.enabled && B.enabled && V.enabled && G.enabled &&
    (Math.abs(A.length-V.length)>.001 || Math.abs(B.length-G.length)>.001)){
    warnings.push('Контур не замкнут: для прямоугольника длины А и В, Б и Г должны совпадать.');
  }
  if(requestedGate.enabled && !A.enabled)
    warnings.push('Чтобы добавить ворота, включите сторону А.');
  if(requestedGate.enabled && A.enabled && !gateValid)
    warnings.push('Проём ворот шире стороны А. Увеличьте сторону или уменьшите ширину ворот.');
  return {
    edges,posts,gate,gateSettings:requestedGate,perimeter,fenceLength,totalSpans,warnings,
    bounds:{minX,maxX,minZ,maxZ,centerX:(minX+maxX)/2,centerZ:(minZ+maxZ)/2,
      width:maxX-minX,depth:maxZ-minZ}
  };
}
