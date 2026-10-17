// Geometric site-assessment preview (metres), NOT engineering approval.
// Positive local Z is toward the site, independently on each perimeter side.
import {getSlidingTravelPlan} from './3d-sliding-frame.js';

const number=(value,min,max,fallback)=>{
  const n=Number(String(value).replace(',','.'));
  return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
};
const intersect=(a,b,c,d)=>Math.max(a,c)<Math.min(b,d)-.0001;
export function normalizeSlidingObstacles(values,sideLength=12){
  if(!Array.isArray(values))return [];
  return values.slice(0,8).map((o,index)=>{
    const src=o&&typeof o==='object'?o:{};
    return {id:String(src.id||('obstacle-'+index)).slice(0,48),
      type:['tree','wall','pillar','other'].includes(src.type)?src.type:'other',
      offset:number(src.offset,0,Math.max(0,sideLength),0),
      width:number(src.width,.1,3,.5),
      // Centre distance from the fence's local Z=0 plane into the plot.
      distance:number(src.distance,-1,2,.22),
      depth:number(src.depth,.1,2,.4),
      height:number(src.height,.2,5,1.5)};
  });
}
export function getSlidingInstallationPlan(opening,sideLength,otherOpenings=[],
  options={}){
  if(opening?.type!=='sliding')return null;
  const postWidth=number(options.postWidth,.06,.1,.08);
  const sideHeight=number(options.sideHeight,.8,3.5,1.8);
  const travel=getSlidingTravelPlan(opening,sideLength,otherOpenings,
    postWidth,sideHeight);
  const trackOffset=number(opening.trackOffset,.10,.60,.22);
  const safety=.025; // A visual 25 mm assessment allowance, not a code clearance.
  // Worst-case face of frame / sheets / rear double pickets near the moving lane.
  const laneHalfDepth=.066+safety;
  const lane={from:trackOffset-laneHalfDepth,to:trackOffset+laneHalfDepth};
  // Full body passes between its closed and fully opened positions.
  // Check the ENTIRE motion even while the user is viewing the CLOSED gate.
  // travel.movingFrom/movingTo represent its CURRENT preview state only.
  const fullStroke=(travel.direction==='right'?1:-1)*travel.openingWidth;
  const swept={from:Math.min(travel.closedFrom,travel.closedFrom+fullStroke),
    to:Math.max(travel.closedTo,travel.closedTo+fullStroke)};
  const sign=travel.direction==='right'?1:-1;
  const rollerPositions=[.23,.77].map(t=>travel.boundary+sign*travel.tail*t);
  const foundation={
    from:Math.min(travel.boundary,travel.boundary+sign*travel.tail),
    to:Math.max(travel.boundary,travel.boundary+sign*travel.tail),
    depth:.46,centerZ:trackOffset
  };
  const receiverX=travel.direction==='right'?travel.start:
    travel.start+travel.openingWidth;
  const posts=Array.isArray(options.posts)?options.posts:[];
  const sections=Array.isArray(options.sections)?options.sections:[];
  const obstacles=normalizeSlidingObstacles(opening.obstacles,sideLength);
  const collisions=[];
  const record=(kind,from,to,label,id='')=>collisions.push({kind,from,to,label,id});
  for(const postX of posts){
    const x=Number(postX);
    if(!Number.isFinite(x))continue;
    if(intersect(swept.from,swept.to,x-postWidth/2,x+postWidth/2)&&
      intersect(lane.from,lane.to,-postWidth/2,postWidth/2))
      record('post',x-postWidth/2,x+postWidth/2,'Столб забора');
  }
  const rear=options.postMode==='behind';
  const sheetZ=rear?.095:.015;
  const sheetHalf=rear?.025:.018;
  if(intersect(lane.from,lane.to,sheetZ-sheetHalf,sheetZ+sheetHalf)){
    for(const section of sections){
      if(intersect(swept.from,swept.to,Number(section.from),Number(section.to)))
        record('fence',Number(section.from),Number(section.to),'Полотно забора');
    }
  }
  const obstacleNames={tree:'Дерево',wall:'Стена',pillar:'Опора',other:'Препятствие'};
  for(const obstacle of obstacles){
    const from=obstacle.offset,to=from+obstacle.width;
    const z1=obstacle.distance-obstacle.depth/2;
    const z2=obstacle.distance+obstacle.depth/2;
    if(intersect(swept.from,swept.to,from,to)&&
       intersect(lane.from,lane.to,z1,z2))
      record('obstacle',from,to,obstacleNames[obstacle.type],obstacle.id);
  }
  // Existing full-distance and wicket checks remain authoritative too.
  const valid=travel.valid&&collisions.length===0;
  return {...travel,trackOffset,lane,swept,rollerPositions,foundation,
    receiverX,obstacles,collisions,valid,safetyAllowance:safety,
    // Unknown real-world obstructions cannot be inferred from this model.
    siteSurveyRequired:true};
}
export function getSlidingInstallationWarnings(plan){
  if(!plan)return [];
  const names={post:'столб',fence:'заполнение забора',obstacle:'добавленное препятствие'};
  const kinds=[...new Set(plan.collisions.map(c=>c.kind))];
  return kinds.map(k=>'В коридоре движения откатных ворот находится '+names[k]+
    '. Увеличьте отступ полотна от линии забора или измените расположение препятствия.');
}
