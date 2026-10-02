(() => {
'use strict';
const NS='http://www.w3.org/2000/svg';
const el=(name,attrs={},text='')=>{
  const n=document.createElementNS(NS,name);
  for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));
  if(text)n.textContent=text;
  return n;
};
function render(svg,g,c){
  svg.innerHTML='';if(!g?.ok||!c)return;
  const W=1200,H=700;
  svg.setAttribute('overflow','hidden');
  svg.setAttribute('width','100%');
  svg.style.overflow='hidden';

  const defs=el('defs');
  const bg=el('linearGradient',{id:'sceneBg',x1:'0',y1:'0',x2:'0',y2:'1'});
  bg.append(el('stop',{offset:'0%','stop-color':'#fbfaf6'}),el('stop',{offset:'100%','stop-color':'#eeeae2'}));
  const roof=el('linearGradient',{id:'roofGlass',x1:'0',y1:'0',x2:'1',y2:'1'});
  roof.append(el('stop',{offset:'0%','stop-color':'#dff5fb','stop-opacity':'.88'}),el('stop',{offset:'55%','stop-color':'#aed7e1','stop-opacity':'.58'}),el('stop',{offset:'100%','stop-color':'#81b5c2','stop-opacity':'.40'}));
  const shadow=el('filter',{id:'shadow',x:'-30%',y:'-30%',width:'160%',height:'160%'});
  shadow.append(el('feGaussianBlur',{stdDeviation:'12'}));
  const marker=el('marker',{id:'arrow',viewBox:'0 0 10 10',refX:'5',refY:'5',markerWidth:'7',markerHeight:'7',orient:'auto-start-reverse'});
  marker.append(el('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'#b1843c'}));
  const clip=el('clipPath',{id:'sceneClip'});clip.append(el('rect',{x:0,y:0,width:W,height:H,rx:24}));
  defs.append(bg,roof,shadow,marker,clip);svg.append(defs);

  const scene=el('g',{'clip-path':'url(#sceneClip)'});svg.append(scene);
  const add=node=>(scene.append(node),node);
  add(el('rect',{x:0,y:0,width:W,height:H,rx:24,fill:'url(#sceneBg)'}));

  const width=g.widthM,length=c.lengthM,height=Math.max(1.6,c.visibleHeightM),rise=g.riseM;
  const side=88,rawSx=126,rawSy=39;
  const footprint=Math.max(1,width*rawSx+length*rawSy);
  const fit=Math.min(1,(W-side*2)/footprint);
  const sx=rawSx*fit,sy=rawSy*fit;
  const ox=side+width*sx/2+length*sy;
  const groundVertical=width*sx*.10+length*sy*.50;
  const oy=H-118-groundVertical;
  const sz=Math.max(58,Math.min(122,(oy-width*sx*.08-118)/Math.max(.1,height+rise)));
  const P=(x,y,z)=>({x:ox+(x-width/2)*sx-y*sy,y:oy+(x-width/2)*sx*.18+y*sy*.50-z*sz});
  const line=(a,b,attrs={})=>add(el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#34383b','stroke-width':4,'stroke-linecap':'round',...attrs}));
  const poly=(pts,attrs={})=>add(el('polygon',{points:pts.map(p=>p.x.toFixed(1)+','+p.y.toFixed(1)).join(' '),...attrs}));
  const path=(pts,attrs={})=>add(el('path',{d:pts.map((p,i)=>(i?'L':'M')+' '+p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' '),fill:'none',stroke:'#2f3336','stroke-width':3,'stroke-linejoin':'round','stroke-linecap':'round',...attrs}));
  const text=(x,y,t,attrs={})=>add(el('text',{x,y,fill:'#4b5054','font-size':12,'font-family':'system-ui, sans-serif',...attrs},t));

  add(el('ellipse',{cx:W*.53,cy:H*.76,rx:W*.34,ry:46,fill:'#8c8170','fill-opacity':'.18',filter:'url(#shadow)'}));

  const ground=[P(0,0,0),P(width,0,0),P(width,length,0),P(0,length,0)];
  poly(ground,{fill:'#dedbd3','fill-opacity':'.60',stroke:'#cbc5bb','stroke-width':1.2});

  const postXs=[g.overhangM,g.widthM-g.overhangM];
  const postCount=Math.max(2,c.postsPerSide||2);
  const postYs=Array.from({length:postCount},(_,i)=>postCount===1?0:c.lengthM*i/(postCount-1));
  const backPosts=[],frontPosts=[];
  postYs.forEach((y,yi)=>postXs.forEach((x,xi)=>{
    const a=P(x,y,0),b=P(x,y,height);
    const target=yi<postYs.length/2?backPosts:frontPosts;
    target.push([a,b,xi,yi]);
  }));
  backPosts.forEach(([a,b])=>line(a,b,{stroke:'#676b6e','stroke-width':7,'stroke-opacity':'.82'}));

  postXs.forEach(x=>{
    line(P(x,0,height),P(x,c.lengthM,height),{stroke:'#4a4e51','stroke-width':7});
  });

  const arcPoints=(y,n=34)=>Array.from({length:n+1},(_,i)=>{
    const x=g.widthM*i/n,local=x-g.widthM/2;
    return P(x,y,height+window.TrussGeometry.arcY(local,g.widthM,g.riseM));
  });
  const trussCount=Math.max(2,c.trussCount||2);
  const trussYs=Array.from({length:trussCount},(_,i)=>c.lengthM*i/(trussCount-1));

  for(let i=0;i<trussYs.length-1;i++){
    const a=arcPoints(trussYs[i],26),b=arcPoints(trussYs[i+1],26);
    for(let j=0;j<a.length-1;j++){
      poly([a[j],a[j+1],b[j+1],b[j]],{fill:'url(#roofGlass)',stroke:'none'});
    }
  }

  const roofLines=Math.max(4,Math.min(9,c.lagLines||5));
  for(let i=0;i<roofLines;i++){
    const x=g.widthM*i/(roofLines-1),local=x-g.widthM/2,z=height+window.TrussGeometry.arcY(local,g.widthM,g.riseM);
    line(P(x,0,z),P(x,c.lengthM,z),{stroke:'#7c8a8e','stroke-width':2,'stroke-opacity':'.60'});
  }
  trussYs.forEach((y,i)=>path(arcPoints(y,38),{stroke:i===0||i===trussYs.length-1?'#272b2d':'#454b4e','stroke-width':i===0||i===trussYs.length-1?3.8:2.5,'stroke-opacity':i===0||i===trussYs.length-1?'1':'.76'}));
  frontPosts.forEach(([a,b])=>line(a,b,{stroke:'#303437','stroke-width':7.5}));

  postYs.forEach(y=>postXs.forEach(x=>{
    const p=P(x,y,0);add(el('ellipse',{cx:p.x,cy:p.y,rx:6,ry:3.6,fill:'#24282a'}));
  }));

  const gold='#b1843c';
  const dim=(a,b,label,dx=0,dy=0)=>{
    add(el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:gold,'stroke-width':1.7,'marker-start':'url(#arrow)','marker-end':'url(#arrow)'}));
    text((a.x+b.x)/2+dx,(a.y+b.y)/2+dy,label,{fill:gold,'font-size':14,'font-weight':800,'text-anchor':'middle','paint-order':'stroke','stroke':'#f7f5ef','stroke-width':4});
  };
  const floorA=P(0,0,0),floorB=P(width,0,0),floorC=P(width,length,0);
  dim({x:floorA.x,y:floorA.y+42},{x:floorB.x,y:floorB.y+42},window.TrussGeometry.fmt(g.widthPostsM,2)+' м',0,18);
  dim({x:floorB.x+24,y:floorB.y+15},{x:floorC.x+24,y:floorC.y+15},window.TrussGeometry.fmt(c.lengthM,2)+' м',18,0);
  const h0=P(g.overhangM,0,0),h1=P(g.overhangM,0,height);
  dim({x:h0.x-26,y:h0.y},{x:h1.x-26,y:h1.y},window.TrussGeometry.fmt(c.visibleHeightM,2)+' м',-28,3);

  text(46,46,'ВАШ НАВЕС',{fill:'#202326','font-size':25,'font-weight':900});
  text(46,72,'Объёмная схема по выбранным размерам',{fill:'#7a7f83','font-size':13});
  const chips=[
    window.TrussGeometry.fmt(g.widthPostsM,2)+' × '+window.TrussGeometry.fmt(c.lengthM,2)+' м',
    c.coverage,
    c.installType
  ];
  let cx=46;
  chips.forEach(t=>{
    const w=Math.max(92,t.length*7.1+28);
    add(el('rect',{x:cx,y:92,width:w,height:30,rx:15,fill:'#ffffff','fill-opacity':'.86',stroke:'#d8d3c9'}));
    text(cx+w/2,112,t,{fill:'#4d5154','font-size':11,'font-weight':800,'text-anchor':'middle'});
    cx+=w+8;
  });

  text(W-48,H-34,'Предварительная визуализация',{fill:'#8b8f92','font-size':11,'text-anchor':'end'});
}
window.Canopy3D={render};
})();