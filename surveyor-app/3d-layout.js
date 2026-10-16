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
// Both entrances are individually configurable on any of the four sides.
// Offsets are measured from the start of THAT side, following its local axis.
export function normalizeSwingGate(saved,sideLength=12){
  const input=saved&&typeof saved==='object'?saved:{};
  const width=clamp(input.width,2,6,3.4);
  return {enabled:input.enabled===true,type:'swing',width,
    offset:clamp(input.offset,0,Math.max(0,sideLength-width),1)};
}
export function normalizeWicket(saved,sideLength=12){
  const input=saved&&typeof saved==='object'?saved:{};
  const width=clamp(input.width,.7,1.5,1);
  return {enabled:input.enabled===true,type:'wicket',width,
    offset:clamp(input.offset,0,Math.max(0,sideLength-width),5)};
}
export function normalizeOpenings(sides,saved=null,legacyGate=null){
  const raw=saved&&typeof saved==='object'?saved:{};
  return Object.fromEntries(SIDE_IDS.map(id=>{
    const cfg=raw[id]&&typeof raw[id]==='object'?raw[id]:{};
    const side=sides[id];
    return [id,{gate:normalizeSwingGate(cfg.gate||(id==='A'?legacyGate:null),side.length),
      wicket:normalizeWicket(cfg.wicket,side.length)}];
  }));
}
function resolveSideOpenings(id,side,config,warnings){
  if(!side.enabled){
    if(config.gate.enabled||config.wicket.enabled)
      warnings.push('Чтобы добавить ворота или калитку, включите сторону '+SIDE_NAMES[id]+'.');
    return [];
  }
  const result=[];
  for(const kind of ['gate','wicket']){
    const item=config[kind];
    if(!item.enabled)continue;
    if(item.width>side.length+1e-8){
      warnings.push((kind==='gate'?'Ворота':'Калитка')+' на стороне '+SIDE_NAMES[id]+
        ' шире стороны. Измените длину стороны или ширину проёма.');
      continue;
    }
    let offset=Math.max(0,Math.min(side.length-item.width,item.offset));
    const overlaps=x=>result.some(p=>x<p.end-1e-8&&x+item.width>p.start+1e-8);
    if(overlaps(offset)){
      // Gate has priority. Find the closest free placement for the wicket,
      // keeping the support post at a shared border if openings touch.
      const candidates=[0,side.length-item.width,...result.flatMap(p=>
        [p.end,p.start-item.width])].filter(x=>x>=-1e-8&&x+item.width<=side.length+1e-8&&!overlaps(x));
      if(candidates.length){
        candidates.sort((a,b)=>Math.abs(a-offset)-Math.abs(b-offset));
        offset=Math.max(0,candidates[0]);
      }else{
        warnings.push('На стороне '+SIDE_NAMES[id]+' не хватает места для '+(kind==='gate'?'ворот':'калитки')+
          ' без пересечения. Измените размеры или положение проёмов.');
        continue;
      }
    }
    result.push({kind,type:item.type,sideId:id,width:item.width,
      start:offset,end:offset+item.width,offset});
  }
  return result.sort((a,b)=>a.start-b.start);
}
export function getSiteLayout(sides,openingsOrLegacyGate=null){
  const normalized=normalizeSides(sides);
  const {A,B,V,G}=normalized;
  // Compatibility with all previously saved A-side gate drafts / geometry tests.
  const isMulti=SIDE_IDS.some(id=>openingsOrLegacyGate?.[id]);
  const configured=normalizeOpenings(normalized,isMulti?openingsOrLegacyGate:null,
    isMulti?null:openingsOrLegacyGate);
  const candidates=[
    {id:'A',side:A,start:{x:0,z:0},end:{x:A.length,z:0}},
    {id:'B',side:B,start:{x:A.length,z:0},end:{x:A.length,z:B.length}},
    {id:'V',side:V,start:{x:A.length,z:B.length},end:{x:A.length-V.length,z:B.length}},
    {id:'G',side:G,start:{x:0,z:G.length},end:{x:0,z:0}}
  ];
  const warnings=[];
  const edges=candidates.filter(e=>e.side.enabled).map(e=>{
    const openings=resolveSideOpenings(e.id,e.side,configured[e.id],warnings);
    const sections=[];
    let cursor=0;
    for(const opening of openings){
      if(opening.start>cursor+.00001)sections.push([cursor,opening.start]);
      cursor=opening.end;
    }
    if(e.side.length>cursor+.00001)sections.push([cursor,e.side.length]);
    const fenceSections=sections.map(([from,to])=>{
      const length=to-from;
      const count=Math.max(1,Math.ceil(length/e.side.step));
      return {from,to,length,count,span:length/count};
    });
    return {...e,sections:fenceSections,
      count:fenceSections.reduce((sum,section)=>sum+section.count,0),
      span:fenceSections[0]?.span||0,
      fenceLength:fenceSections.reduce((sum,section)=>sum+section.length,0),
      openings,gate:openings.find(o=>o.kind==='gate')||null,
      wicket:openings.find(o=>o.kind==='wicket')||null};
  });
  for(const id of SIDE_IDS){
    if(!normalized[id].enabled)
      resolveSideOpenings(id,normalized[id],configured[id],warnings);
  }
  const byCoordinate=new Map();
  const includePost=(x,z,height,id,hingeSupport=false)=>{
    const key=Math.round(x*10000)+'|'+Math.round(z*10000);
    const entry=byCoordinate.get(key);
    if(entry){
      entry.height=Math.max(entry.height,height);
      if(!entry.sides.includes(id))entry.sides.push(id);
      if(hingeSupport)entry.gateSupport=true;
    }else byCoordinate.set(key,{x,z,height,sides:[id],gateSupport:hingeSupport});
  };
  for(const edge of edges){
    const coord=distance=>{
      const f=distance/edge.side.length;
      return {x:edge.start.x+(edge.end.x-edge.start.x)*f,
        z:edge.start.z+(edge.end.z-edge.start.z)*f};
    };
    for(const section of edge.sections){
      for(let i=0;i<=section.count;i++){
        const p=coord(section.from+section.length*i/section.count);
        includePost(p.x,p.z,edge.side.height,edge.id);
      }
    }
    for(const opening of edge.openings){
      for(const position of [opening.start,opening.end]){
        const p=coord(position);
        includePost(p.x,p.z,edge.side.height,edge.id,true);
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
  if(A.enabled && B.enabled && V.enabled && G.enabled &&
    (Math.abs(A.length-V.length)>.001 || Math.abs(B.length-G.length)>.001)){
    warnings.push('Контур не замкнут: для прямоугольника длины А и В, Б и Г должны совпадать.');
  }
  const allOpenings=edges.flatMap(e=>e.openings);
  return {edges,posts,openings:allOpenings,
    gate:edges.find(e=>e.id==='A')?.gate||null,
    gateSettings:configured.A.gate,perimeter,fenceLength,totalSpans,warnings,
    bounds:{minX,maxX,minZ,maxZ,centerX:(minX+maxX)/2,centerZ:(minZ+maxZ)/2,
      width:maxX-minX,depth:maxZ-minZ}
  };
}

// Dimensions measured between INSIDE FACES of adjacent metal posts, not post axes.
// Every segment is local to its edge (0 = edge start). The planning output is
// shared by 3D ground labels, the specification and unit tests.
export function getClearDimensionPlan(layout,postSizeMm=80){
  const postWidth=clamp(postSizeMm,60,100,80)/1000;
  const half=postWidth/2;
  return layout.edges.map(edge=>{
    const spans=[];
    for(const section of edge.sections){
      for(let index=0;index<section.count;index++){
        const leftAxis=section.from+index*section.span;
        const rightAxis=leftAxis+section.span;
        const from=leftAxis+half,to=rightAxis-half;
        spans.push({kind:'span',index:spans.length+1,from,to,
          clearMm:Math.max(0,Math.round((to-from)*1000))});
      }
    }
    for(const opening of edge.openings){
      const from=opening.start+half,to=opening.end-half;
      spans.push({kind:opening.kind,index:1,from,to,
        clearMm:Math.max(0,Math.round((to-from)*1000))});
    }
    return {id:edge.id,length:edge.side.length,postWidth,spans};
  });
}
