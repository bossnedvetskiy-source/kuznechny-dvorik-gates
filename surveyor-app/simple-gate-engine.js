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
  return {geometry:g,cost,bare,painted,paint:paintG+paintK,wage:gateWage+wicketWage,gateWage,wicketWage,price,retail:round100(price),profit:price-cost,
    gateRetail:round100((gateBare+(c.paint===false?0:paintG))*r.frameMarkup),wicketRetail:round100(price)-round100((gateBare+(c.paint===false?0:paintG))*r.frameMarkup)};
}
