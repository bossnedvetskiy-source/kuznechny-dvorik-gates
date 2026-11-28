// Proposed serial pricing extension to workbook «Ворота простые.xlsx»:
// Расчет I6/I7, I13/I14/I16/I17, B33:C36; Раскрой 40×25.
// Separate procurement and optional hardware are NEW policies requiring owner approval.
// No real monetary values. Private runtime only.
import {packStock} from '../surveyor-app/simple-gate-engine.js';
import {SWING_DEFAULTS,swingFramePlan} from '../surveyor-app/v2-swing-frame.js';
const repeat=(n,v)=>Array(n).fill(v);
const round100=v=>Math.round(v/100)*100;
// For a small serial kit, try to beat the legacy FFD packing without
// pretending to account for saw kerf or end preparation. Bounded search:
// if no better solution is found, retain the valid conservative layout.
export function serialPackStock(lengths){
 const fallback=packStock(lengths),pieces=lengths.slice().sort((a,b)=>b-a);
 const lower=Math.ceil((fallback.actualMm-1e-7)/6000);
 let visits=0;
 for(let count=lower;count<fallback.count;count++){
  const bins=Array.from({length:count},()=>({used:0,parts:[]}));
  function place(i){
   if(++visits>50000)return false;
   if(i===pieces.length)return true;
   const length=pieces[i],seen=new Set();
   for(const b of bins){
    const signature=b.used.toFixed(7);
    if(seen.has(signature)||b.used+length>6000+1e-7)continue;
    seen.add(signature);const prev=b.used;b.used+=length;b.parts.push(length);
    if(place(i+1))return true;
    b.parts.pop();b.used=prev;
    if(visits>50000)return false;
   }
   return false;
  }
  if(place(0))return {count,purchaseMm:count*6000,actualMm:fallback.actualMm,bins};
  if(visits>50000)break;
 }
 return fallback;
}
export function serialFrameParts(input={}){
 const s={...SWING_DEFAULTS};
 for(const k of Object.keys(s))if(Object.hasOwn(input,k))s[k]=input[k];
 for(const k of ['gateWidthMm','gateHeightMm','wicketWidthMm','wicketHeightMm']){
  if((typeof s[k]!=='number'&&typeof s[k]!=='string')||String(s[k]).trim()===''||!Number.isSafeInteger(Number(s[k]))||Number(s[k])<1||Number(s[k])>6000)throw Error('Размеры вне диапазона');
  s[k]=Number(s[k]);
 }
 for(const k of ['hinges','lock','bolts','posts','paint','link'])if(typeof s[k]!=='boolean')throw Error('Некорректная комплектация');
 if(s.wicketPosition!=='adjacent')throw Error('Отдельное расположение опор требует уточнения');
 const p=swingFramePlan(s);
 if(p.errors.length)throw Error(p.errors.join(' '));
 if(s.profile!=='40x25x2'||s.diagonal!=='40x25x2'||s.wicketType!=='separate'||s.fill!=='none'||s.installation!=='none'||s.link||s.postType!=='none'||s.manualPosts!=='')throw Error('Модель пока только для простых каркасов 40×25 без заполнения, связки и установки');
 if(s.product==='gate'&&s.lock||s.product==='wicket'&&s.bolts)throw Error('Фурнитура не соответствует изделию');
 const gate=s.product!=='wicket',wicket=s.product!=='gate',gH=Number(s.gateHeightMm),kH=Number(s.wicketHeightMm);
 for(const [enabled,w,h] of [[gate,Number(s.gateWidthMm),gH],[wicket,Number(s.wicketWidthMm),kH]])if(enabled&&(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w>6000||h>6000||w<=0||h<=0))throw Error('Размеры вне диапазона');
 const w=(Number(s.gateWidthMm)-(s.gapMode==='excel'?20:60))/2,k=Number(s.wicketWidthMm)-(s.gapMode==='excel'?10:40);
 const gp=gate?[...repeat(4,gH),...repeat(6,w),...repeat(2,Math.hypot(gH,w))]:[],kp=wicket?[...repeat(2,kH),...repeat(3,k),Math.hypot(kH,k)]:[];
 const main=serialPackStock([...gp,...kp]);
 const rear=gate?Number(s.gateWidthMm)+800:0;
 if(rear>6000)throw Error('Согласуйте стыковку задней трубы');
 const sum=a=>a.reduce((n,v)=>n+v,0);
 return {product:s.product,configuration:s,main,gateMm:sum(gp),wicketMm:sum(kp),rearMm:rear,rearStock:rear?1:0,stripMm:(gate?gH:0)+(wicket?kH:0),hinges:s.hinges?4*Number(gate)+2*Number(wicket):0,hingePlates:s.hinges?4*Number(gate)+2*Number(wicket):0,lock:s.lock&&wicket?1:0,pins:s.bolts&&gate?1:0,posts:s.posts?(gate&&wicket?3:2):0};
}
export function serialFramePrivateQuote(input,bundle){
 if(bundle?.kind!=='serialFrames'||bundle.approved!==true||bundle.policy!=='serial-40x25-v1'||typeof bundle.revision!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(bundle.revision))throw Error('Отдельная модель серийных каркасов не утверждена');
 const p=serialFrameParts(input),s=p.configuration,r=bundle.rates;
 const required=['mainPrice','stripPrice','rearPrice','hingePrice','hingePlate','lockPrice','pins','cutDisc','grindDisc','wire','gas','rent','wageGate','wageWicket','wageRound','mainPaintArea','rearPaintArea','paintPrice','frameMarkup','post80x80'];
 if(!r||required.some(k=>typeof r[k]!=='number'||!Number.isFinite(r[k])||r[k]<0||r[k]>10000000)||r.wageRound<=0||r.frameMarkup<=0)throw Error('Нет полного набора утверждённых ставок');
 const gate=s.product!=='wicket',wicket=s.product!=='gate';
 const baseG=4*1800+6*1690+2*Math.hypot(1800,1690)+1800,baseK=2*1800+3*990+Math.hypot(1800,990)+1800;
 const wage=(base,len,standard)=>Math.ceil(Math.round(base*len/standard*100)/100/r.wageRound-1e-10)*r.wageRound;
 // Keep workbook welding allowance even if hardware is omitted: no unapproved wage reduction.
 const welding=(gate?wage(r.wageGate,p.gateMm+Number(s.gateHeightMm),baseG):0)+(wicket?wage(r.wageWicket,p.wicketMm+Number(s.wicketHeightMm),baseK):0);
 const main=p.main.purchaseMm/1000*r.mainPrice;
 const rear=p.rearStock*6*r.rearPrice;
 const hardware=p.hinges*r.hingePrice+p.hingePlates*r.hingePlate+p.lock*r.lockPrice+p.pins*r.pins;
 const other=p.stripMm/1000*r.stripPrice+(gate?3:0)*r.cutDisc+(wicket?1:0)*r.cutDisc+(Number(gate)+Number(wicket))*(.1*(r.grindDisc+r.wire+r.gas)+r.rent);
 const paint=s.paint?((p.gateMm+p.wicketMm)/1000*r.mainPaintArea+p.rearMm/1000*r.rearPaintArea)*r.paintPrice:0;
 const product=round100((main+rear+hardware+other+paint+welding)*r.frameMarkup),posts=p.posts*r.post80x80,total=product+posts;
 if(!Number.isSafeInteger(total)||total<=0||!Number.isSafeInteger(posts))throw Error('Некорректная цена');
 return {version:1,kind:'serialFrames',tariffRevision:bundle.revision,configuration:p.configuration,prices:{product,posts,total},deliveryPending:true,canIssue:false,canReleaseProduction:false};
}
