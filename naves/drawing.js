(() => {
  'use strict';
  const NS='http://www.w3.org/2000/svg';
  const el=(name,attrs={},text='')=>{
    const node=document.createElementNS(NS,name);
    for(const [k,v] of Object.entries(attrs)) node.setAttribute(k,String(v));
    if(text) node.textContent=text;
    return node;
  };
  const pathFrom=(pts,X,Y)=>pts.map((p,i)=>(i?'L':'M')+' '+X(p.x).toFixed(2)+' '+Y(p.y).toFixed(2)).join(' ');
  function render(svg,g){
    svg.innerHTML='';
    if(!g?.ok)return;
    const W=1200,H=640, left=115,right=150,top=105,bottom=155;
    const maxY=Math.max(g.riseM,.45);
    const sx=(W-left-right)/g.widthM;
    const sy=(H-top-bottom)/maxY;
    const scale=Math.min(sx,sy);
    const cx=(W-right+left)/2;
    const base=H-bottom;
    const X=x=>cx+x*scale;
    const Y=y=>base-y*scale;
    const defs=el('defs');
    const marker=el('marker',{id:'arrow',viewBox:'0 0 10 10',refX:'5',refY:'5',markerWidth:'7',markerHeight:'7',orient:'auto-start-reverse'});
    marker.append(el('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'#59616a'}));
    defs.append(marker); svg.append(defs);
    svg.append(el('rect',{x:0,y:0,width:W,height:H,fill:'#f8f7f2'}));
    const title=el('text',{x:55,y:45,fill:'#121416','font-size':27,'font-weight':800},'АРОЧНАЯ ФЕРМА — ВИД СБОКУ');
    svg.append(title);
    svg.append(el('text',{x:55,y:73,fill:'#687078','font-size':15},'Размеры по осям профилей • узлы обозначены D и V • не является шаблоном для реза')); 
    const spec=window.TrussGeometry.productionSpec(g,g.trussCount);
    const sg=spec.geometry;
    svg.append(el('text',{x:55,y:111,fill:'#38434b','font-size':15,'font-weight':800},
      'ВЕРХНИЙ ПОЯС  R '+sg.upperRadiusMm+' мм  •  дуга '+sg.upperArcMm+' мм'));
    svg.append(el('text',{x:55,y:132,fill:'#38434b','font-size':15,'font-weight':800},
      'НИЖНИЙ ПОЯС  R '+sg.lowerRadiusMm+' мм  •  дуга '+sg.lowerArcMm+' мм  +  края '+sg.endFlatMm+' × 2 мм'));
    const pts=(chord,sag,n=80)=>Array.from({length:n+1},(_,i)=>{
      const x=-chord/2+chord*i/n;
      return {x,y:window.TrussGeometry.arcY(x,chord,sag)};
    });
    const topPts=pts(g.widthM,g.riseM,100);
    const lowPts=pts(g.innerChordM,g.lowerRiseM,80);
    const stroke='#111416';
    const common={fill:'none',stroke,'stroke-width':5,'stroke-linecap':'round','stroke-linejoin':'round'};
    svg.append(el('path',{d:pathFrom(topPts,X,Y),...common}));
    svg.append(el('line',{x1:X(-g.widthM/2),y1:Y(0),x2:X(-g.innerChordM/2),y2:Y(0),...common}));
    svg.append(el('path',{d:pathFrom(lowPts,X,Y),...common}));
    svg.append(el('line',{x1:X(g.innerChordM/2),y1:Y(0),x2:X(g.widthM/2),y2:Y(0),...common}));
    const leftPostTop=window.TrussGeometry.arcY(-g.innerChordM/2,g.widthM,g.riseM);
    const rightPostTop=window.TrussGeometry.arcY(g.innerChordM/2,g.widthM,g.riseM);
    for(const side of [-1,1]){
      const x=side*g.innerChordM/2;
      svg.append(el('text',{x:X(x)+(side<0?-8:8),y:Y(0)-10,fill:'#59616a',
        'font-size':11,'font-weight':800,'text-anchor':side<0?'end':'start'},'T'));
    }
    svg.append(el('line',{x1:X(-g.innerChordM/2),y1:Y(0),x2:X(-g.innerChordM/2),y2:Y(leftPostTop),...common}));
    svg.append(el('line',{x1:X(g.innerChordM/2),y1:Y(0),x2:X(g.innerChordM/2),y2:Y(rightPostTop),...common}));
    if(g.trussType==='Вертикальная'||g.trussType==='Усиленная'){
      g.verticals.forEach(v=>{
        svg.append(el('line',{
          x1:X(v.x),y1:Y(v.yLower),x2:X(v.x),y2:Y(v.yUpper),
          stroke:'#252a2f','stroke-width':3.2,'stroke-linecap':'round'
        }));
        svg.append(el('text',{
          x:X(v.x)+8,y:(Y(v.yLower)+Y(v.yUpper))/2+4,
          fill:'#575e65','font-size':10,'font-weight':700
        },'V'+v.index));
      });
    }
    if(g.trussType==='Треугольная'||g.trussType==='Усиленная'){
      g.diagonals.forEach((d,i)=>{
        const a=g.nodes[i],b=g.nodes[i+1];
        svg.append(el('line',{x1:X(a.x),y1:Y(a.yWeb),x2:X(b.x),y2:Y(b.yWeb),stroke:'#252a2f','stroke-width':3.5,'stroke-linecap':'round'}));
        const mx=(X(a.x)+X(b.x))/2,my=(Y(a.yWeb)+Y(b.yWeb))/2-8;
        svg.append(el('text',{x:mx,y:my,fill:'#575e65','font-size':11,'font-weight':700,'text-anchor':'middle'},'D'+d.index));
      });
    }
    const dim='#59616a';
    const dimLine=(x1,y1,x2,y2)=>el('line',{x1,y1,x2,y2,stroke:dim,'stroke-width':1.5,'marker-start':'url(#arrow)','marker-end':'url(#arrow)'});
    const guide=(x1,y1,x2,y2)=>el('line',{x1,y1,x2,y2,stroke:'#9da4aa','stroke-width':1});
    const widthY=base+72;
    svg.append(guide(X(-g.widthM/2),base,X(-g.widthM/2),widthY-7));
    svg.append(guide(X(g.widthM/2),base,X(g.widthM/2),widthY-7));
    svg.append(dimLine(X(-g.widthM/2),widthY,X(g.widthM/2),widthY));
    svg.append(el('text',{x:cx,y:widthY+25,fill:'#1d2226','font-size':18,'font-weight':800,'text-anchor':'middle'},window.TrussGeometry.mm(g.widthM)+' мм'));
    const riseX=Math.min(W-65,X(g.widthM/2)+72);
    svg.append(guide(cx,Y(g.riseM),riseX-8,Y(g.riseM)));
    svg.append(guide(X(g.widthM/2),base,riseX-8,base));
    svg.append(dimLine(riseX,base,riseX,Y(g.riseM)));
    svg.append(el('text',{x:riseX+12,y:(base+Y(g.riseM))/2-4,fill:'#1d2226','font-size':14,'font-weight':700},'подъём'));
    svg.append(el('text',{x:riseX+12,y:(base+Y(g.riseM))/2+16,fill:'#1d2226','font-size':14,'font-weight':800},window.TrussGeometry.mm(g.riseM)+' мм'));
    const crownLow=window.TrussGeometry.arcY(0,g.innerChordM,g.lowerRiseM);
    const hX=cx-34;
    svg.append(dimLine(hX,Y(crownLow),hX,Y(g.riseM)));
    svg.append(el('text',{x:hX-12,y:(Y(crownLow)+Y(g.riseM))/2+4,fill:'#1d2226','font-size':13,'font-weight':800,'text-anchor':'end'},window.TrussGeometry.mm(g.heightM)+' мм'));
    const flatY=base+28;
    for(const side of [-1,1]){
      const a=side<0?-g.widthM/2:g.innerChordM/2;
      const b=side<0?-g.innerChordM/2:g.widthM/2;
      svg.append(dimLine(X(a),flatY,X(b),flatY));
      svg.append(el('text',{x:(X(a)+X(b))/2,y:flatY-8,fill:'#59616a','font-size':11,'text-anchor':'middle'},window.TrussGeometry.mm(g.endFlatM)));
    }
    const memberLabel=g.trussType==='Вертикальная'
      ?('V1…V'+g.verticalCount)
      :g.trussType==='Усиленная'
        ?('D1…D'+g.diagonalCount+' + V1…V'+g.verticalCount)
        :('D1…D'+g.diagonalCount);
    svg.append(el('text',{x:55,y:H-34,fill:'#454c52','font-size':14,'font-weight':700},
      'Тип: '+g.trussType+'   •   Материал: '+g.materialMode+'   •   '+memberLabel));
    svg.append(el('text',{x:W-55,y:H-34,fill:'#454c52','font-size':14,'font-weight':700,'text-anchor':'end'},'Ферм в заказе: '+spec.trusses));
  }
  function serialize(svg){
    const copy=svg.cloneNode(true);
    copy.setAttribute('xmlns',NS); copy.setAttribute('width','1200'); copy.setAttribute('height','640');
    return '<?xml version="1.0" encoding="UTF-8"?>\n'+new XMLSerializer().serializeToString(copy);
  }
  window.TrussDrawing={render,serialize};
})();