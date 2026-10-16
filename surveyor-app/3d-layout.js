// DEV-only top view planner. All dimensions and coordinates are metres.
// Sides: A bottom (+X), B right (+Z), V top (-X), G left (+Z).
// Opposite sides may have distinct lengths; in that case an open contour is intentional.
export const SIDE_IDS=['A','B','V','G'];
export const SIDE_NAMES={A:'А',B:'Б',V:'В',G:'Г'};
export const FILL_IDS=['picket','picket-double','horizontal','horizontal-double','sheet','jalousie'];
export const RAL_IDS=['7024','8017','6005','9005','9003'];
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
      ral:RAL_IDS.includes(previous.ral)?previous.ral:d.ral
    }];
  }));
}
export function getSiteLayout(sides) {
  const {A,B,V,G}=normalizeSides(sides);
  const candidates=[
    {id:'A',side:A,start:{x:0,z:0},end:{x:A.length,z:0}},
    {id:'B',side:B,start:{x:A.length,z:0},end:{x:A.length,z:B.length}},
    {id:'V',side:V,start:{x:A.length,z:B.length},end:{x:A.length-V.length,z:B.length}},
    {id:'G',side:G,start:{x:0,z:G.length},end:{x:0,z:0}}
  ];
  const edges=candidates.filter(e=>e.side.enabled).map(e=>({
    ...e, count:Math.max(1,Math.ceil(e.side.length/e.side.step)),
    span:e.side.length/Math.max(1,Math.ceil(e.side.length/e.side.step))
  }));
  const byCoordinate=new Map();
  const includePost=(x,z,height,id)=>{
    const key=Math.round(x*10000)+'|'+Math.round(z*10000);
    const entry=byCoordinate.get(key);
    if(entry){
      entry.height=Math.max(entry.height,height);
      if(!entry.sides.includes(id))entry.sides.push(id);
    }else byCoordinate.set(key,{x,z,height,sides:[id]});
  };
  for(const edge of edges){
    for(let i=0;i<=edge.count;i++){
      const fraction=i/edge.count;
      includePost(
        edge.start.x+(edge.end.x-edge.start.x)*fraction,
        edge.start.z+(edge.end.z-edge.start.z)*fraction,
        edge.side.height,edge.id
      );
    }
  }
  const posts=[...byCoordinate.values()];
  const perimeter=edges.reduce((sum,e)=>sum+e.side.length,0);
  const totalSpans=edges.reduce((sum,e)=>sum+e.count,0);
  const allVertices=edges.flatMap(e=>[e.start,e.end]);
  const minX=Math.min(0,...allVertices.map(p=>p.x));
  const maxX=Math.max(0,...allVertices.map(p=>p.x));
  const minZ=Math.min(0,...allVertices.map(p=>p.z));
  const maxZ=Math.max(0,...allVertices.map(p=>p.z));
  const warnings=[];
  // Lengths are not implicitly changed: the estimator must approve closure.
  if(A.enabled && B.enabled && V.enabled && G.enabled &&
    (Math.abs(A.length-V.length)>.001 || Math.abs(B.length-G.length)>.001)){
    warnings.push('Контур не замкнут: для прямоугольника длины А и В, Б и Г должны совпадать.');
  }
  return {
    edges,posts,perimeter,totalSpans,warnings,
    bounds:{minX,maxX,minZ,maxZ,centerX:(minX+maxX)/2,centerZ:(minZ+maxZ)/2,
      width:maxX-minX,depth:maxZ-minZ}
  };
}
