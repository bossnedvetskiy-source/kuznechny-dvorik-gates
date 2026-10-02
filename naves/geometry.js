(() => {
  'use strict';
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  const mm=m=>Math.round(m*1000);
  const fmt=(v,d=0)=>Number(v).toLocaleString('ru-RU',{maximumFractionDigits:d,minimumFractionDigits:d});
  function circle(chord,sag){
    if(!(chord>0)||!(sag>0)||sag>=chord/2)return null;
    const radius=chord*chord/(8*sag)+sag/2;
    const theta=2*Math.asin(chord/(2*radius));
    return {radius,theta,length:radius*theta};
  }
  function arcY(x,chord,sag){
    const c=circle(chord,sag);
    if(!c)return NaN;
    return -(c.radius-sag)+Math.sqrt(Math.max(0,c.radius*c.radius-x*x));
  }
  function nearestEven(v){
    let n=Math.max(4,Math.min(24,Math.round(v)));
    if(n%2)n+=1;
    return n;
  }
  function compute(raw){
    const widthPostsM=clamp(Number(raw.widthPostsM)||3.4,1.5,8);
    const overhangM=clamp(Number(raw.overhangMm)||150,0,600)/1000;
    const widthM=widthPostsM+2*overhangM;
    const recommendedRiseMm=widthPostsM*1000/6;
    const riseM=clamp(Number(raw.riseMm)||recommendedRiseMm,100,2000)/1000;
    const heightM=clamp(Number(raw.heightMm)||250,120,600)/1000;
    const endFlatM=clamp(Number(raw.endFlatMm)||300,0,800)/1000;
    const targetCellM=clamp(Number(raw.cellStepMm)||400,250,700)/1000;
    const trussCount=Math.round(clamp(Number(raw.trussCount)||6,1,30));
    const innerChordM=widthM-2*endFlatM;
    const lowerRiseM=riseM-heightM;
    const topCircle=circle(widthM,riseM);
    const lowerCircle=circle(innerChordM,lowerRiseM);
    const errors=[];
    if(innerChordM<=0.6)errors.push('Прямые края нижнего пояса слишком большие для этой ширины фермы.');
    if(lowerRiseM<=0.03)errors.push('Подъём дуги должен быть больше высоты фермы минимум примерно на 30 мм.');
    if(!topCircle)errors.push('Геометрия верхней дуги недопустима.');
    if(!lowerCircle)errors.push('Геометрия нижней дуги недопустима.');
    if(errors.length)return {ok:false,errors,recommendedRiseMm};
    const diagonalCount=nearestEven(innerChordM/targetCellM);
    const stepM=innerChordM/diagonalCount;
    const nodes=[];
    for(let i=0;i<=diagonalCount;i++){
      const x=-innerChordM/2+stepM*i;
      const yLower=arcY(x,innerChordM,lowerRiseM);
      const yUpper=arcY(x,widthM,riseM);
      nodes.push({x,yLower,yUpper,yWeb:i%2===0?yLower:yUpper});
    }
    const diagonals=[];
    for(let i=0;i<nodes.length-1;i++){
      const a=nodes[i],b=nodes[i+1],dx=b.x-a.x,dy=b.yWeb-a.yWeb;
      diagonals.push({index:i+1,lengthM:Math.hypot(dx,dy),angleDeg:Math.atan2(Math.abs(dy),Math.abs(dx))*180/Math.PI});
    }
    return {
      ok:true,widthPostsM,overhangM,widthM,riseM,recommendedRiseMm,heightM,endFlatM,targetCellM,
      projectedStepM:stepM,trussCount,innerChordM,lowerRiseM,topCircle,lowerCircle,
      lowerTotalM:lowerCircle.length+2*endFlatM,diagonalCount,nodes,diagonals,
      endPostM:arcY(innerChordM/2,widthM,riseM),
      chordProfile:raw.chordProfile,webProfile:raw.webProfile
    };
  }
  window.TrussGeometry={compute,circle,arcY,mm,fmt};
})();