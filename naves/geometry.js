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
    let n=Math.max(4,Math.min(30,Math.round(v)));
    if(n%2)n+=1;
    return n;
  }

  function resolveProfiles(mode,widthM){
    const selected=mode||'Авто';

    // New calculator modes: the selected tube is used for the whole truss
    // (upper/lower chords and the internal lattice).
    if(selected==='30×30×2') return {chord:selected,web:selected,legacy:false};
    if(selected==='40×20×2') return {chord:selected,web:selected,legacy:false};

    // Backward compatibility for already-saved calculations.
    const chord=selected==='Авто'?(widthM<4?'25×25×1,5':'30×30×2'):selected;
    const web=chord==='25×25×1,5'?'20×20×1,5':
      chord==='30×30×2'?'25×25×1,5':
      chord==='40×20×2'?'20×20×1,5':'40×20×2';
    return {chord,web,legacy:true};
  }

  function buildTriangularMembers(innerChordM,lowerRiseM,widthM,riseM,targetCellM){
    const diagonalCount=nearestEven(circle(widthM,riseM).length/targetCellM);
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
      diagonals.push({
        index:i+1,
        x1:a.x,y1:a.yWeb,x2:b.x,y2:b.yWeb,
        lengthM:Math.hypot(dx,dy),
        angleDeg:Math.atan2(Math.abs(dy),Math.abs(dx))*180/Math.PI
      });
    }
    return {diagonalCount,stepM,nodes,diagonals,verticals:[]};
  }

  function buildVerticalMembers(innerChordM,lowerRiseM,widthM,riseM,targetCellM){
    const intervalCount=Math.max(3,Math.min(24,Math.round(innerChordM/targetCellM)));
    const stepM=innerChordM/intervalCount;
    const verticals=[];
    for(let i=1;i<intervalCount;i++){
      const x=-innerChordM/2+stepM*i;
      const yLower=arcY(x,innerChordM,lowerRiseM);
      const yUpper=arcY(x,widthM,riseM);
      verticals.push({
        index:i,
        x,
        yLower,
        yUpper,
        lengthM:Math.max(0,yUpper-yLower),
        angleDeg:90
      });
    }
    return {
      diagonalCount:0,
      stepM,
      nodes:[],
      diagonals:[],
      verticals,
      verticalCount:verticals.length
    };
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
    const trussCount=Math.round(clamp(Number(raw.trussCount)||1,1,40));
    const trussType=raw.trussType==='Вертикальная'?'Вертикальная':'Треугольная';

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

    const members=trussType==='Вертикальная'
      ? buildVerticalMembers(innerChordM,lowerRiseM,widthM,riseM,targetCellM)
      : buildTriangularMembers(innerChordM,lowerRiseM,widthM,riseM,targetCellM);

    const profiles=resolveProfiles(raw.materialMode,widthM);
    const endPostM=arcY(innerChordM/2,widthM,riseM);

    return {
      ok:true,
      widthPostsM,overhangM,widthM,riseM,recommendedRiseMm,heightM,endFlatM,targetCellM,
      projectedStepM:members.stepM,trussCount,innerChordM,lowerRiseM,topCircle,lowerCircle,
      lowerTotalM:lowerCircle.length+2*endFlatM,
      diagonalCount:members.diagonalCount||0,
      verticalCount:members.verticalCount||0,
      nodes:members.nodes||[],
      diagonals:members.diagonals||[],
      verticals:members.verticals||[],
      endPostM,
      chordProfile:profiles.chord,
      webProfile:profiles.web,
      materialMode:raw.materialMode||'Авто',
      trussType,
      legacyProfileMode:profiles.legacy,
      internalMembersM:(members.diagonals||[]).reduce((a,d)=>a+d.lengthM,0)+(members.verticals||[]).reduce((a,v)=>a+v.lengthM,0)
    };
  }

  window.TrussGeometry={compute,circle,arcY,mm,fmt,resolveProfiles};
})();