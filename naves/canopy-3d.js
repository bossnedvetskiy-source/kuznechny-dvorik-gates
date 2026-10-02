(() => {
'use strict';
const NS='http://www.w3.org/2000/svg';
const el=(name,attrs={},text='')=>{const n=document.createElementNS(NS,name);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));if(text)n.textContent=text;return n;};
function render(svg,g,c){
  svg.innerHTML='';if(!g?.ok||!c)return;
  const W=1200,H=700;
  svg.append(el('rect',{x:0,y:0,width:W,height:H,fill:'#f7f6f1'}));
  const defs=el('defs');
  const grad=el('linearGradient',{id:'roofGrad',x1:'0',y1:'0',x2:'1',y2:'1'});
  grad.append(el('stop',{offset:'0%','stop-color':'#d7eef4','stop-opacity':'.78'}),el('stop',{offset:'100%','stop-color':'#91bdc8','stop-opacity':'.38'}));
  defs.append(grad);svg.append(defs);
  svg.append(el('text',{x:48,y:48,fill:'#141618','font-size':26,'font-weight':800},'АРОЧНЫЙ НАВЕС — ОБЪЁМНАЯ СХЕМА'));
  svg.append(el('text',{x:48,y:75,fill:'#687078','font-size':14},'Предварительная визуализация по введённым размерам'));

  const width=g.widthM,length=c.lengthM,height=Math.max(1.6,c.visibleHeightM),roofRise=g.riseM;
  // Fit the complete isometric footprint inside the SVG instead of allowing the
  // far side of a long/wide canopy to extend beyond the viewBox on mobile.
  const side=70,rawSx=130,rawSy=42;
  const footprint=Math.max(1,width*rawSx+length*rawSy);
  const fit=Math.min(1,(W-side*2)/footprint);
  const sx=rawSx*fit,sy=rawSy*fit;
  const ox=side+width*sx/2+length*sy;
  const groundVertical=width*sx*.08+length*sy*.52;
  const groundBottom=H-80;
  const oy=groundBottom-groundVertical;
  const maxZ=Math.max(.1,height+roofRise);
  const sz=Math.max(55,Math.min(125,(oy-width*sx*.08-105)/maxZ));
  const P=(x,y,z)=>({x:ox+(x-width/2)*sx-y*sy,y:oy+(x-width/2)*sx*.16+y*sy*.52-z*sz});
  const line=(a,b,attrs={})=>svg.append(el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#272b2e','stroke-width':4,'stroke-linecap':'round',...attrs}));
  const poly=(pts,attrs={})=>svg.append(el('polygon',{points:pts.map(p=>p.x.toFixed(1)+','+p.y.toFixed(1)).join(' '),...attrs}));
  const path=(pts,attrs={})=>svg.append(el('path',{d:pts.map((p,i)=>(i?'L':'M')+' '+p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' '),fill:'none',stroke:'#202427','stroke-width':3.2,'stroke-linejoin':'round','stroke-linecap':'round',...attrs}));

  const postXs=[g.overhangM,g.widthM-g.overhangM];
  const postCount=Math.max(2,c.postsPerSide||2);
  const postYs=Array.from({length:postCount},(_,i)=>postCount===1?0:c.lengthM*i/(postCount-1));
  postYs.forEach(y=>postXs.forEach(x=>line(P(x,y,0),P(x,y,height),{'stroke-width':7,stroke:'#34393e'})));
  postXs.forEach(x=>line(P(x,0,height),P(x,c.lengthM,height),{'stroke-width':7,stroke:'#34393e'}));

  const arcPoints=(y,n=26)=>Array.from({length:n+1},(_,i)=>{
    const x=g.widthM*i/n;
    const local=x-g.widthM/2;
    const z=height+window.TrussGeometry.arcY(local,g.widthM,g.riseM);
    return P(x,y,z);
  });
  const trussCount=Math.max(2,c.trussCount||2);
  const trussYs=Array.from({length:trussCount},(_,i)=>c.lengthM*i/(trussCount-1));

  for(let i=0;i<trussYs.length-1;i++){
    const a=arcPoints(trussYs[i],20),b=arcPoints(trussYs[i+1],20);
    for(let j=0;j<a.length-1;j++){
      poly([a[j],a[j+1],b[j+1],b[j]],{fill:'url(#roofGrad)',stroke:'none'});
    }
  }
  trussYs.forEach(y=>path(arcPoints(y,32),{stroke:'#25292c','stroke-width':3.2}));
  const roofLines=Math.max(3,Math.min(9,c.lagLines||5));
  for(let i=0;i<roofLines;i++){
    const x=g.widthM*i/(roofLines-1),local=x-g.widthM/2,z=height+window.TrussGeometry.arcY(local,g.widthM,g.riseM);
    line(P(x,0,z),P(x,c.lengthM,z),{stroke:'#70777c','stroke-width':2.1,'stroke-opacity':'.82'});
  }

  const ground=[P(0,0,0),P(width,0,0),P(width,length,0),P(0,length,0)];
  poly(ground,{fill:'#deded8','fill-opacity':'.48',stroke:'#b8bab6','stroke-width':1.2});
  postYs.forEach(y=>postXs.forEach(x=>svg.append(el('circle',{cx:P(x,y,0).x,cy:P(x,y,0).y,r:4,fill:'#25292c'}))));

  const info=[
    'Размер: '+window.TrussGeometry.fmt(g.widthPostsM,2)+' × '+window.TrussGeometry.fmt(c.lengthM,2)+' м',
    'Высота: '+window.TrussGeometry.fmt(c.visibleHeightM,2)+' м',
    'Ферм: '+c.trussCount+' шт',
    'Опор: '+c.totalPosts+' шт',
    'Покрытие: '+c.coverage
  ];
  info.forEach((t,i)=>svg.append(el('text',{x:48,y:620+i*18,fill:'#4c5358','font-size':12,'font-weight':i===0?800:600},t)));
  svg.append(el('text',{x:1150,y:660,fill:'#8b9196','font-size':11,'text-anchor':'end'},'Схема не является монтажным чертежом'));
}
window.Canopy3D={render};
})();