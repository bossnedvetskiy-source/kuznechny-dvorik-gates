// Port of the separate/built-in unfilled set formulas from the owner's workbook. No private rate values included.
// Stock packing reproduces first-fit decreasing, zero kerf, not a production cutting map.
export function packStock(lengths,stock=6000){
  const bins=[];
  for(const length of lengths.filter(n=>n>0).sort((a,b)=>b-a)){
    if(!Number.isFinite(length)||length>stock+1e-7)throw Error("Деталь длиннее хлыста");
    let bin=bins.find(b=>b.used+length<=stock+1e-7);
    if(!bin){bin={used:0,parts:[]};bins.push(bin)}
    bin.used+=length;bin.parts.push(length);
  }
  return {count:bins.length,purchaseMm:stock*bins.length,actualMm:lengths.reduce((s,n)=>s+n,0),bins};
}
export function simpleGateGeometry(input={}){
  const c={widthMm:3400,heightMm:1800,wicketWidthMm:1000,wicketHeightMm:1800,profile:'60x40x2',wicketType:'separate',gapMode:'excel',...input};
  const {widthMm:W,heightMm:H,wicketWidthMm:K,wicketHeightMm:Q}=c;
  for(const v of [W,H,K,Q])if(!Number.isSafeInteger(v)||v<=0||v>6000)throw Error('Допустимы целые размеры от 1 до 6000 мм');
  if(!['60x40x2','40x40x2','40x25x2'].includes(c.profile)||!['separate','builtIn'].includes(c.wicketType)||!['excel','sideClearance'].includes(c.gapMode))throw Error('Неизвестная конфигурация');
  const built=c.wicketType==='builtIn',small=c.profile==='40x25x2',w=(W-(c.gapMode==='excel'?20:60))/2,k=K-(c.gapMode==='excel'?10:40),side=(w-K)/2,top=H-Q;
  if(w<=0||k<=0||built&&(side<=0||top<0))throw Error('Проверьте размеры калитки и ворот');
  const repeat=(n,v)=>Array.from({length:n},()=>v);
  const extra=x=>Math.max(0,Math.ceil(x/1000)-1);
  const d=W>4000?Math.hypot(H,w):0,short=W>4000&&built?Math.hypot(H,side):0;
  let mainG=[],mainK=[],innerG=[],innerK=[];
  if(small){
    const full=Math.hypot(H,w),wd=Math.hypot(Q,k),sd=built?Math.hypot(H,side):0;
    mainG=[...repeat(4,H),...repeat(4,w),w,...(built?[side,side,full,sd,sd]:[w,full,full])];
    mainK=[...(built?[H,H,...(top>0?[K]:[])]:[]),Q,Q,k,k,k,wd];
  }else{
    mainG=[...repeat(6,H),...repeat(4,w)];
    mainK=built?[H,H,Q,Q,k,k]:[Q,Q,Q,k,k];
    innerG=[...repeat(2,H),...repeat(3,w),...repeat(extra(w),H),d];
    innerG=built?[...innerG,...repeat(4,H),...repeat(6,side),...repeat(2*extra(side),H)]:[...innerG,...innerG];
    innerK=[Q,Q,k,k,k,...repeat(extra(k),Q),...(built?[short,short,...(top>0?[K,K,K,...repeat(extra(K),top)]:[])]:[])];
    if((built?extra(w)+2*extra(side):2*extra(w))>20||extra(k)>10||built&&extra(K)>10)throw Error('Размер превышает предел раскроя Excel');
  }
  const sum=a=>a.reduce((n,x)=>n+x,0);
  const main=packStock([...mainG,...mainK]),inner=packStock([...innerG,...innerK]),rear= W+800;
  return {configuration:c,leafWidthMm:w,wicketLeafWidthMm:k,builtIn:built,main,inner,rearActualMm:rear,rearPurchaseMm:Math.ceil(rear/6000)*6000,rearNeedsJoin:rear>6000,
    gate:{mainMm:sum(mainG),innerMm:sum(innerG),stripMm:H},wicket:{mainMm:sum(mainK),innerMm:sum(innerK),stripMm:Q}};
}
export function simpleGateUnfilledQuote(input,rates){
  const g=simpleGateGeometry(input),c=g.configuration,built=g.builtIn,small=c.profile==='40x25x2';
  // Workbook rates supplied by a trusted server or private owner environment, never bundled.
  const required=['mainPrice','innerPrice','stripPrice','hingePrice','lockPrice','paintPrice','cutDisc','grindDisc','wire','gas','rent','rearPrice','rearPaintArea','pins','mainPaintArea','innerPaintArea','hingePlate','wageGate','wageWicket','wageRound','frameMarkup'];
  if(!rates||required.some(k=>typeof rates[k]!=='number'||!Number.isFinite(rates[k])||rates[k]<0)||rates.wageRound<=0||rates.frameMarkup<=0)throw Error('Не заданы проверенные тарифы');
  const r=rates,W=c.widthMm,H=c.heightMm,Q=c.wicketHeightMm,K=c.wicketWidthMm,w=g.leafWidthMm,k=g.wicketLeafWidthMm,side=(w-K)/2;
  const baseW=(3400-20)/2,baseK=1000-10,baseH=1800;
  const n=x=>Math.max(0,Math.ceil(x/1000)-1),di=(x,y)=>Math.hypot(x,y),long=W>4000?di(H,w):0,short=built&&W>4000?di(H,side):0;
  // Wage baseline in workbook stays at Excel standard dimensions even when side clearances differ.
  const baseGate=small?4*baseH+6*baseW+2*di(baseH,baseW)+baseH:6*baseH+4*baseW+2*(2*baseH+3*baseW+n(baseW)*baseH)+baseH;
  const baseSide=(baseW-1000)/2;
  const baseWicket=small?(built?2*baseH+2*baseSide+2*di(baseH,baseSide)+2*baseH+3*baseK+di(baseH,baseK)+baseH:2*baseH+3*baseK+di(baseH,baseK)+baseH):(built?2*baseH+2*baseH+2*baseK+2*baseH+3*baseK+n(baseK)*baseH+baseH:3*baseH+2*baseK+2*baseH+3*baseK+n(baseK)*baseH+baseH);
  const wageGLength=small?4*H+6*w+2*di(H,w)+H:g.gate.mainMm+2*(2*H+3*w+n(w)*H+long)+H;
  const wageKLength=small?(built?2*H+2*side+2*di(H,side)+(H>Q?K:0)+2*Q+3*k+di(Q,k)+Q:g.wicket.mainMm+Q):g.wicket.mainMm+g.wicket.innerMm+Q;
  const wage=(b,actual,base)=>Math.ceil((Math.round(b*actual/base*100)/100)/r.wageRound-1e-10)*r.wageRound;
  const allocated=(total,part,all)=>all?total*part/all:0;
  const mainTotal=g.main.purchaseMm/1000*r.mainPrice,innerTotal=g.inner.purchaseMm/1000*r.innerPrice;
  const gateMain=allocated(mainTotal,g.gate.mainMm,g.main.actualMm),gateInner=allocated(innerTotal,g.gate.innerMm,g.inner.actualMm);
  const consumables=.1*(r.grindDisc+r.wire+r.gas);
  const othersG=H/1000*r.stripPrice+4*r.hingePrice+3*r.cutDisc+consumables+g.rearPurchaseMm/1000*r.rearPrice+r.pins+(small?4*r.hingePlate:0);
  const othersK=Q/1000*r.stripPrice+2*r.hingePrice+r.lockPrice+r.cutDisc+consumables+(small?2*r.hingePlate:0);
  const paintG=(g.gate.mainMm/1000*r.mainPaintArea+g.gate.innerMm/1000*r.innerPaintArea+g.rearActualMm/1000*r.rearPaintArea)*r.paintPrice;
  const paintK=(g.wicket.mainMm/1000*r.mainPaintArea+g.wicket.innerMm/1000*r.innerPaintArea)*r.paintPrice;
  const gateWage=wage(r.wageGate,wageGLength,baseGate),wicketWage=wage(r.wageWicket,wageKLength,baseWicket);
  const gateBare=gateMain+gateInner+othersG+r.rent+gateWage,wicketBare=(mainTotal-gateMain)+(innerTotal-gateInner)+othersK+r.rent+wicketWage;
  const bare=gateBare+wicketBare,painted=bare+paintG+paintK,cost=c.paint===false?bare:painted;
  const price=cost*r.frameMarkup,round100=n=>Math.round(n/100)*100;
  return {geometry:g,cost,bare,painted,gateCost:gateBare+(c.paint===false?0:paintG),wicketCost:wicketBare+(c.paint===false?0:paintK),paint:paintG+paintK,wage:gateWage+wicketWage,gateWage,wicketWage,price,retail:round100(price),profit:price-cost,
    gateRetail:round100((gateBare+(c.paint===false?0:paintG))*r.frameMarkup),wicketRetail:round100(price)-round100((gateBare+(c.paint===false?0:paintG))*r.frameMarkup)};
}


// Source: workbook sheets «Евроштакетник» rows 2–15, «Профнастил» rows 2–15,
// «Расчет» G18/G22:G36 and B43:D48. Only non-financial defaults are bundled.
export const SIMPLE_FILL_DEFAULTS=Object.freeze({picketWidthMm:120,singleGapMm:50,doubleGapMm:60,verticalScrews:4,horizontalScrews:6,sheetFullMm:1200,sheetWorkingMm:1140,sheetScrews:18});
function requireRates(rates,keys){
  if(!rates||keys.some(k=>typeof rates[k]!=='number'||!Number.isFinite(rates[k])||rates[k]<0))throw Error('Не заданы проверенные тарифы: '+keys.join(', '));
}
const up=n=>Math.ceil(n-1e-10);
const round100=n=>Math.round(n/100)*100;
export function simpleGateFill(input={},dimensions={}){
  const g=simpleGateGeometry(input),c=g.configuration;
  const fill=input.fill??'none',d={...SIMPLE_FILL_DEFAULTS,...dimensions};
  if(!['none','single','chess','horizontal','sheet'].includes(fill))throw Error('Выберите заполнение');
  if(c.profile==='40x40x2'&&!['none','single','sheet'].includes(fill))throw Error('Для 40×40×2 это заполнение недопустимо по Excel');
  for(const k of Object.keys(SIMPLE_FILL_DEFAULTS))if(!Number.isSafeInteger(d[k])||d[k]<0)throw Error('Некорректные параметры заполнения');
  if(d.picketWidthMm<=0||d.sheetFullMm<=0||d.sheetWorkingMm<=0||d.sheetWorkingMm>d.sheetFullMm)throw Error('Проверьте ширину заполнения');
  const H=c.heightMm,Q=c.wicketHeightMm,K=c.wicketWidthMm,W=c.widthMm,w=g.leafWidthMm,k=g.wicketLeafWidthMm,b=g.builtIn;
  const gate={front:0,back:0,spare:0,picketMm:0,screws:0,sheets:0,areaM2:0,workWidthM:0},wicket={...gate};
  const panels=[];
  if(fill==='sheet'){
    gate.sheets=up(W/d.sheetWorkingMm);
    wicket.sheets=b?0:up(K/d.sheetWorkingMm);
    const gross=gate.sheets*d.sheetFullMm*H/1e6;
    const fraction=b?Math.min(1,K*Q/(W*H)):0;
    gate.areaM2=gross*(1-fraction);
    wicket.areaM2=b?gross*fraction:wicket.sheets*d.sheetFullMm*Q/1e6;
    const screws=gate.sheets*d.sheetScrews;
    gate.screws=b?Math.round(screws*(1-fraction)):screws;
    wicket.screws=b?screws-gate.screws:wicket.sheets*d.sheetScrews;
  }else if(fill!=='none'){
    const side=(w-K)/2;
    const raw=[['gate',w,H],['gate',b?side:w,H],['gate',b?side:0,H],['wicket',k,Q],['gate',b?K:0,b?Math.max(H-Q,0):0]];
    const seen=new Set();
    for(const [part,width,height] of raw){
      if(width<=0||height<=0)continue;
      const horizontal=fill==='horizontal',single=fill==='single';
      const gap=single?d.singleGapMm:d.doubleGapMm;
      const span=horizontal?height:width,length=horizontal?width:height;
      const front=Math.max(1,up((span+gap)/(d.picketWidthMm+gap))),back=single?0:Math.max(0,front-1);
      const spare=!single&&!seen.has(length)?4:0;
      seen.add(length);
      const picketMm=(front+back+spare)*length,screws=(front+back)*(horizontal?d.horizontalScrews:d.verticalScrews);
      const p={part,widthMm:width,heightMm:height,lengthMm:length,front,back,spare,picketMm,screws};
      panels.push(p);
      const out=part==='gate'?gate:wicket;
      for(const key of ['front','back','spare','picketMm','screws'])out[key]+=p[key];
      out.workWidthM+=width/1000;
    }
  }
  const total=Object.fromEntries(Object.keys(gate).map(k=>[k,gate[k]+wicket[k]]));
  return {fill,gate,wicket,total,panels};
}
export function simpleGateExtras(input={}){
  const g=simpleGateGeometry(input),c=g.configuration;
  const postType=input.postType??'none',position=input.wicketPosition??'adjacent',link=input.link??false,installation=input.installation??'none';
  if(!['none','100x100','80x80','60x60'].includes(postType)||!['adjacent','separate'].includes(position)||typeof link!=='boolean')throw Error('Проверьте комплектацию столбов и связки');
  const allowed=g.builtIn?['none','builtIn']:['none','set','gate','wicket'];
  if(!allowed.includes(installation))throw Error('Выберите установку для выбранного типа калитки');
  const schemePosts=g.builtIn?2:position==='separate'?4:3;
  const manual=input.manualPosts;
  if(manual!==undefined&&manual!==null&&manual!==''&&(!Number.isSafeInteger(manual)||manual<0))throw Error('Количество столбов — целое неотрицательное число');
  return {postType,schemePosts,postCount:postType==='none'?0:(manual===undefined||manual===null||manual===''?schemePosts:manual),linkMm:link?c.widthMm+(g.builtIn?0:c.wicketWidthMm):0,installation};
}
export function simpleGateCompleteQuote(input,frameRates,fillRates,extraRates,dimensions){
  const frame=simpleGateUnfilledQuote(input,frameRates),fill=simpleGateFill(input,dimensions),extra=simpleGateExtras(input);
  const fr=fillRates;
  const costPart=(part,name)=>{
    let material=0,screws=0,labor=0;
    if(fill.fill==='sheet'){
      const laborKey=name==='gate'?'sheetGateLabor':'sheetWicketLabor';
      requireRates(fr,['sheetPrice','sheetScrewPrice',laborKey,'fillMarkup']);
      material=part.areaM2*fr.sheetPrice;screws=part.screws*fr.sheetScrewPrice;labor=fr[laborKey];
    }else if(fill.fill!=='none'){
      const materialKey=fill.fill==='single'?'singlePrice':'doublePrice';
      const laborKey={single:'singleLabor',chess:'chessLabor',horizontal:'horizontalLabor'}[fill.fill];
      requireRates(fr,[materialKey,'picketScrewPrice',laborKey,'fillMarkup']);
      material=part.picketMm/1000*fr[materialKey];screws=part.screws*fr.picketScrewPrice;labor=part.workWidthM*fr[laborKey];
    }
    const cost=material+screws+labor,price=fill.fill==='none'?0:cost*fr.fillMarkup;
    return {material,screws,labor,cost,price,profit:price-cost};
  };
  const gate=costPart(fill.gate,'gate'),wicket=costPart(fill.wicket,'wicket');
  let posts=0,link=0,installation=0;
  if(extra.postCount){const key='post'+extra.postType;requireRates(extraRates,[key]);posts=extra.postCount*extraRates[key]}
  if(extra.linkMm){requireRates(extraRates,['linkBase']);link=round100(extraRates.linkBase*extra.linkMm/4400)}
  if(extra.installation!=='none'){const key='install'+extra.installation;requireRates(extraRates,[key]);installation=extraRates[key]}
  const productCost=frame.cost+gate.cost+wicket.cost;
  const productPrice=frame.price+gate.price+wicket.price;
  const productRetail=round100(productPrice),gateRetail=round100(frame.gateCost*frameRates.frameMarkup+gate.price);
  return {frame,fill,extra,fillEconomics:{gate,wicket,cost:gate.cost+wicket.cost,price:gate.price+wicket.price},productCost,productPrice,productRetail,gateRetail,wicketRetail:productRetail-gateRetail,posts,link,installation,total:productRetail+posts+link+installation,
    productProfitBeforeRounding:productPrice-productCost,extrasProfit:null,netProfit:null};
}
