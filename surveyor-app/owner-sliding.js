// Internal production planning for sliding-gate quotes.
// Geometry comes only from the customer-safe saved configuration.
// Unit rates are editable owner-only expenses; never transfer them in quote payloads.
const real=(x)=>Number.isFinite(Number(x))?Number(x):NaN;
const round2=x=>Math.round(x*100)/100;
const extraNonnegative=x=>Math.max(0,real(x)||0);

// Defaults are estimates, not verified purchase invoices. Missing rates are
// deliberately left blank so an incomplete job never reports fictitious profit.
export const SLIDING_RATE_FIELDS=Object.freeze([
  {key:'tube60',label:'Труба 60×40×2 · цена закупки, ₽/м',initial:251},
  {key:'tube20',label:'Труба 20×20×1,5 · цена закупки, ₽/м',initial:80},
  {key:'rollers',label:'Балка с роликами · себестоимость комплекта, ₽'},
  {key:'hinge',label:'Петля калитки · закупка, ₽/шт',initial:100},
  {key:'lock',label:'Замок с ручками · закупка, ₽/компл.',initial:1500},
  {key:'fittings',label:'Упоры, ответная часть, фурнитура калитки, ₽',initial:450},
  {key:'screws',label:'Саморез · закупка, ₽/шт',initial:2},
  {key:'sheet',label:'Профнастил · закупка, ₽/м²'},
  {key:'picket',label:'Евроштакетник · закупка, ₽/пог. м'},
  {key:'weldGate',label:'Сварщик · основные откатные ворота, ₽'},
  {key:'weldWicket',label:'Сварщик · встроенная калитка, ₽',initial:2000},
  {key:'weldConsumables',label:'Сварочные расходники и круги, ₽',initial:400},
  {key:'paintMaterial',label:'Порошок, лак и расходники · ₽/м²'},
  {key:'painter',label:'Зарплата маляра · ₽/м²'},
  {key:'cladding',label:'Зарплата зашивщика · за створку, ₽'},
  {key:'stand',label:'Станина · расход подрядчику, ₽',initial:12000},
  {key:'bolts',label:'Болты и крепёж к станине, ₽'},
  {key:'install',label:'Монтаж · расход подрядчику, ₽',initial:7000},
  {key:'automation',label:'Автоматика · закупочная стоимость комплекта, ₽'},
  {key:'delivery',label:'Фактическая доставка, ₽'}
]);
const fields=Object.fromEntries(SLIDING_RATE_FIELDS.map(f=>[f.key,f]));
export function slidingRateKey(id,field){return 'sl_'+String(id)+'_'+field;}
function rate(costs,id,key){
  const name=slidingRateKey(id,key);
  if(Object.prototype.hasOwnProperty.call(costs,name)){
    const v=real(costs[name]);return Number.isFinite(v)&&v>=0?v:null;
  }
  return fields[key]?.initial??null;
}
function take(value,amount,missing,rows,key,label) {
  if(amount<=0)return 0;
  if(value===null){missing.push(label);rows.push({key,label,qty:round2(amount),cost:null});return 0;}
  const cost=round2(value*amount);
  rows.push({key,label,qty:round2(amount),cost});
  return cost;
}

export function buildSlidingProduction(calc,costs={}){
  const c=calc?.payload?.configuration;
  const w=real(c?.width),h=real(c?.height);
  const frame=c?.frame,tailShape=c?.tail;
  if(!c||!(w>=.5&&w<=5)||!(h>=.5&&h<=3.5)||
    !['prof','vertical','horizontal','jalousie'].includes(frame)||
    !['square','triangle'].includes(tailShape))
    return {valid:false,reason:'Нет корректных размеров или конфигурации откатных ворот.'};
  const wicket=!!c.builtInWicket,ww=real(c.builtInWidth??1);
  const mode=c.builtInMode??'center',offset=real(c.builtInOffset??0);
  const left=mode==='left'?offset:mode==='right'?w-ww-offset:(w-ww)/2;
  if(wicket&&(!(ww>=.7&&ww<=1.2)||!(left>=.08&&w-ww-left>=.08)||frame==='jalousie'||c.auto))
    return {valid:false,reason:'Проверьте размеры, заполнение или автоматику встроенной калитки.'};
  const beam=w>=4.5?7:6,tail=Math.min(w/2,beam-w),full=w+tail,hf=h-.06,cv=Math.max(0,hf-.08);
  const stations=frame==='jalousie'?2:Math.ceil(w),postCount=stations-1;
  let tube60=full+w+cv*2,tube20=0;
  if(tailShape==='square')tube60+=tail+cv+2*Math.hypot(tail,hf);
  else {
    const top=Math.min(.3,tail),dx=tail-top;
    tube60+=top+Math.hypot(dx,hf)+Math.hypot((tail+top)/2,hf/2);
  }
  if(frame==='jalousie')tube60+=cv*postCount;
  else tube20+=cv*postCount;
  if(frame==='horizontal')tube20+=cv*2+Math.max(0,w-.08)*2;
  let removedPosts=0,wicket60=0,wicket20=0,wicketInner20=0;
  if(wicket){
    for(let i=1;i<stations;i++){
      const x=w*i/stations;
      if(x>left-.02&&x<left+ww+.02)removedPosts++;
    }
    tube20=Math.max(0,tube20-removedPosts*cv);
    const clearHeight=Math.max(0,hf-.12);
    wicket60=2*(clearHeight+ww)+2*clearHeight;
    wicketInner20=frame==='horizontal'?
      2*(Math.max(0,ww-.08)+Math.max(0,clearHeight-.08)):Math.max(0,ww-.08);
    wicket20=2*clearHeight+wicketInner20;
    tube60+=wicket60;tube20+=wicket20;
  }
  const stocks60=Math.ceil(Math.max(0,tube60-1e-8)/6);
  const stocks20=Math.ceil(Math.max(0,tube20-1e-8)/6);
  const area=round2(tube60*.2+tube20*.08);
  let sheets=0,pickets=0,sparePickets=0,picketLength=0,screws=0,materialArea=0;
  if(c.fill!==false&&frame==='prof'){
    sheets=Math.ceil(w/1.1);
    materialArea=round2(sheets*1.2*hf);
  } else if(c.fill!==false&&frame!=='jalousie'){
    const horizontal=frame==='horizontal',dbl=horizontal||c.picket==='double';
    const gap=dbl?.06:.05,cover=horizontal?hf:w;
    const base=Math.ceil((cover+gap)/(.12+gap));
    pickets=base+(dbl?Math.max(0,base-1):0);
    sparePickets=2;
    picketLength=horizontal?w:hf;
    screws=pickets*(horizontal?6:4);
  }
  const missing=[],rows=[],get=key=>rate(costs,calc.id,key);
  let expense=0;
  // Purchased bars, not theoretical used metres; any unoptimised offcuts stay visible.
  expense+=take(get('tube60'),stocks60*6,missing,rows,'tube60','Труба 60×40×2');
  expense+=take(get('tube20'),stocks20*6,missing,rows,'tube20','Труба 20×20×1,5');
  expense+=take(get('rollers'),1,missing,rows,'rollers','Балка и ролики');
  expense+=take(get('sheet'),materialArea,missing,rows,'sheet','Профнастил');
  expense+=take(get('picket'),(pickets+sparePickets)*picketLength,missing,rows,'picket','Евроштакетник');
  expense+=take(get('screws'),screws,missing,rows,'screws','Саморезы');
  if(wicket){
    expense+=take(get('hinge'),2,missing,rows,'hinge','Петли встроенной калитки');
    expense+=take(get('lock'),1,missing,rows,'lock','Замок и ручки');
    expense+=take(get('fittings'),1,missing,rows,'fittings','Ответная часть и фурнитура');
  }
  const materialsExpense=expense;
  let wage=0;
  wage+=take(get('weldGate'),1,missing,rows,'weldGate','Зарплата сварщика · ворота');
  wage+=take(get('weldWicket'),wicket?1:0,missing,rows,'weldWicket','Зарплата сварщика · калитка');
  wage+=take(get('painter'),c.paint===false?0:area,missing,rows,'painter','Зарплата маляра');
  wage+=take(get('cladding'),c.fill===false||frame==='jalousie'?0:1,missing,rows,'cladding','Зарплата зашивщика');
  expense+=wage;
  expense+=take(get('weldConsumables'),1,missing,rows,'weldConsumables','Сварочные расходники');
  expense+=take(get('paintMaterial'),c.paint===false?0:area,missing,rows,'paintMaterial','Порошок, лак и малярные расходники');
  expense+=take(get('stand'),c.stand===false?0:1,missing,rows,'stand','Станина от подрядчика');
  expense+=take(get('bolts'),c.bolts===false?0:1,missing,rows,'bolts','Болты');
  expense+=take(get('install'),c.install===false?0:1,missing,rows,'install','Монтаж подрядчика');
  expense+=take(get('automation'),c.auto===true?1:0,missing,rows,'automation','Автоматика');
  expense+=take(get('delivery'),extraNonnegative(c.distance)>0?1:0,missing,rows,'delivery','Доставка');
  return {valid:true,beam,tail,full,width:w,height:h,frame,wicket,wicketWidth:wicket?ww:0,
    tube60:round2(tube60),tube20:round2(tube20),stocks60,stocks20,area,
    wicket60:round2(wicket60),wicket20:round2(wicket20),wicketInner20:round2(wicketInner20),
    removedPosts,sheets,materialArea,pickets,sparePickets,picketLength:round2(picketLength),screws,
    rows,missing,materialsExpense:missing.some(x=>['Труба 60×40×2','Труба 20×20×1,5','Балка и ролики','Профнастил','Евроштакетник','Саморезы','Петли встроенной калитки','Замок и ручки','Ответная часть и фурнитура'].includes(x))?null:round2(materialsExpense),
    wage:missing.some(x=>x.startsWith('Зарплата'))?null:round2(wage),
    calculatedCost:missing.length?null:round2(expense)};
}
