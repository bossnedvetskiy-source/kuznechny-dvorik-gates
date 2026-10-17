// Preliminary side-local elevation for preview and SVG download.
// Not a production cut-list or a structural / welding drawing.
const safe=value=>String(value).replace(/[&<>"']/g,c=>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mm=value=>Math.round(Number(value)*1000);
export function buildOpeningSketchSvg(plan,options={}){
  const {sideId='A',opening={},postSize=80,fillName='Как на стороне забора'}=options;
  if(!plan||!Array.isArray(plan.leaves)||!plan.leaves.length)throw Error('Нечего чертить');
  const gate=plan.kind==='gate';
  const scale=Math.min(710/plan.openingWidth,290/(plan.leafHeight+.13));
  const x0=174,yBottom=500,post=plan.postWidth;
  const x=metres=>x0+metres*scale;
  const y=metres=>yBottom-metres*scale;
  const box=(left,top,width,height,klass)=>`<rect x="${left.toFixed(2)}" y="${top.toFixed(2)}" width="${width.toFixed(2)}" height="${height.toFixed(2)}" class="${klass}"/>`;
  const lines=[];
  const ptop=y(plan.bottomClearance+plan.leafHeight);
  const pbottom=y(plan.bottomClearance);
  lines.push(box(x(0)-post*scale/2,ptop-26,post*scale,pbottom-ptop+52,'post'));
  lines.push(box(x(plan.openingWidth)-post*scale/2,ptop-26,post*scale,pbottom-ptop+52,'post'));
  for(const part of plan.leaves){
    const left=x(part.left),right=x(part.right),top=ptop,bottom=pbottom;
    lines.push(box(left,top,right-left,bottom-top,'steel'));
    lines.push(box(left+3,top+3,right-left-6,bottom-top-6,'inner'));
    if(opening.innerFrame!==false)
      lines.push(`<path class="bar" d="M ${left+4} ${(top+bottom)/2} H ${right-4}"/>`);
    const hingeAt=x(part.hingeSide==='left'?part.left:part.right);
    const freeX=x(part.hingeSide==='left'?part.right:part.left);
    lines.push(`<path class="brace" d="M ${hingeAt} ${bottom-10} L ${freeX} ${top+10}"/>`);
    for(const ty of [top+34,bottom-34])
      lines.push(`<circle class="hinge" cx="${hingeAt}" cy="${ty}" r="5.5"/>`);
    const mid=(left+right)/2;
    lines.push(`<text class="leaf-number" x="${mid}" y="${top+27}">Створка ${part.index}</text>`);
    lines.push(`<text class="leaf-width" x="${mid}" y="${bottom+20}">${mm(part.width)} мм</text>`);
  }
  if(plan.embedded){
    const p=plan.embedded;
    const leaf=plan.leaves.find(a=>a.index===p.leafIndex);
    const dl=x(leaf.center+p.localLeft),dr=x(leaf.center+p.localRight);
    lines.push(`<rect class="embedded" x="${dl}" y="${ptop+4}" width="${dr-dl}" height="${pbottom-ptop-4}"/>`);
    lines.push(`<text class="embedded-label" x="${(dl+dr)/2}" y="${ptop+49}">Встроенная</text>`);
    lines.push(`<text class="embedded-label" x="${(dl+dr)/2}" y="${ptop+64}">калитка</text>`);
    lines.push(`<path class="bar" d="M ${dl} ${pbottom-16} H ${dr}"/>`);
  }
  const width=mm(plan.clearWidth),height=mm(plan.leafHeight);
  const direction=opening.openDirection==='outward'?'наружу участка':'внутрь участка';
  const hinges=gate?'с двух сторон':opening.hingeSide==='right'?'справа':'слева';
  const title=(gate?'РАСПАШНЫЕ ВОРОТА':'КАЛИТКА')+' · СТОРОНА '+sideId;
  const offset=mm(Number(opening.offset)||0);
  const note='Проём в свету '+width+' мм · створка по высоте '+height+' мм';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 690" width="1100" height="690" role="img" aria-label="${safe(title)}">
  <style>
    text{font-family:Arial,"DejaVu Sans",sans-serif;fill:#24313e}
    .steel{fill:#eef2f5;stroke:#35465a;stroke-width:5}
    .inner{fill:rgba(255,255,255,.55);stroke:#7b91a3;stroke-width:1.8}
    .post{fill:#ced8e1;stroke:#4d667a;stroke-width:2}
    .brace{fill:none;stroke:#6d8395;stroke-width:8;opacity:.8}
    .bar{fill:none;stroke:#35465a;stroke-width:7}
    .hinge{fill:#c6811c;stroke:#8f4e0c;stroke-width:2}
    .embedded{fill:none;stroke:#b87927;stroke-width:3;stroke-dasharray:9 6}
    .embedded-label{font-size:15px;font-weight:bold;text-anchor:middle;fill:#a0691d}
    .leaf-number{font-size:14px;font-weight:bold;text-anchor:middle;fill:#44596d}
    .leaf-width{font-size:14px;text-anchor:middle}
    .dim{stroke:#405669;stroke-width:1.5;fill:none}
    .meta{font-size:19px}
  </style>
  <rect width="1100" height="690" fill="white"/>
  <text x="60" y="61" font-size="27" font-weight="bold">${safe(title)}</text>
  <text x="60" y="94" font-size="17" fill="#5c7182">${safe(note)}</text>
  <path class="dim" d="M ${x(post/2)} 148 V 115 M ${x(plan.openingWidth-post/2)} 148 V 115 M ${x(post/2)} 123 H ${x(plan.openingWidth-post/2)}"/>
  <text x="${(x(post/2)+x(plan.openingWidth-post/2))/2}" y="116" font-size="19" text-anchor="middle" font-weight="bold">${width} мм — между столбами</text>
  ${lines.join('\n')}
  <path class="dim" d="M ${x(plan.openingWidth)+32} ${ptop} H ${x(plan.openingWidth)+65} M ${x(plan.openingWidth)+32} ${pbottom} H ${x(plan.openingWidth)+65} M ${x(plan.openingWidth)+52} ${ptop} V ${pbottom}"/>
  <text x="${x(plan.openingWidth)+88}" y="${(ptop+pbottom)/2}" class="meta" transform="rotate(90,${x(plan.openingWidth)+88},${(ptop+pbottom)/2})" text-anchor="middle">${height} мм</text>
  <path d="M 60 550 H 1040" stroke="#d5dfe6"/>
  <text x="60" y="582" font-size="18">Каркас: ${safe((opening.frameProfile||'40x25').replace('x','×'))} мм · Петли: ${safe(hinges)}</text>
  <text x="60" y="610" font-size="18">Обшивка: ${safe(fillName)} · Открывание: ${safe(direction)}</text>
  <text x="60" y="638" font-size="16">Отступ вдоль стороны от начала: ${offset} мм · Столбы: ${postSize}×${postSize} мм</text>
  <text x="60" y="666" font-size="14" font-weight="bold" fill="#a35a19">ЭСКИЗ ДЛЯ СОГЛАСОВАНИЯ · НЕ КАРТА РАСКРОЯ И НЕ ПРОИЗВОДСТВЕННЫЙ ЧЕРТЁЖ</text>
  </svg>`;
}
