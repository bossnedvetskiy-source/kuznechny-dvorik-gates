(() => {
'use strict';
const P={
  tube25:100,tube20:80,tube30:144,tube25web:100,tube40x20:144,tube80:599,
  poly:1400,connector:1500,endProfile:100,weld4m:2000,mountCover:1200,
  postConcrete:800,postPlate:500,paint:650,markup:30,stick:6,polyWidth:2.1,
  embedDepth:0.7,polyOverhang:0.1,endOverhang:0.2,targetRib:0.4,maxRib:0.5,
  trussStep:1.7,maxPostStep:3,wire:400,discs:200,ownerMount:200,
  profnastil:500,profFullWidth:1.2,profWorkWidth:1.1,profMaxPart:4,profOverlap:0.2,
  profLagTarget:0.9,profLagMax:1,mountNoCover:900,maxWidth:6,maxLength:12,
  tube40x40:198,separateMarkup:70,postWidth:0.08
};
const round6=n=>Math.round((n+Number.EPSILON)*1e6)/1e6;
const ceil100=n=>Math.ceil(n/100)*100;
const mod=(a,b)=>((a%b)+b)%b;
const profilePrice=(x,p,role='chord')=>x==='25×25×1,5'?(role==='web'?p.tube25web:p.tube25):x==='30×30×2'?p.tube30:x==='40×20×2'?p.tube40x20:x==='40×40×2'?p.tube40x40:x==='20×20×1,5'?p.tube20:p.tube25web;
const profilePerimeter=x=>x==='25×25×1,5'?0.10:x==='30×30×2'?0.12:x==='40×20×2'?0.12:x==='40×40×2'?0.16:x==='20×20×1,5'?0.08:0.10;
function mergePrices(custom={}){const r={...P};for(const k of Object.keys(P)){const v=Number(custom[k]);if(Number.isFinite(v)&&v>=0)r[k]=v;}return r;}
function autoTrussCount(lengthM,p=P){return lengthM>0?Math.ceil(lengthM/p.trussStep)+1:0;}
function lagSticks(lines,lengthM,stick=6){
  if(!(lines>0&&lengthM>0))return 0;
  const len=round6(lengthM);
  if(len<=stick){const cap=Math.max(1,Math.floor((stick+1e-6)/len));return Math.ceil(lines/cap);}
  const full=Math.floor(len/stick),rem=round6(mod(len,stick));
  if(rem===0)return lines*full;
  if(rem>=2){const cap=Math.max(1,Math.floor((stick+1e-6)/rem));return lines*full+Math.ceil(lines/cap);}
  return lines*full+Math.ceil(lines/3);
}
function binPack(pieceLengths,stick=6){
  const pieces=pieceLengths.filter(v=>v>0).slice().sort((a,b)=>b-a),bins=[];
  for(const piece of pieces){
    if(piece>stick){
      const full=Math.floor(piece/stick);for(let i=0;i<full;i++)bins.push(0);
      const rem=round6(piece-full*stick);if(rem>1e-6)bins.push(stick-rem);continue;
    }
    let best=-1,bestRemain=Infinity;
    for(let i=0;i<bins.length;i++){if(bins[i]+1e-9>=piece){const after=bins[i]-piece;if(after<bestRemain){best=i;bestRemain=after;}}}
    if(best>=0)bins[best]=round6(bins[best]-piece);else bins.push(round6(stick-piece));
  }
  return {sticks:bins.length,remainders:bins,wasteM:bins.reduce((a,b)=>a+b,0)};
}
function polyPurchase(pieceLen,count,width,p){
  if(!(count>0)||pieceLen>12)return {meters:0,counts:{3:0,6:0,9:0,12:0},warning:pieceLen>12?'Длина поликарбоната по дуге больше 12 м':''};
  const sizes=[3,6,9,12],caps={};
  sizes.forEach(s=>caps[s]=pieceLen<=s?Math.floor(s/pieceLen):0);
  let best=12,metric=Infinity;
  for(const s of sizes){if(caps[s]>0){const m=s/caps[s];if(m<metric-1e-9||Math.abs(m-metric)<1e-9&&s>best){metric=m;best=s;}}}
  const cap=caps[best],full=Math.floor(count/cap),rest=count%cap,counts={3:0,6:0,9:0,12:0};
  counts[best]+=full;
  if(rest){const tail=sizes.find(s=>caps[s]>=rest)||12;counts[tail]+=1;}
  const meters=sizes.reduce((a,s)=>a+s*counts[s],0);
  return {meters,counts,area:meters*width,warning:'',best,capacity:cap};
}
function connectorSticks(count,len,stick=6){
  if(!(count>0&&len>0))return 0;
  const L=round6(len);
  if(L<=stick)return Math.ceil(count/Math.max(1,Math.floor((stick+1e-6)/L)));
  const full=Math.floor(L/stick),rem=round6(mod(L,stick));
  if(rem===0)return count*full;
  return count*full+Math.ceil(count/Math.max(1,Math.floor((stick+1e-6)/rem)));
}
function sticks80(beamCount,beamLen,newPosts,postLen,p){
  const S=p.stick;if(!(beamCount>0)||beamLen<=0){if(!(newPosts>0&&postLen>0))return 0;return Math.ceil(newPosts/Math.max(1,Math.floor((S+1e-6)/postLen)));}
  const rem=round6(mod(beamLen,S)),postsPerFull=postLen>0?Math.max(1,Math.floor((S+1e-6)/postLen)):0;
  if(postLen>S&&newPosts>0)return 999;
  const base=beamCount*Math.floor(beamLen/S);
  if(newPosts===0){if(rem===0)return base;return base+(beamCount*rem<=S+1e-6?1:beamCount);}
  if(rem===0)return base+Math.ceil(newPosts/postsPerFull);
  if(beamCount!==2){const beamTail=beamCount*rem<=S+1e-6?1:beamCount;return base+beamTail+Math.ceil(newPosts/postsPerFull);}
  const postsWithOne=Math.max(0,Math.floor((S-rem+1e-6)/postLen));
  const postsWithTwo=Math.max(0,Math.floor((S-2*rem+1e-6)/postLen));
  const a=2*rem<=S+1e-6?base+1+Math.ceil(Math.max(0,newPosts-postsWithTwo)/postsPerFull):999;
  const b=base+2+Math.ceil(Math.max(0,newPosts-2*postsWithOne)/postsPerFull);
  return Math.min(a,b);
}
function compute(raw,g,custom={}){
  const p=mergePrices(custom),lengthM=Math.max(0,Number(raw.lengthM)||0),visibleHeightM=Math.max(0,Number(raw.visibleHeightM)||0),delivery=Math.max(0,Number(raw.delivery)||0);
  const coverage=raw.coverage||'Поликарбонат',installType=raw.installType||'Бетонирование',paint=raw.paint!==false&&raw.paint!=='Нет',postsNeeded=raw.postsNeeded!==false&&raw.postsNeeded!=='Нет',beamsExisting=raw.beamsExisting===true||raw.beamsExisting==='Да';
  const totalPosts=postsNeeded?2*Math.max(2,Math.ceil((lengthM+p.maxPostStep)/(p.maxPostStep+p.postWidth))):0;
  const postsPerSide=totalPosts/2,existingPosts=Math.max(0,Math.min(totalPosts,Math.floor(Number(raw.existingPosts)||0))),newPosts=Math.max(0,totalPosts-existingPosts);
  const clearPostStep=postsPerSide>1?(lengthM-postsPerSide*p.postWidth)/(postsPerSide-1):0;
  const postLen=totalPosts?visibleHeightM+(installType==='Бетонирование'?p.embedDepth:0):0;
  const trussCount=autoTrussCount(lengthM,p);
  const area=g.widthPostsM*lengthM;
  const lagMode=raw.lagMode==='Эконом'?'Эконом':'Стандарт';
  const standardIntervals=Math.max(1,Math.round(g.topCircle.length/p.targetRib),Math.ceil(g.topCircle.length/p.maxRib));
  const economyIntervals=Math.max(1,Math.ceil(g.topCircle.length/p.maxRib));
  const intervals=lagMode==='Эконом'?economyIntervals:standardIntervals;
  const lagLines=coverage==='Профнастил'
    ?Math.max(2,Math.max(1,Math.round(g.topCircle.length/p.profLagTarget),Math.ceil(g.topCircle.length/p.profLagMax))+1)
    :intervals+1;
  const lagStep=lagLines>1?g.topCircle.length/(lagLines-1):0;
  const chordUsedM=(g.topCircle.length+g.lowerTotalM)*trussCount;
  const internalMembers=g.trussType==='Вертикальная'
    ?g.verticals
    :g.trussType==='Усиленная'
      ?[...g.diagonals,...g.verticals]
      :g.diagonals;
  const webOneM=2*g.endPostM+internalMembers.reduce((a,d)=>a+d.lengthM,0),webUsedM=webOneM*trussCount;
  const lagUsedM=lagLines*lengthM,beamCount=beamsExisting?0:2,beamPostUsedM=beamCount*lengthM+newPosts*postLen;
  const chordLengths=[];for(let i=0;i<trussCount;i++){chordLengths.push(g.topCircle.length,g.lowerTotalM);}
  let chordSticks=0;for(const L of chordLengths)chordSticks+=L<=p.stick?1:Math.ceil(L/p.stick);
  const webPieces=[];for(let i=0;i<trussCount;i++){webPieces.push(g.endPostM,g.endPostM,...internalMembers.map(d=>d.lengthM));}
  const webPack=binPack(webPieces,p.stick),lagsSticks=lagSticks(lagLines,lengthM,p.stick),tube80Sticks=sticks80(beamCount,lengthM,newPosts,postLen,p);
  const chordCost=chordSticks*p.stick*profilePrice(g.chordProfile,p),webCost=webPack.sticks*p.stick*profilePrice(g.webProfile,p,'web'),lagCost=lagsSticks*p.stick*p.tube40x20,tube80Cost=tube80Sticks*p.stick*p.tube80;
  const metalCost=chordCost+webCost+lagCost+tube80Cost;
  const coverWidthM=g.widthM+2*p.polyOverhang,coverRadius=g.topCircle.radius,coverArcM=2*coverRadius*Math.asin(Math.min(1,coverWidthM/(2*coverRadius))),coverLengthM=lengthM+2*p.endOverhang;
  let coverageCost=0,fittingsCost=0,coverageData={type:coverage,coverArcM,coverLengthM};
  if(coverage==='Поликарбонат'){
    const strips=Math.ceil(coverLengthM/p.polyWidth),buy=polyPurchase(coverArcM,strips,p.polyWidth,p),seams=Math.max(0,strips-1),connectors=connectorSticks(seams,coverArcM,p.stick),endProfiles=strips*2;
    coverageCost=buy.meters*p.poly;fittingsCost=connectors*p.connector+endProfiles*p.endProfile;
    coverageData={...coverageData,strips,buyMeters:buy.meters,buyCounts:buy.counts,connectors,endProfiles,warning:buy.warning,polyArea:buy.area};
  }else if(coverage==='Профнастил'){
    const sheetsAcross=Math.ceil(coverArcM/p.profWorkWidth),parts=coverLengthM<=p.profMaxPart?1:Math.ceil(coverLengthM/(p.profMaxPart-p.profOverlap)),partLength=parts===1?coverLengthM:coverLengthM/parts+p.profOverlap,totalParts=sheetsAcross*parts,buyArea=totalParts*p.profFullWidth*partLength;
    coverageCost=buyArea*p.profnastil;coverageData={...coverageData,sheetsAcross,parts,partLength,totalParts,buyArea};
  }
  const consumables=trussCount*(p.wire+p.discs),weld=trussCount*p.weld4m*(g.widthM/4),mountRate=coverage==='Без покрытия'?p.mountNoCover:p.mountCover,mount=area*mountRate,postMount=newPosts*(installType==='Бетонирование'?p.postConcrete:p.postPlate);
  const paintArea=paint?chordUsedM*profilePerimeter(g.chordProfile)+webUsedM*profilePerimeter(g.webProfile)+lagUsedM*0.12+beamPostUsedM*0.32:0,paintCost=paintArea*p.paint;
  const base=metalCost+coverageCost+fittingsCost+consumables+weld+mount+postMount+paintCost,markup=base*p.markup/100,priceNoDelivery=base+markup,total=priceNoDelivery+delivery,ownerMount=area*p.ownerMount,actualExpenses=base-ownerMount,profit=markup+ownerMount,margin=priceNoDelivery?profit/priceNoDelivery*100:0;
  const oneTrussMetal=(g.topCircle.length+g.lowerTotalM)*profilePrice(g.chordProfile,p)+webOneM*profilePrice(g.webProfile,p,'web'),oneTrussWeld=p.weld4m*(g.widthM/4),oneTrussConsumables=p.wire+p.discs,oneTrussPaintArea=(g.topCircle.length+g.lowerTotalM)*profilePerimeter(g.chordProfile)+webOneM*profilePerimeter(g.webProfile),oneTrussPaint=oneTrussPaintArea*p.paint,oneCost=oneTrussMetal+oneTrussWeld+oneTrussConsumables,oneNoPaint=ceil100(oneCost*(1+p.separateMarkup/100)),onePaint=ceil100((oneCost+oneTrussPaint)*(1+p.separateMarkup/100));
  const warnings=[];
  if(g.widthPostsM>p.maxWidth)warnings.push('Ширина больше '+p.maxWidth+' м — нужна отдельная инженерная проверка.');
  if(lengthM>p.maxLength)warnings.push('Длина больше '+p.maxLength+' м — нужна отдельная инженерная проверка.');
  if(coverageData.warning)warnings.push(coverageData.warning);
  const materialRows=[
    {name:'Пояса ферм '+g.chordProfile,used:chordUsedM,sticks:chordSticks,buy:chordSticks*p.stick,cost:chordCost,note:'Верхний + нижний пояс'},
    {name:(g.trussType==='Вертикальная'?'Вертикальная решётка ':g.trussType==='Усиленная'?'Усиленная решётка ':'Треугольная решётка ')+g.webProfile,used:webUsedM,sticks:webPack.sticks,buy:webPack.sticks*p.stick,cost:webCost,note:(g.trussType==='Вертикальная'?'Вертикальные стойки':g.trussType==='Усиленная'?'Диагонали + вертикальные стойки':'Диагонали')+' + торцевые стойки'},
    {name:'Лаги 40×20×2',used:lagUsedM,sticks:lagsSticks,buy:lagsSticks*p.stick,cost:lagCost,note:(coverage==='Профнастил'?'Авто 80–100 см':lagMode==='Эконом'?'Эконом ≤50 см':'Стандарт ≈40 см')+'; стыкуемые куски не короче 2 м'},
    {name:'80×80×3',used:beamPostUsedM,sticks:tube80Sticks,buy:tube80Sticks*p.stick,cost:tube80Cost,note:(beamCount?beamCount+' балки + ':'')+newPosts+' новых столбов'}
  ];
  return {p,lengthM,visibleHeightM,delivery,coverage,installType,paint,postsNeeded,beamsExisting,totalPosts,postsPerSide,existingPosts,newPosts,clearPostStep,postLen,trussCount,area,lagMode,intervals,lagLines,lagStep,chordUsedM,webUsedM,lagUsedM,beamCount,beamPostUsedM,chordSticks,webPack,lagsSticks,tube80Sticks,metalCost,coverageCost,fittingsCost,coverageData,consumables,weld,mountRate,mount,postMount,paintArea,paintCost,base,markup,priceNoDelivery,total,ownerMount,actualExpenses,profit,margin,trussType:g.trussType,materialMode:g.materialMode,oneTruss:{metal:oneTrussMetal,weld:oneTrussWeld,consumables:oneTrussConsumables,paintArea:oneTrussPaintArea,paint:oneTrussPaint,cost:oneCost,priceNoPaint:oneNoPaint,pricePaint:onePaint,profitNoPaint:oneNoPaint-oneCost,profitPaint:onePaint-oneCost-oneTrussPaint},materialRows,warnings};
}
window.CanopyPricing={DEFAULTS:P,mergePrices,autoTrussCount,compute,lagSticks,binPack,polyPurchase,connectorSticks,sticks80,profilePrice,profilePerimeter};
})();