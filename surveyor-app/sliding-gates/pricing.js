// Single customer-price calculation used by surveyor and owner quick preview.
// Customer-facing retail tariffs only. Never put private costs or employee wages here.
const round100=v=>Math.ceil((v-1e-9)/100)*100;
export function calculateSlidingQuote(state){
function wicketPlan(w){
 if(!state.builtInWicket)return null;
 const width=Number(state.builtInWidth),offset=Number(state.builtInOffset);
 const left=state.builtInMode==="left"?offset:state.builtInMode==="right"?w-width-offset:(w-width)/2;
 const right=w-width-left;
 return {width,left,right,valid:Number.isFinite(width)&&width>=.7&&width<=1.2&&Number.isFinite(left)&&left>=.08&&right>=.08};
}
// Customer retail tariff estimates for a 60×40 wicket. These are not cost or wage records.
const WICKET_RETAIL={tube60PerMetre:330,tube20PerMetre:120,hingeEach:150,lockSet:1950,stopAndFasteners:450,welding:3400,paintPerSqM:850};
function wicketEstimate(wicket,hf,paintEnabled,frameType){
 if(!wicket)return null;
 // Continuous bottom rail is retained as the step-over threshold.
 // Add two fixed 60×40 side posts plus the 60×40 door frame.
 const clearHeight=Math.max(0,hf-.12);
 const fixedPosts60=2,hinges=2,locks=1;
 const door60Length=2*(clearHeight+wicket.width);
 const fixed60Length=fixedPosts60*clearHeight;
 const innerPosts20=frameType==="jalousie"?0:2;
 // Inside the wicket door: one middle crossbar for profiled sheet and
 // vertical pickets; a full inner 20×20 frame for horizontal pickets.
 const innerDoor20Length=frameType==="prof"||frameType==="vertical"?Math.max(0,wicket.width-.08):frameType==="horizontal"?2*(Math.max(0,wicket.width-.08)+Math.max(0,clearHeight-.08)):0;
 const inner20Length=innerPosts20*clearHeight+innerDoor20Length;
 const tube60Length=door60Length+fixed60Length;
 const metal60=round100(tube60Length*WICKET_RETAIL.tube60PerMetre);
 const metal20=round100(inner20Length*WICKET_RETAIL.tube20PerMetre);
 const hardware=hinges*WICKET_RETAIL.hingeEach+locks*WICKET_RETAIL.lockSet+WICKET_RETAIL.stopAndFasteners;
 const welding=WICKET_RETAIL.welding;
 const paintArea=tube60Length*.2+inner20Length*.08;
 const paint=paintEnabled?round100(paintArea*WICKET_RETAIL.paintPerSqM):0;
 return {clearHeight,fixedPosts60,innerPosts20,innerDoor20Length,hinges,locks,door60Length,fixed60Length,inner20Length,tube60Length,tubeLength:tube60Length+inner20Length,paintArea,metal60,metal20,hardware,welding,paint,total:metal60+metal20+hardware+welding+paint};
}
function calculate(){
 const w=Number(state.width),h=Number(state.height);const errors=[];
 if(!(w>=.5&&w<=5))errors.push("Ширина проёма: от 0,5 до 5 м.");
 if(!(h>=.5&&h<=3.5))errors.push("Высота: от 0,5 до 3,5 м.");
 const wicket=wicketPlan(w);
 if(wicket&&!wicket.valid)errors.push("Калитка не помещается: оставьте минимум 8 см от каждого края полотна и проверьте ширину/отступ.");
 if(wicket&&state.frame==="jalousie")errors.push("Каркас под жалюзи со встроенной калиткой пока требует согласования.");
 if(wicket&&state.auto)errors.push("Для автоматики необходим датчик закрытия калитки и блокировка движения. Комплектация требует согласования.");
 if(errors.length)return {errors,total:null,geometry:null,wicket};

 const hf=h-.06,beam=w>=4.5?7:6,tail=Math.min(w/2,beam-w),full=w+tail,cv=Math.max(0,hf-.08),station=state.frame==="jalousie"?2:Math.ceil(w),post=station-1;
 let a=full+w+cv*2,b=0;
 if(state.tail==="square"){a+=tail+cv+2*Math.hypot(tail,hf);}
 else{const top=Math.min(.3,tail),dx=tail-top;a+=top+Math.hypot(dx,hf)+Math.hypot((tail+top)/2,hf/2);}
 if(state.frame==="jalousie")a+=cv*post;else b+=cv*post;
 if(state.frame==="horizontal")b+=cv*2+Math.max(0,w-.08)*2;
 // All values below are CUSTOMER RETAIL TARIFFS; no supplier costs, employee wages,
 // margin coefficients, profit, or internal accounting data are shipped to surveyors.
 const frame=round100(Math.ceil(a/6)*2560.2+Math.ceil(b/6)*816+7650*Math.max(1,w/4)+510);
 const paintArea=Math.round((a*.2+b*.08)*100)/100;
 const paint=state.paint?round100(paintArea*850):0;
 let fill=0,fillDescription="";
 if(state.fill&&state.frame!=="jalousie"){
   if(state.frame==="prof"){
     const sheets=Math.ceil(w/1.1);fill=round100(sheets*1.2*hf*720+3000);fillDescription=sheets+" листов профнастила";
   }else{
     const horizontal=state.frame==="horizontal",dbl=horizontal||state.picket==="double",gap=dbl?.06:.05,cover=horizontal?hf:w;
     const count=Math.ceil((cover+gap)/(.12+gap));const pieces=count+(dbl?Math.max(0,count-1):0),len=horizontal?w:hf;
     const retail=horizontal||dbl?156:132,labour=horizontal?2000:dbl?1800:1300;
     fill=round100((pieces+2)*len*retail+pieces*(horizontal?6:4)*2+w*labour);
     fillDescription=pieces+" шт. евроштакетника";
   }
 }
 const rail=beam===7?17000:16000,stand=state.stand?12000:0,bolts=state.bolts?500:0,install=state.install?7000:0,automatic=state.auto?30000:0,delivery=Math.max(0,Number(state.distance)||0)*90,discount=Math.max(0,Number(state.discount)||0);
 const wicketQuote=wicketEstimate(wicket,hf,state.paint,state.frame);
 // Calibrate once against a 1.00 m wicket in 1.80 m high gates, with painting.
 // The same fixed supplement is retained when width/height or paint option changes.
 // Standard retail price is 13 000 ₽; size-dependent material/paint changes are dynamic.
 const STANDARD_WICKET_PRICE=13000;
 const standardWicket={width:1};
 const standardQuote=wicketEstimate(standardWicket,1.8-.06,true,state.frame);
 const fixedSupplement=STANDARD_WICKET_PRICE-standardQuote.total;
 const wicketPrice=wicketQuote?round100(wicketQuote.total+fixedSupplement):0;
 const rows=[["Встроенная калитка (по размерам)",wicketPrice],["Каркас",frame],["Покраска",paint],["Заполнение",fill],["Балка и ролики",rail],["Станина",stand],["Болты",bolts],["Монтаж",install],["Автоматика",automatic],["Доставка",delivery],["Скидка",-discount]];
 const total=errors.length?null:Math.max(0,Math.round(rows.reduce((s,r)=>s+r[1],0)));
 return {errors,total,rows,geometry:{beam,tail,full,hf,post,station},wicket,wicketQuote,fillDescription};
}

return calculate();
}
