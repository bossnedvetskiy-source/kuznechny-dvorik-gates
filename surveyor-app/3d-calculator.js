import * as THREE from '../naves/vendor/three.module.js';
import { OrbitControls } from '../naves/vendor/OrbitControls.js';
import { renderGateFrame } from './3d-gate-render.js';
import { renderSlidingGate } from './3d-sliding-render.js';
import { getSlidingGatePlan, getSlidingTravelPlan } from './3d-sliding-frame.js';
import { getGateFramePlan } from './3d-gate-frame.js';
import { buildOpeningSketchSvg, buildSlidingSketchSvg } from './3d-drawing.js';
import { SIDE_IDS, SIDE_NAMES, FILL_IDS, createDefaultSides, normalizeSides, getSiteLayout, normalizePostMode, verticalPicketPlan, isHorizontalFill, normalizeSwingGate, normalizeWicket, normalizeOpenings, getClearDimensionPlan } from './3d-layout.js';

// Standalone DEV prototype. This is visual geometry only, not a retail price quote.
const DRAFT_KEY = 'kd-surveyor-3d-draft-v1';
const DEFAULT = { length: 12, height: 1.8, step: 2.5, postSize: 80, fill: 'picket', gap: 0.05, ral: '7024' };
// Approximate screen representations of powder-coated RAL metal, not calibrated paint samples.
const RAL = { '9003':'#eeefea','8017':'#49312c','7016':'#383e42','7019':'#545653','7024':'#46494f','9005':'#151719','6005':'#114436','3005':'#56212b','5005':'#164b83' };
const RAL_LABELS = { '9003':'Белый','8017':'Шоколад','7016':'Антрацит','7019':'Серый','7024':'Графит','9005':'Чёрный','6005':'Зелёный','3005':'Бордовый','5005':'Синий' };
function horizontalPicketRows(height, gap, doubleRow=false) {
  const plank=0.12, available=Math.max(0.12,height-0.12);
  const count=Math.max(1,Math.floor((available+gap)/(plank+gap)));
  const occupied=count*plank+(count-1)*gap;
  const firstY=0.06+(available-occupied)/2+plank/2;
  const pitch=plank+gap;
  return {
    front:Array.from({length:count},(_,k)=>firstY+k*pitch),
    rear:doubleRow ? Array.from({length:Math.max(0,count-1)},(_,k)=>firstY+(k+0.5)*pitch) : []
  };
}
const AREA_PRESETS=[{name:'6 соток',x:20,z:30},{name:'10 соток',x:25,z:40},{name:'15 соток',x:30,z:50},{name:'20 соток',x:40,z:50}];
const SIDE_SUBTITLES={A:'Фасад',B:'Правая',V:'Задняя',G:'Левая'};
const FILL_LABELS={picket:'Евроштакетник · вертикальный','picket-double':'Евроштакетник · вертикальный шахматка',
  horizontal:'Евроштакетник · горизонтальный','horizontal-double':'Евроштакетник · горизонтальный шахматка',
  sheet:'Профнастил С10',jalousie:'Жалюзи · визуализация'};
let instance = null;

function numeric(value, min, max, fallback) {
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}
function loadDraft() {
  let old=null;
  try { old=JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { /* Invalid prior draft */ }
  const o=(old && typeof old==='object')?old:{};
  const activeSide=SIDE_IDS.includes(o.activeSide)?o.activeSide:'A';
  const sides=normalizeSides(o.sides,o);
  const selected=sides[activeSide];
  return {
    ...DEFAULT,
    ...selected,
    colorScope:o.colorScope==='side'?'side':'all',
    gap:numeric(o.gap,0,0.12,DEFAULT.gap),
    gapFit:o.gapFit===true,
    showDimensions:o.showDimensions===true,
    gate:normalizeSwingGate(o.openings?.A?.gate||o.gate,sides.A.length),
    openings:normalizeOpenings(sides,o.openings,o.gate),
    postSize:[60,80,100].includes(Number(o.postSize))?Number(o.postSize):DEFAULT.postSize,
    sides,
    activeSide
  };
}
function saveDraft(model) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(model)); } catch { /* Storage may be blocked. */ }
}
function frameGeometry(group, base, w, h, d, x, y, z, material) {
  const mesh = new THREE.Mesh(base, material);
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y, z);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}
// Low-poly, physically shaped steel sheets. All dimensions are in metres.
// С10: approximate 100 mm pitch, 10 mm trapezoid relief, 0.6 mm sheet thickness.
// This is a visual profile, not a manufacturing cutting specification.
function buildC10Geometry(width, height) {
  const profile = [{ x:0, z:0 }];
  const pitch = 0.10, depth = 0.010, thickness = 0.0006;
  const points = [[0.020,0], [0.034,depth], [0.066,depth], [0.080,0], [0.100,0]];
  for (let start = 0; start < width - 0.00001; start += pitch) {
    for (const [offset,z] of points) {
      const x = Math.min(width, start + offset);
      if (x > profile[profile.length-1].x + 0.000001) profile.push({ x, z });
      if (x >= width) break;
    }
  }
  if(profile[profile.length-1].x < width-0.000001) profile.push({x:width,z:0});
  const vertices = [];
  const tri = (a,b,c)=>vertices.push(...a,...b,...c);
  const quad = (a,b,c,d)=>{tri(a,b,c);tri(b,d,c);};
  for (let i=0;i<profile.length-1;i++) {
    const a=profile[i], b=profile[i+1];
    const x0=a.x-width/2, x1=b.x-width/2;
    const p0=[x0,0,a.z], p1=[x1,0,b.z], t0=[x0,height,a.z], t1=[x1,height,b.z];
    quad(p0,p1,t0,t1); // facing viewer
    quad([x1,0,b.z-thickness],[x0,0,a.z-thickness],
      [x1,height,b.z-thickness],[x0,height,a.z-thickness]);
    quad(t0,t1,[x0,height,a.z-thickness],[x1,height,b.z-thickness]);
    quad([x0,0,a.z-thickness],[x1,0,b.z-thickness],p0,p1);
  }
  const first=profile[0], last=profile[profile.length-1];
  quad([-width/2,0,first.z-thickness],[-width/2,0,first.z],
    [-width/2,height,first.z-thickness],[-width/2,height,first.z]);
  quad([width/2,0,last.z],[width/2,0,last.z-thickness],
    [width/2,height,last.z],[width/2,height,last.z-thickness]);
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

// One metal picket with rolled side flanges and a shallow raised central ridge.
// Slightly rounded top, open-backed steel profile rather than a rectangular bar.
function buildPicketGeometry(length, horizontal=false) {
  const width=0.12;
  const profile=[[-.060,.003],[-.052,.001],[-.038,.017],[-.012,.027],
    [.012,.027],[.038,.017],[.052,.001],[.060,.003]];
  const vertices=[];
  const tri=(a,b,c)=>vertices.push(...a,...b,...c);
  for(let i=0;i<profile.length-1;i++){
    const [x0,z0]=profile[i], [x1,z1]=profile[i+1];
    const top0=length-0.018*Math.pow(Math.abs(x0)/(.06),3);
    const top1=length-0.018*Math.pow(Math.abs(x1)/(.06),3);
    const a=[x0,0,z0],b=[x1,0,z1],c=[x0,top0,z0],d=[x1,top1,z1];
    tri(a,b,c);tri(b,d,c);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.computeVertexNormals();
  if(horizontal) {
    geometry.rotateZ(-Math.PI/2);
    geometry.translate(-length/2,0,0);
  }
  geometry.computeBoundingSphere();
  return geometry;
}

// Reversing the rear row's bulged face, without negative scaling or inverted normals.
function instancePickets(group, geometry, material, positions, rotationY=0) {
  if(!positions.length)return;
  const mesh=new THREE.InstancedMesh(geometry,material,positions.length);
  const dummy=new THREE.Object3D();
  positions.forEach((p,i)=>{
    dummy.position.set(p.x,p.y,p.z);
    dummy.rotation.set(0,rotationY,0);
    dummy.scale.set(p.width===undefined?1:p.width/.12,1,1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i,dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate=true;
  mesh.frustumCulled=false;
  group.add(mesh);
}
// Two supports for a short section; three vertical guides for regular horizontal pickets.
function guideOffsets(spanWidth) {
  if(spanWidth < 1.25) return [-spanWidth*0.27,spanWidth*0.27];
  return [-spanWidth/2+0.16,0,spanWidth/2-0.16];
}
function buildPostCapGeometry(size) {
  // Four-sided low-profile pitched cap; its square base is 8 mm wider than the post.
  const half=size/2+0.004, topHalf=size/2-0.007;
  const h=0.032;
  const bottom=[[-half,0,-half],[half,0,-half],[half,0,half],[-half,0,half]];
  const top=[[-topHalf,h,-topHalf],[topHalf,h,-topHalf],[topHalf,h,topHalf],[-topHalf,h,topHalf]];
  const triangles=[];
  const triangle=(a,b,c)=>triangles.push(...a,...b,...c);
  for(let i=0;i<4;i++){
    const j=(i+1)%4;
    // Wind side faces outward and top faces upward for correct metal lighting.
    triangle(bottom[i],top[i],bottom[j]);
    triangle(bottom[j],top[i],top[j]);
    if(i<2) triangle(top[0],top[i+2],top[i+1]); // two upward-facing triangles
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(triangles,3));
  geometry.computeVertexNormals();
  return geometry;
}

export function mount3DCalculator(root) {
  if (instance && instance.root === root) {
    instance.resize();
    return;
  }
  if (!root) throw new Error('Не найден раздел 3D расчёта');
  const config = loadDraft();
  const activeSettings=()=>config.sides[config.activeSide];
  root.innerHTML = [
    '<div class="kd3d-top"><div><strong>Конструктор участка</strong><small>3D расчёт · DEV</small></div><span>DEV</span></div>',
    '<div class="kd3d-mode" role="group" aria-label="Вид результата"><button type="button" data-mode="scene" class="active">3D-модель</button><button type="button" data-mode="parts">Комплектация</button></div>',
    '<div class="kd3d-viewport" data-viewport><div class="kd3d-scene" data-scene></div><div class="kd3d-parts" data-parts hidden></div>',
    '<div class="kd3d-scene-controls"><button type="button" data-fit>Показать целиком</button></div><div class="kd3d-slide-legend" data-slide-legend hidden><span><i class="kd3d-legend-ok"></i> Свободное место</span><span><i class="kd3d-legend-blocked"></i> Не хватает места</span><span><i class="kd3d-legend-wicket"></i> Калитка</span></div>',
    '<p class="kd3d-webgl-error" data-error hidden></p></div>',
    '<div class="kd3d-form kd3d-editor"><div class="kd3d-editor-head"><h3>Параметры забора</h3><button type="button" data-collapse-params aria-expanded="true">Свернуть <span aria-hidden="true">⌃</span></button></div>',
    '<div class="kd3d-editor-content" data-editor-content>',
    '<details class="kd3d-section" data-section="type"><summary><span>Тип забора</span><small data-type-name>Евроштакетник</small></summary><div class="kd3d-section-inner">',
    '<label class="kd3d-select-label">Материал выбранной стороны<select data-field="fill"><option value="picket">Штакетник · вертикальный односторонний</option><option value="picket-double">Штакетник · вертикальный шахматка</option><option value="horizontal">Штакетник · горизонтальный односторонний</option><option value="horizontal-double">Штакетник · горизонтальный шахматка</option><option value="sheet">Профнастил С10 · объёмный</option><option value="jalousie">Жалюзи · схематично</option></select></label>',
    '<p class="kd3d-mini-note">Материал выбирается отдельно для каждой стороны участка.</p></div></details>',
    '<details class="kd3d-section" data-section="sizes" open><summary><span>Размеры и стороны</span></summary><div class="kd3d-section-inner">',
    '<div class="kd3d-subheading">Размеры участка</div><p class="kd3d-mini-note">Для замкнутого участка включи все четыре стороны. Сторона А — фасад.</p>',
    '<div class="kd3d-preset-heading">Быстрый выбор площади</div>',
    '<div class="kd3d-presets" data-presets>'+AREA_PRESETS.map(p=>'<button type="button" data-preset="'+p.x+'x'+p.z+'" aria-pressed="false"><strong>'+p.name+'</strong><small>'+p.x+'×'+p.z+' м</small></button>').join('')+'</div>',
    '<label class="kd3d-dim-switch" data-dim-switch><input type="checkbox" data-show-dimensions><span><strong>Отображать размеры</strong><small>Чистые расстояния между внутренними гранями столбов, мм</small></span></label>',
    '<div class="kd3d-sides-head"><strong>Стороны участка</strong><span class="kd3d-sides-count" data-active-side-count>1 из 4</span></div>',
    '<div class="kd3d-sides kd3d-side-list" data-sides role="group" aria-label="Стороны участка">'+SIDE_IDS.map(id=>
      '<div class="kd3d-side-entry" data-side-entry="'+id+'"><div class="kd3d-side-line"><label class="kd3d-side-checkbox"><input type="checkbox" data-side-toggle="'+id+'" aria-label="Включить сторону '+SIDE_NAMES[id]+'"><span aria-hidden="true"></span></label><button type="button" data-side="'+id+'" aria-pressed="false"><b>Сторона '+SIDE_NAMES[id]+' <small>('+SIDE_SUBTITLES[id]+')</small></b><span data-side-material="'+id+'">Штакетник</span></button></div>'+
      '<div class="kd3d-opening-actions" role="group" aria-label="Проёмы на стороне '+SIDE_NAMES[id]+'">'+
      '<button type="button" data-opening-side="'+id+'" data-opening-kind="gate" aria-pressed="false" aria-label="Добавить ворота на сторону '+SIDE_NAMES[id]+'" title="Ворота на стороне '+SIDE_NAMES[id]+'"><svg viewBox="0 0 28 22" aria-hidden="true"><path d="M2 20V4h24v16M14 4v16M4 7l8 3v8M24 7l-8 3v8" /></svg><small>Ворота</small></button>'+
      '<button type="button" data-opening-side="'+id+'" data-opening-kind="wicket" aria-pressed="false" aria-label="Добавить калитку на сторону '+SIDE_NAMES[id]+'" title="Калитка на стороне '+SIDE_NAMES[id]+'"><svg viewBox="0 0 28 22" aria-hidden="true"><path d="M6 20V2h16v18M9 5l10 3v12M17 13h1" /></svg><small>Калитка</small></button></div>'+
      '<label class="kd3d-side-inline-length"><span>Длина стороны</span><span class="kd3d-side-input-wrap"><input type="number" inputmode="decimal" min="1" max="60" step="0.1" data-side-length-input="'+id+'" aria-label="Длина стороны '+SIDE_NAMES[id]+', м"><small>м</small></span></label>'+
      '<div class="kd3d-side-quick" data-side-quick="'+id+'"><label>Материал стороны<select data-side-quick-fill="'+id+'" aria-label="Материал стороны '+SIDE_NAMES[id]+'">'+FILL_IDS.map(fill=>'<option value="'+fill+'">'+FILL_LABELS[fill]+'</option>').join('')+'</select></label><label>Высота, м<input type="number" min="0.8" max="3" step="0.1" inputmode="decimal" data-side-quick-height="'+id+'" aria-label="Высота стороны '+SIDE_NAMES[id]+'"></label><label>Цвет RAL<select data-side-quick-ral="'+id+'" aria-label="Цвет стороны '+SIDE_NAMES[id]+'">'+Object.keys(RAL).map(code=>'<option value="'+code+'">'+code+'</option>').join('')+'</select></label></div>'+
      '<div class="kd3d-side-products" data-side-products="'+id+'"></div>'+
      '<div class="kd3d-side-edit-slot" data-side-edit-slot="'+id+'"></div></div>').join('')+'</div>',
    '<div class="kd3d-side-current"><strong data-current-side-label>Настройка стороны А</strong><small data-current-side-status>Включена</small></div>',
    '<div class="kd3d-fields"><label data-height-label>Высота стороны А, м<input data-field="height" inputmode="decimal" type="number" min="0.8" max="3" step="0.1"></label>',
    '<label>Шаг столбов, м<input data-field="step" inputmode="decimal" type="number" min="1" max="3" step="0.1"></label></div>',
    '<label class="kd3d-select-label">Столбы · профильная труба<select data-field="postSize"><option value="60">60×60 мм</option><option value="80">80×80 мм</option><option value="100">100×100 мм</option></select></label>',
    '<div class="kd3d-post-layout" data-post-layout><div class="kd3d-subheading">Расположение столбов</div><div class="kd3d-post-options" role="group" aria-label="Расположение столбов"><button type="button" data-post-mode="visible" aria-pressed="true"><strong>Столбы видны</strong><small>Заполнение между столбами, без боковых щелей</small></button><button type="button" data-post-mode="behind" aria-pressed="false"><strong>Столбы сзади</strong><small>Сплошная линия забора перед столбами</small></button></div><p class="kd3d-post-note" data-post-note>Для выбранной стороны участка</p></div>',
    '<div class="kd3d-gate-editor" data-gate-editor><div class="kd3d-product-card kd3d-product-gate"><label class="kd3d-gate-toggle"><input type="checkbox" data-gate-enabled><span><strong data-gate-title>Распашные ворота</strong><small>Две створки в выбранном месте стороны</small></span></label>',
    '<div class="kd3d-gate-type" data-gate-type role="group" aria-label="Тип ворот"><button type="button" data-gate-mode="swing" aria-pressed="true">Распашные</button><button type="button" data-gate-mode="sliding" aria-pressed="false">Откатные</button></div>',
    '<div class="kd3d-gate-fields" data-gate-fields hidden><label>Ширина ворот, м<input type="number" data-gate-width inputmode="decimal" min="2" max="6" step="0.1"></label><label>Отступ слева, м<input type="number" data-gate-offset inputmode="decimal" min="0" max="60" step="0.1"></label><label class="kd3d-direction-field" data-gate-swing-direction>Куда открываются ворота<select data-gate-open-direction><option value="inward">Внутрь участка</option><option value="outward">Наружу участка</option></select></label><div class="kd3d-sliding-fields" data-gate-sliding-fields hidden><label>Направление отката<select data-gate-slide-direction><option value="left">Влево по стороне</option><option value="right">Вправо по стороне</option></select></label><label>Форма хвостовика<select data-gate-tail-shape><option value="square">Квадратный</option><option value="triangle">Треугольный</option></select></label><label class="kd3d-inner-frame"><input type="checkbox" data-gate-center-post> Стойка по центру полотна</label><div class="kd3d-slide-position"><strong>Положение ворот в 3D</strong><div role="group" aria-label="Положение откатных ворот"><button type="button" data-gate-slide-position="closed" aria-pressed="true">Закрыто</button><button type="button" data-gate-slide-position="open" aria-pressed="false">Открыто</button></div></div><label class="kd3d-inner-frame kd3d-slide-show-zone"><input type="checkbox" data-gate-show-slide-zone checked> Показывать зону отката в 3D</label><p class="kd3d-slide-geometry" data-gate-slide-geometry></p><p class="kd3d-slide-zone-status" data-gate-zone-status></p></div><label>Профиль каркаса<select data-gate-frame-profile><option value="40x25">40×25 мм</option><option value="40x40">40×40 мм</option><option value="60x40">60×40 мм</option></select></label><label>Обшивка створок<select data-gate-fill><option value="side">Как на стороне забора</option>'+FILL_IDS.map(fill=>'<option value="'+fill+'">'+FILL_LABELS[fill]+'</option>').join('')+'</select></label><label class="kd3d-inner-frame"><input type="checkbox" data-gate-inner-frame> Внутренняя перемычка</label><button type="button" class="kd3d-drawing-action" data-drawing-kind="gate">Чертёж: ворота <span data-drawing-side></span></button></div>',
    '<div class="kd3d-built-in" data-builtin-area hidden><label class="kd3d-gate-toggle"><input type="checkbox" data-builtin-enabled><span><strong>Встроенная калитка в воротах</strong><small>Внутри створки, с переступаемым порогом · без отдельного столба</small></span></label>',
    '<div class="kd3d-gate-fields" data-builtin-fields hidden><label>Расположение<select data-builtin-side><option value="left">В левой створке</option><option value="right">В правой створке</option></select></label><label>Ширина калитки, м<input type="number" data-builtin-width inputmode="decimal" min="0.7" max="1.2" step="0.1"></label></div>',
    '<p class="kd3d-builtin-warning" data-builtin-warning hidden></p></div>',
    '</div><div class="kd3d-product-card kd3d-product-wicket"><label class="kd3d-gate-toggle"><input type="checkbox" data-wicket-enabled><span><strong data-wicket-title>Калитка</strong><small>Отдельная одностворчатая калитка</small></span></label>',
    '<div class="kd3d-gate-fields" data-wicket-fields hidden><label>Ширина калитки, м<input type="number" data-wicket-width inputmode="decimal" min="0.7" max="1.5" step="0.1"></label><label>Отступ от начала стороны, м<input type="number" data-wicket-offset inputmode="decimal" min="0" max="60" step="0.1"></label><label>Куда открывается калитка<select data-wicket-open-direction><option value="inward">Внутрь участка</option><option value="outward">Наружу участка</option></select></label><label>Открывание влево / вправо<select data-wicket-hinge-side><option value="left">Влево · петли слева</option><option value="right">Вправо · петли справа</option></select></label><label>Профиль каркаса<select data-wicket-frame-profile><option value="40x25">40×25 мм</option><option value="40x40">40×40 мм</option><option value="60x40">60×40 мм</option></select></label><label>Обшивка створки<select data-wicket-fill><option value="side">Как на стороне забора</option>'+FILL_IDS.map(fill=>'<option value="'+fill+'">'+FILL_LABELS[fill]+'</option>').join('')+'</select></label><label class="kd3d-inner-frame"><input type="checkbox" data-wicket-inner-frame> Внутренняя перемычка</label><button type="button" class="kd3d-drawing-action" data-drawing-kind="wicket">Чертёж: калитка <span data-drawing-side></span></button></div>',
    '</div><p class="kd3d-gate-note" data-gate-note>Выберите ворота, калитку или оба изделия на любой стороне участка.</p><p class="kd3d-direction-note">В 3D створки приоткрыты на 30° для показа направления. Лево/право калитки — по расположению петель вдоль выбранной стороны. Свободная зона открывания пока не проверяется.</p></div>',
    '<p class="kd3d-side-warning" data-site-warning hidden></p></div></details>',
    '<details class="kd3d-section" data-section="fill" open><summary><span>Заполнение и цвет</span></summary><div class="kd3d-section-inner">',
    '<div class="kd3d-subheading">Цвет забора · RAL</div>',
    '<div class="kd3d-color-scope" role="group" aria-label="Куда применить цвет"><button type="button" data-color-scope="all">Весь забор</button><button type="button" data-color-scope="side">Сторона <span data-color-side-name>А</span></button></div>',
    '<p data-color-status class="kd3d-color-status"></p>',
    '<div class="kd3d-ral-swatches" data-ral-swatches role="group" aria-label="Выбор цвета RAL"></div>',
    '<label class="kd3d-ral-select">Точный код цвета<select data-field="ral">'+Object.keys(RAL).map(code=>'<option value="'+code+'">'+code+' · '+RAL_LABELS[code]+'</option>').join('')+'</select></label>',
    '<div class="kd3d-picket-settings" data-picket-settings>',
    '<div class="kd3d-subheading">Евроштакетник 120 мм</div>',
    '<div class="kd3d-orientation" role="group" aria-label="Направление штакетника"><button type="button" data-orientation="vertical" aria-pressed="true">Вертикально</button><button type="button" data-orientation="horizontal" aria-pressed="false">Горизонтально</button></div>',
    '<label class="kd3d-gap-title">Зазор между планками <span data-gap-value>5 см</span></label>',
    '<div class="kd3d-gap-row"><input type="range" min="0" max="12" step="0.01" data-gap-slider aria-label="Зазор между штакетинами"><input data-field="gap" inputmode="decimal" type="number" min="0" max="12" step="0.01" aria-label="Зазор, см"><span>см</span></div>',
    '<div class="kd3d-gap-alert" data-gap-alert hidden><p data-gap-message></p><button type="button" data-auto-gap>Уменьшить зазор без подрезки</button></div>',
    '<label class="kd3d-check-row"><input type="checkbox" data-double-row><span><strong>Шахматный порядок</strong><small>Штакетник с двух сторон</small></span></label>',
    '</div><p class="kd3d-color-note">Оттенки на экране приблизительные; точный цвет выбирается по образцу RAL.</p></div></details>',
    '<div class="kd3d-stats" data-stats></div>',
    '<div class="kd3d-hint">3D показывает распашные и откатные ворота для согласования. Расчёт стоимости и доставки пока не подключён.</div>',
    '<button type="button" data-reset class="kd3d-reset">↶ Сбросить параметры</button>',
    '</div></div>',
    '<dialog class="kd3d-drawing-dialog" data-drawing-dialog aria-label="Эскиз ворот или калитки"><div class="kd3d-drawing-header"><strong data-drawing-title>Эскиз</strong><button type="button" data-drawing-close aria-label="Закрыть">✕</button></div><div class="kd3d-drawing-preview" data-drawing-preview></div><p>Предварительный эскиз для согласования. Не использовать вместо производственного чертежа или карты раскроя.</p><button type="button" class="kd3d-drawing-download" data-drawing-download>Сохранить SVG</button></dialog>'
  ].join('');
  // Each side owns a stable pair of product cards. Switching to another side
  // never moves, destroys or overwrites its gate, wicket, or drawing controls.
  const productTemplate=root.querySelector('[data-gate-editor]');
  if(!productTemplate)throw new Error('Не найден шаблон изделий 3D');
  for(const id of SIDE_IDS){
    const slot=root.querySelector('[data-side-products="'+id+'"]');
    const editor=productTemplate.cloneNode(true);
    editor.dataset.productSide=id;
    slot.appendChild(editor);
  }
  productTemplate.remove();
  // Advanced fence settings are side-specific and follow the selected side.
  // Common parameters (post profile and picket gap) remain shared deliberately.
  const inlineEditor=document.createElement('div');
  inlineEditor.className='kd3d-side-inline-editor';
  const extraToggle=document.createElement('button');
  extraToggle.type='button';
  extraToggle.className='kd3d-extra-toggle';
  extraToggle.textContent='Дополнительные настройки стороны ▾';
  extraToggle.setAttribute('aria-expanded','false');
  const extraContent=document.createElement('div');
  extraContent.className='kd3d-side-extra-content';
  extraContent.hidden=true;
  inlineEditor.append(extraToggle,extraContent);
  extraToggle.addEventListener('click',()=>{
    extraContent.hidden=!extraContent.hidden;
    extraToggle.setAttribute('aria-expanded',String(!extraContent.hidden));
    extraToggle.textContent=extraContent.hidden?
      'Дополнительные настройки стороны ▾':'Скрыть дополнительные настройки ▴';
  });
  const inlineParts=[
    root.querySelector('[data-section="type"]'),
    root.querySelector('.kd3d-side-current'),
    root.querySelector('.kd3d-fields'),
    root.querySelector('[data-field="postSize"]').closest('label'),
    root.querySelector('[data-post-layout]'),
    root.querySelector('[data-section="fill"]')
  ];
  inlineParts.forEach(part=>{
    if(!part)throw new Error('Не найдена секция редактора стороны 3D');
    extraContent.appendChild(part);
  });
  // Plot problems must be visible even when advanced settings are collapsed.
  const siteWarning=root.querySelector('[data-site-warning]');
  if(siteWarning)inlineEditor.appendChild(siteWarning);
  function placeInlineEditor(){
    const slot=root.querySelector('[data-side-edit-slot="'+config.activeSide+'"]');
    if(!slot)return;
    if(inlineEditor.parentElement!==slot)slot.appendChild(inlineEditor);
    root.querySelectorAll('[data-side-edit-slot]').forEach(el=>{el.hidden=el!==slot;});
  }
  placeInlineEditor();
  const find = selector => root.querySelector(selector);
  const productField=(id,selector)=>
    root.querySelector('[data-side-products="'+id+'"] '+selector);
  function isPicketFill(fill){return ['picket','picket-double','horizontal','horizontal-double'].includes(fill);}
  function syncPicketSettings(){
    const fill=activeSettings().fill;
    find('[data-picket-settings]').hidden=!isPicketFill(fill);
    root.querySelectorAll('[data-orientation]').forEach(button=>{
      const value=fill.startsWith('horizontal')?'horizontal':'vertical';
      button.setAttribute('aria-pressed',String(button.dataset.orientation===value));
      button.classList.toggle('active',button.dataset.orientation===value);
    });
    find('[data-double-row]').checked=fill==='picket-double'||fill==='horizontal-double';
    find('[data-gap-slider]').value=config.gap*100;
    find('[data-gap-value]').textContent=(config.gap*100).toFixed(1).replace(/\.0$/,'').replace('.',',')+' см';
    find('[data-type-name]').textContent=fill==='sheet'?'Профнастил':fill==='jalousie'?'Жалюзи':'Евроштакетник';
  }
  function syncSideInputs(){
    placeInlineEditor();
    const selected=activeSettings();
    for(const key of ['height','step','fill','ral'])
      find('[data-field="'+key+'"]').value=selected[key];
    find('[data-field="postSize"]').value=config.postSize;
    find('[data-field="gap"]').value=Number((config.gap*100).toFixed(1));
    syncPicketSettings();
    syncPostMode();
    syncGateInputs();
    find('[data-show-dimensions]').checked=config.showDimensions;
    syncColorScope();
    syncSwatches();
  }
  function syncSideButtons(){
    SIDE_IDS.forEach(id=>{
      const selected=id===config.activeSide, enabled=config.sides[id].enabled;
      const button=find('[data-side="'+id+'"]');
      const toggle=find('[data-side-toggle="'+id+'"]');
      button.setAttribute('aria-pressed',String(selected));
      toggle.checked=enabled;
      toggle.setAttribute('aria-label',(enabled?'Выключить':'Включить')+' сторону '+SIDE_NAMES[id]);
      button.setAttribute('aria-label','Настроить сторону '+SIDE_NAMES[id]);
      find('[data-side-entry="'+id+'"]').classList.toggle('selected',selected);
      find('[data-side-entry="'+id+'"]').classList.toggle('enabled',enabled);
      find('[data-side-length-input="'+id+'"]').value=config.sides[id].length;
      find('[data-side-material="'+id+'"]').textContent=FILL_LABELS[config.sides[id].fill];
      find('[data-side-quick-fill="'+id+'"]').value=config.sides[id].fill;
      find('[data-side-quick-height="'+id+'"]').value=config.sides[id].height;
      find('[data-side-quick-ral="'+id+'"]').value=config.sides[id].ral;
    root.querySelectorAll('[data-opening-side="'+id+'"]').forEach(button=>{
      const active=config.openings[id][button.dataset.openingKind].enabled;
      button.setAttribute('aria-pressed',String(active));
      button.classList.toggle('active',active);
    });
    });
    find('[data-active-side-count]').textContent=SIDE_IDS.filter(id=>config.sides[id].enabled).length+' из 4';
    find('[data-current-side-label]').textContent='Настройка стороны '+SIDE_NAMES[config.activeSide];
    const status=find('[data-current-side-status]');
    status.textContent=activeSettings().enabled?'Включена':'Выключена';
    status.classList.toggle('is-off',!activeSettings().enabled);
    find('[data-height-label]').firstChild.textContent='Высота стороны '+SIDE_NAMES[config.activeSide]+', м';
    for(const preset of AREA_PRESETS){
      const match=SIDE_IDS.every(id=>config.sides[id].enabled)&&
        Math.abs(config.sides.A.length-preset.x)<.001&&Math.abs(config.sides.V.length-preset.x)<.001&&
        Math.abs(config.sides.B.length-preset.z)<.001&&Math.abs(config.sides.G.length-preset.z)<.001;
      find('[data-preset="'+preset.x+'x'+preset.z+'"]').setAttribute('aria-pressed',String(match));
    }
    syncPicketSettings();
  }
  function syncGateInputs(){
    config.openings=normalizeOpenings(config.sides,config.openings,config.gate);
    config.gate=config.openings.A.gate; // Backward-compatible facade draft.
    const sideLayout=getSiteLayout(config.sides,config.openings);
    for(const id of SIDE_IDS){
      const {gate,wicket}=config.openings[id];
      const get=selector=>productField(id,selector);
      get('[data-gate-title]').textContent=(gate.type==='sliding'?'Откатные ворота':'Распашные ворота')+
        ' · сторона '+SIDE_NAMES[id];
      get('[data-gate-type]').hidden=!gate.enabled;
      get('[data-gate-mode="swing"]').setAttribute('aria-pressed',String(gate.type!=='sliding'));
      get('[data-gate-mode="sliding"]').setAttribute('aria-pressed',String(gate.type==='sliding'));
      get('[data-wicket-title]').textContent='Калитка · сторона '+SIDE_NAMES[id];
      get('[data-gate-enabled]').checked=gate.enabled;
      get('[data-gate-fields]').hidden=!gate.enabled;
      get('[data-gate-width]').value=gate.width;
      get('[data-gate-width]').max=gate.type==='sliding'?5:6;
      get('[data-gate-offset]').value=gate.offset;
      get('[data-gate-offset]').max=Math.max(0,config.sides[id].length-gate.width);
      get('[data-gate-swing-direction]').hidden=gate.type==='sliding';
      get('[data-gate-sliding-fields]').hidden=gate.type!=='sliding';
      get('[data-gate-open-direction]').value=gate.openDirection;
      get('[data-gate-slide-direction]').value=gate.slideDirection;
      get('[data-gate-tail-shape]').value=gate.tailShape;
      get('[data-gate-center-post]').checked=gate.centerPost;
      get('[data-gate-show-slide-zone]').checked=gate.showSlideZone;
      get('[data-gate-slide-position="closed"]').setAttribute('aria-pressed',String(!gate.slideOpen));
      get('[data-gate-slide-position="open"]').setAttribute('aria-pressed',String(gate.slideOpen));
      if(gate.type==='sliding'){
        const edge=sideLayout.edges.find(e=>e.id===id);
        const opening=edge?.gate||{...gate,start:gate.offset};
        const travel=getSlidingTravelPlan(opening,config.sides[id].length,
          edge?.openings||[],config.postSize/1000,config.sides[id].height);
        const format=v=>v.toFixed(2).replace('.',',');
        get('[data-gate-slide-geometry]').textContent='Хвостовик '+format(travel.tail)+
          ' м · балка '+travel.beam+' м · полотно '+format(travel.gateLength)+' м.';
        const status=get('[data-gate-zone-status]');
        status.textContent='Для полного открытия нужно '+format(travel.required)+
          ' м вдоль забора. Доступно '+format(travel.available)+' м.'+
          (travel.shortage>.0001?' Не хватает '+format(travel.shortage)+' м.':'')+
          (travel.wicketCollisions.length?' Зона отката пересекает калитку.':'')+
          (travel.showZone?' Цветная полоса видна в 3D.':' Зона скрыта в 3D.');
        status.classList.toggle('is-warning',!travel.valid);
      }
      get('[data-gate-frame-profile]').value=gate.frameProfile;
      get('[data-gate-fill]').value=gate.fill;
      get('[data-gate-inner-frame]').checked=gate.innerFrame;
      get('[data-builtin-area]').hidden=!gate.enabled||gate.type==='sliding';
      get('[data-builtin-enabled]').checked=gate.builtInWicket;
      get('[data-builtin-fields]').hidden=!gate.enabled||gate.type==='sliding'||!gate.builtInWicket;
      get('[data-builtin-side]').value=gate.builtInSide;
      get('[data-builtin-width]').value=gate.builtInWidth;
      const geometry=gate.type==='sliding'?null:
        getGateFramePlan({kind:'gate',...gate},config.postSize/1000,config.sides[id].height);
      const warning=get('[data-builtin-warning]');
      warning.hidden=!gate.enabled||gate.type==='sliding'||!gate.builtInWicket||!geometry?.embeddedWarning;
      warning.textContent=geometry?.embeddedWarning||'';
      get('[data-wicket-enabled]').checked=wicket.enabled;
      get('[data-wicket-fields]').hidden=!wicket.enabled;
      get('[data-wicket-width]').value=wicket.width;
      get('[data-wicket-offset]').value=wicket.offset;
      get('[data-wicket-offset]').max=Math.max(0,config.sides[id].length-wicket.width);
      get('[data-wicket-open-direction]').value=wicket.openDirection;
      get('[data-wicket-hinge-side]').value=wicket.hingeSide;
      get('[data-wicket-frame-profile]').value=wicket.frameProfile;
      get('[data-wicket-fill]').value=wicket.fill;
      get('[data-wicket-inner-frame]').checked=wicket.innerFrame;
      get('.kd3d-product-gate').hidden=!gate.enabled;
      get('.kd3d-product-wicket').hidden=!wicket.enabled;
      const zone=find('[data-side-products="'+id+'"]');
      zone.hidden=!gate.enabled&&!wicket.enabled;
      zone.querySelectorAll('[data-drawing-side]').forEach(el=>{
        el.textContent=SIDE_NAMES[id];
      });
      get('[data-gate-note]').textContent=!config.sides[id].enabled?
        'Сторона выключена. Включите её, чтобы отобразить проёмы в 3D.':
        gate.enabled&&wicket.enabled?
          'На этой стороне есть ворота и калитка. Проёмы не пересекаются; общий столб учитывается один раз.':
          'Отступ измеряется от начала стороны '+SIDE_NAMES[id]+'.';
    }
  }
  function syncPostMode(){
    const side=activeSettings();
    side.postMode=normalizePostMode(side.fill,side.postMode);
    const horizontal=isHorizontalFill(side.fill);
    const wrap=find('[data-post-layout]');
    wrap.classList.toggle('horizontal-only',horizontal);
    const note=find('[data-post-note]');
    note.textContent=horizontal
      ? 'Для горизонтального евроштакетника столбы только видимые.'
      : side.enabled
        ? 'Расположение столбов меняется на выбранной стороне '+SIDE_NAMES[config.activeSide]+'.'
        : 'Сторона выключена: включите её в разделе «Стороны участка».';
    root.querySelectorAll('[data-post-mode]').forEach(button=>{
      const behind=button.dataset.postMode==='behind';
      const selected=button.dataset.postMode===side.postMode;
      button.setAttribute('aria-pressed',String(selected));
      button.classList.toggle('active',selected);
      button.disabled=horizontal&&behind;
    });
  }
  function syncColorScope(){
    root.querySelectorAll('[data-color-scope]').forEach(button=>{
      const active=button.dataset.colorScope===config.colorScope;
      button.setAttribute('aria-pressed',String(active));
      button.classList.toggle('active',active);
    });
    find('[data-color-side-name]').textContent=SIDE_NAMES[config.activeSide];
    const status=find('[data-color-status]');
    status.textContent=config.colorScope==='all'
      ? 'Новый цвет перекрасит все стороны участка.'
      : activeSettings().enabled
        ? 'Изменится только сторона '+SIDE_NAMES[config.activeSide]+' в 3D.'
        : 'Сторона '+SIDE_NAMES[config.activeSide]+' выключена и не видна в 3D.';
    status.classList.toggle('is-warning',config.colorScope==='side'&&!activeSettings().enabled);
  }
  function applyFenceColor(ral){
    if(!Object.hasOwn(RAL,ral))return;
    if(config.colorScope==='all')SIDE_IDS.forEach(id=>{config.sides[id].ral=ral;});
    else activeSettings().ral=ral;
    find('[data-field="ral"]').value=activeSettings().ral;
    updateModel();
    syncSwatches();
    syncColorScope();
  }
  const swatches=find('[data-ral-swatches]');
  swatches.innerHTML=Object.entries(RAL).map(([code,hex])=>
    '<button type="button" data-ral-swatch="'+code+'" style="--kd3d-swatch:'+hex+'" aria-label="RAL '+code+' '+RAL_LABELS[code]+'"><span class="kd3d-swatch-color"></span><small>'+code+'</small></button>').join('');
  function syncSwatches() {
    swatches.querySelectorAll('[data-ral-swatch]').forEach(button=>{
      const selected=button.dataset.ralSwatch===activeSettings().ral;
      button.classList.toggle('active',selected);
      button.setAttribute('aria-pressed',String(selected));
    });
  }
  swatches.addEventListener('click',event=>{
    const button=event.target.closest('[data-ral-swatch]');
    if(!button || !Object.hasOwn(RAL,button.dataset.ralSwatch))return;
    applyFenceColor(button.dataset.ralSwatch);
  });
  root.querySelectorAll('[data-color-scope]').forEach(button=>button.addEventListener('click',()=>{
    config.colorScope=button.dataset.colorScope;
    syncColorScope();
    saveDraft(config);
  }));
  syncSideInputs();
  syncSideButtons();
  const sceneHost = find('[data-scene]');
  const parts = find('[data-parts]');
  const stats = find('[data-stats]');
  const error = find('[data-error]');
  let renderer, camera, scene, controls, fence, grid, base;
  let previousMaterials = [];
  let previousLineGeometries = [];
  let previousDimensionTextures = [];
  let sharedDimensionLabelMaterials = new Map();
  let webglOk = false;
  try {
    renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false, powerPreference:'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0xe8eaeb);
    // Use a controlled neutral studio setup so RAL colours do not wash out on mobile.
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.05;
    sceneHost.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe8eaeb);
    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minDistance = 2;
    controls.maxDistance = 100;
    const light = new THREE.DirectionalLight(0xfff5e8, 1.9);
    light.position.set(10, 20, 10);
    scene.add(light);
    scene.add(new THREE.HemisphereLight(0xffffff,0x9ba4a9,0.9));
    const fillLight=new THREE.DirectionalLight(0xe2edff,0.55);
    fillLight.position.set(-5,8,-12);
    scene.add(fillLight);
    grid = new THREE.GridHelper(140, 140, 0xc4ced2, 0xd4dcde);
    grid.position.y = -0.025;
    scene.add(grid);
    fence = new THREE.Group();
    scene.add(fence);
    base = new THREE.BoxGeometry(1, 1, 1);
    webglOk = true;
  } catch (e) {
    error.hidden = false;
    error.textContent = 'На этом устройстве 3D недоступно. Параметры и комплектация продолжают работать.';
    console.warn('KD surveyor 3D WebGL unavailable:', e);
  }
  const FILL_NAMES={
    picket:'Евроштакетник вертикальный, один ряд',
    'picket-double':'Евроштакетник вертикальный, шахматка',
    horizontal:'Евроштакетник горизонтальный, один ряд',
    'horizontal-double':'Евроштакетник горизонтальный, шахматка',
    sheet:'Профнастил С10',jalousie:'Жалюзи (схематично)'
  };
  const formatGapCm=metres=>(metres*100).toFixed(2).replace(/0$/,'').replace('.',',');
  function getVerticalGapPlans(layout){
    return layout.edges.filter(edge=>edge.side.fill==='picket'||edge.side.fill==='picket-double')
      .flatMap(edge=>edge.sections.map(section=>{
        const behind=edge.side.postMode==='behind';
        const width=Math.max(.025,section.span-(behind?0:config.postSize/1000));
        return {id:edge.id,
          requested:verticalPicketPlan(width,config.gap,false),
          // The 3D preview must never leave avoidable post-side voids.
          // Render the no-cut fit immediately, even before user confirmation.
          plan:verticalPicketPlan(width,config.gap,true)
        };
      }));
  }
  function syncGapWarning(plans){
    const alert=find('[data-gap-alert]');
    const message=find('[data-gap-message]');
    const button=find('[data-auto-gap]');
    if(!plans.length){alert.hidden=true;return;}
    const impossible=plans.filter(x=>x.plan.edgeMargin>.0001);
    const altered=plans.filter(x=>x.plan.adjusted);
    if(!impossible.length&&!altered.length){alert.hidden=true;return;}
    alert.hidden=false;
    const targetList=plans.map(x=>SIDE_NAMES[x.id]+': '+formatGapCm(x.plan.gapUsed)+' см');
    if(impossible.length){
      const sides=impossible.map(x=>SIDE_NAMES[x.id]).join(', ');
      const largest=Math.max(...impossible.map(x=>x.plan.edgeMargin));
      message.textContent='Внимание: сторона '+sides+' — остаётся '+formatGapCm(largest)+
        ' см у каждого столба. Целая дополнительная штакетина 120 мм не помещается; одним уменьшением зазора закрыть пролёт нельзя. Измените длину пролёта или шаг столбов. Штакетник не подрезаем.';
      button.hidden=true;alert.classList.remove('is-fitted');return;
    }
    if(config.gapFit){
      message.textContent='Без подрезки. Фактические зазоры в 3D: '+targetList.join('; ')+
        '. Крайние планки прилегают к столбам, ширина каждой 120 мм.';
      button.hidden=true;alert.classList.add('is-fitted');
    }else{
      const margin=Math.max(...altered.map(x=>x.requested.edgeMargin));
      message.textContent='При выбранном зазоре оставались бы щели у столбов до '+
        formatGapCm(margin)+' см. Штакетник 120 мм не подрезаем. 3D уже показывает целые планки вплотную к столбам: '+
        targetList.join('; ')+'. Подтвердите уменьшение зазора кнопкой.';
      button.hidden=false;alert.classList.remove('is-fitted');
    }
  }
  function summary() {
    const layout=getSiteLayout(config.sides,config.openings);
    const gapPlans=getVerticalGapPlans(layout);
    for(const opening of layout.openings){
      if(opening.kind!=='gate'||opening.type==='sliding'||!opening.builtInWicket)continue;
      const side=config.sides[opening.sideId];
      const framePlan=getGateFramePlan(opening,config.postSize/1000,side.height);
      if(framePlan.embeddedWarning)
        layout.warnings.push('Сторона '+SIDE_NAMES[opening.sideId]+': '+framePlan.embeddedWarning);
    }
    syncGapWarning(gapPlans);
    const format=value=>value.toFixed(1).replace('.',',');
    const format2=value=>value.toFixed(2).replace('.',',');
    const dimensions=getClearDimensionPlan(layout,config.postSize);
    const warning=find('[data-site-warning]');
    warning.hidden=!layout.warnings.length;
    warning.textContent=layout.warnings.join(' ');
    stats.innerHTML=
      '<div><small>Забор, м</small><b>'+format(layout.fenceLength)+'</b></div>'+
      '<div><small>Пролётов</small><b>'+layout.totalSpans+'</b></div>'+
      '<div><small>Столбов</small><b>'+layout.posts.length+'</b></div>';
    let description='<h3>Комплектация · геометрия участка</h3>';
    if(!layout.edges.length) description+='<p>Включите хотя бы одну сторону участка.</p>';
    for(const edge of layout.edges){
      description+='<p><b>Сторона '+SIDE_NAMES[edge.id]+': '+format(edge.side.length)+' м</b> · высота '+
        format(edge.side.height)+' м · пролётов '+edge.count+
        (edge.openings.length?' (проёмов '+edge.openings.length+')':' (по '+format2(edge.span)+' м)')+'.<br>'+
        FILL_NAMES[edge.side.fill]+' · RAL '+edge.side.ral+' · '+(edge.side.postMode==='behind'?'столбы сзади':'столбы видны')+
        (edge.side.fill==='sheet'?'':(edge.side.fill==='picket'||edge.side.fill==='picket-double')
          ?' · фактический зазор '+formatGapCm(gapPlans.find(x=>x.id===edge.id)?.plan.gapUsed??config.gap)+' см'+
            (gapPlans.find(x=>x.id===edge.id)?.plan.adjusted?(config.gapFit?' (подогнан без подрезки)':' (предпросмотр подгонки)'):' (без подрезки)'):
          ' · зазор '+format(config.gap*100)+' см')+'.</p>';
    }
    for(const opening of layout.openings){
      if(opening.kind==='gate'&&opening.type==='sliding'){
        const plan=getSlidingGatePlan(opening,config.postSize/1000,
          config.sides[opening.sideId].height);
        const sideEdge=layout.edges.find(e=>e.id===opening.sideId);
        const travel=getSlidingTravelPlan(opening,sideEdge.side.length,
          sideEdge.openings,config.postSize/1000,sideEdge.side.height);
        description+='<p><b>Откатные ворота на стороне '+SIDE_NAMES[opening.sideId]+
          ':</b> проём '+format(opening.width)+' м, отступ '+format(opening.start)+
          ' м. Откат '+(plan.direction==='left'?'влево':'вправо')+
          ' · хвостовик '+(plan.tailShape==='square'?'квадратный':'треугольный')+
          ' '+format2(plan.tail)+' м · балка '+plan.beam+' м · полотно '+
          format2(plan.gateLength)+' м ·'+(plan.centerPost?' со средней стойкой':' без средней стойки')+
          ' · рама '+opening.frameProfile.replace('x','×')+
          (opening.fill!=='side'?' · заполнение '+FILL_LABELS[opening.fill]:' · заполнение как на заборе')+
          '. Положение: '+(travel.isOpen?'открыто':'закрыто')+
          ' · для отката требуется '+format2(travel.required)+' м, доступно '+
          format2(travel.available)+' м'+
          (travel.shortage>.0001?' (не хватает '+format2(travel.shortage)+' м)':'')+
          (travel.wicketCollisions.length?' · пересечение с калиткой':'')+
          '. Визуальная модель, без расчёта цены и проверки прочности.</p>';
        continue;
      }
      description+='<p><b>'+(opening.kind==='gate'?'Распашные ворота':'Калитка')+
        ' на стороне '+SIDE_NAMES[opening.sideId]+':</b> проём '+format(opening.width)+
        ' м, отступ слева '+format(opening.start)+' м. '+
        (opening.kind==='gate'?'Две створки':'Одна створка')+
        ' · открывание '+(opening.openDirection==='outward'?'наружу':'внутрь')+' участка'+
        (opening.kind==='wicket'?' · '+(opening.hingeSide==='right'?'вправо, петли справа':'влево, петли слева'):'')+
        (opening.kind==='gate'&&opening.builtInWicket?
          ' · встроенная калитка '+opening.builtInWidth.toFixed(1).replace('.',',')+
          ' м в '+(opening.builtInSide==='left'?'левой':'правой')+' створке':'')+
        ' в 3D: рама '+opening.frameProfile.replace('x','×')+
        (opening.innerFrame?', средняя перемычка 40×20':'')+
        (opening.fill!=='side'?', обшивка '+FILL_LABELS[opening.fill]:'')+', '+
        (opening.kind==='gate'?'4':'2')+' петли; зазор до столбов 15 мм'+
        (opening.kind==='gate'?', между створками 20 мм':'')+
        '. Визуальная модель, без цены и прочностного расчёта.</p>';
    }
    if(config.showDimensions){
      description+='<p><b>Размеры в свету (между гранями столбов):</b></p>';
      for(const dimension of dimensions){
        const measures=dimension.spans.map(piece=>
          (piece.kind==='gate'?'Ворота: ':piece.kind==='wicket'?'Калитка: ':'Пролёт '+piece.index+': ')+piece.clearMm+' мм'
        );
        description+='<p>Сторона '+SIDE_NAMES[dimension.id]+': '+(measures.length?measures.join(' · '):'пролётов нет')+'</p>';
      }
    }
    description+='<p>Периметр активных сторон: <b>'+format(layout.perimeter)+' м</b>. '+
      'Пролётов: <b>'+layout.totalSpans+'</b>; металлических столбов: <b>'+
      layout.posts.length+'</b> ('+config.postSize+'×'+config.postSize+' мм). Угловые столбы не дублируются.</p>';
    if(layout.warnings.length) description+='<p class="kd3d-unpriced">'+layout.warnings.join(' ')+'</p>';
    description+='<p class="kd3d-unpriced">Схема и количество столбов предварительные. '+
      'Без производственного раскроя, прочностной проверки и расчёта стоимости.</p>';
    parts.innerHTML=description;
    find('[data-slide-legend]').hidden=Boolean(sceneHost.hidden)||
      !layout.openings.some(o=>o.type==='sliding'&&o.showSlideZone);
    syncSideButtons();
    return layout;
  }
  function clearGeometry() {
    if (!fence) return;
    fence.clear();
    previousMaterials.forEach(m => m.dispose());
    previousLineGeometries.forEach(g => g.dispose());
    previousDimensionTextures.forEach(texture=>texture.dispose());
    previousDimensionTextures=[];
    sharedDimensionLabelMaterials.clear();
    previousMaterials = [];
    previousLineGeometries = [];
  }
  // Dimension graphics stay at ground level and offset from the fence.
  // Labels are billboarded so they remain readable from any camera angle.
  // All measurements originate from the face-to-face planner (not axes).
  function drawDimensionGuides(group,dimension,length,id){
    if(!dimension)return;
    const baselineZ=(id==='A'?1:-1)*.75;
    const sign=Math.sign(baselineZ);
    const y=.055;
    const coords=[];
    function segment(x1,z1,x2,z2){
      coords.push(x1,y,z1,x2,y,z2);
    }
    function label(text,x,z,width=1.12){
      // Share one GPU texture per identical label rather than one per bay.
      let material=sharedDimensionLabelMaterials.get(text);
      if(!material){
        const canvas=document.createElement('canvas');
        canvas.width=512;canvas.height=128;
        const ctx=canvas.getContext('2d');
        if(!ctx)return;
        ctx.fillStyle='rgba(255,255,255,.93)';
        ctx.beginPath();
        ctx.roundRect(8,8,496,112,18);
        ctx.fill();
        ctx.strokeStyle='rgba(65,75,85,.36)';
        ctx.lineWidth=3;ctx.stroke();
        ctx.fillStyle='#202932';
        ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.font='bold 48px Arial,sans-serif';
        ctx.fillText(text,256,66,480);
        const texture=new THREE.CanvasTexture(canvas);
        texture.colorSpace=THREE.SRGBColorSpace;
        texture.minFilter=THREE.LinearFilter;
        previousDimensionTextures.push(texture);
        material=new THREE.SpriteMaterial({map:texture,depthTest:false,transparent:true});
        previousMaterials.push(material);
        sharedDimensionLabelMaterials.set(text,material);
      }
      const sprite=new THREE.Sprite(material);
      sprite.position.set(x,.16,z);
      sprite.scale.set(width,width/4,1);
      sprite.renderOrder=20;
      sprite.userData.kdDimensionLabel=text;
      group.add(sprite);
    }
    for(const piece of dimension.spans){
      const left=-length/2+piece.from;
      const right=-length/2+piece.to;
      if(right-left<=.0005)continue;
      segment(left,baselineZ,right,baselineZ);
      for(const x of [left,right]){
        // Projection from the inner post face plus an architectural tick mark.
        segment(x,sign*.12,x,baselineZ+sign*.13);
        segment(x-.047,baselineZ-.047,x+.047,baselineZ+.047);
      }
      label(piece.clearMm+' мм',(left+right)/2,baselineZ+sign*.36,
        Math.max(.58,Math.min(1.38,(right-left)*.78)));
    }
    // Complete side length is distinct from the clear openings.
    const sideZ=baselineZ+sign*1.33;
    segment(-length/2,sideZ,length/2,sideZ);
    for(const x of [-length/2,length/2]){
      segment(x,sideZ-.11,x,sideZ+.11);
    }
    label(SIDE_NAMES[id]+': '+Number(length.toFixed(2)).toString().replace('.',',')+' м',
      0,sideZ+sign*.36,2.1);
    if(coords.length){
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
      previousLineGeometries.push(geo);
      const mat=new THREE.LineBasicMaterial({color:0x33404a,transparent:true,opacity:.83,
        depthTest:false});
      previousMaterials.push(mat);
      const lines=new THREE.LineSegments(geo,mat);
      lines.renderOrder=19;
      group.add(lines);
    }
  }
  function updateModel() {
    SIDE_IDS.forEach(id=>{
      const side=config.sides[id];
      side.postMode=normalizePostMode(side.fill,side.postMode);
    });
    const selected=activeSettings();
    // Legacy keys retained for older locally saved drafts and existing integrations.
    for(const key of ['length','height','step','fill','ral']) config[key]=selected[key];
    const preliminary=getSiteLayout(config.sides,config.openings);
    // A displaced wicket follows its actual collision-free 3D location.
    for(const opening of preliminary.openings)
      config.openings[opening.sideId][opening.kind].offset=opening.start;
    config.gate=config.openings.A.gate;
    const layout=summary();
    saveDraft(config);
    if(!webglOk)return;
    clearGeometry();
    const postWidth=config.postSize/1000;
    const clearDimensions=getClearDimensionPlan(layout,config.postSize);
    const postMats=new Map();
    const postMaterialFor=id=>{
      const code=config.sides[id]?.ral||config.sides.A.ral;
      if(!postMats.has(code)){
        const material=new THREE.MeshStandardMaterial({
          color:new THREE.Color(RAL[code]).multiplyScalar(.88),metalness:.19,roughness:.49
        });
        postMats.set(code,material);
        previousMaterials.push(material);
      }
      return postMats.get(code);
    };
    const capGeometry=buildPostCapGeometry(postWidth);
    previousLineGeometries.push(capGeometry);
    for(const p of layout.posts){
      const postMat=postMaterialFor(p.sides[0]);
      // Rear-only posts finish below the top of the infill: no caps stick out
      // above the continuous front elevation. Mixed corners retain visible caps.
      const rearOnly=!p.gateSupport && p.sides.length>0 && p.sides.every(id=>
        config.sides[id]?.postMode==='behind');
      const h=rearOnly?Math.max(.6,p.height-.12):p.height+.10;
      frameGeometry(fence,base,postWidth,h,postWidth,p.x,h/2,p.z,postMat);
      frameGeometry(fence,base,postWidth+.013,.012,postWidth+.013,p.x,h+.006,p.z,postMat);
      const cap=new THREE.Mesh(capGeometry,postMat);
      cap.position.set(p.x,h+.012,p.z);
      fence.add(cap);
    }
    const sceneFillColors=new Set();
    const renderedPostModes={};
    let renderedMaxEdgeClearance=0;
    for(const edge of layout.edges){
      const side=edge.side;
      const postMat=postMaterialFor(edge.id);
      const fillMat=new THREE.MeshStandardMaterial({
        color:RAL[side.ral],metalness:.22,roughness:.43,side:THREE.DoubleSide
      });
      previousMaterials.push(fillMat);
      sceneFillColors.add('#'+fillMat.color.getHexString());
      const group=new THREE.Group();
      const dx=edge.end.x-edge.start.x,dz=edge.end.z-edge.start.z;
      group.rotation.y=-Math.atan2(dz,dx);
      group.position.set((edge.start.x+edge.end.x)/2,0,(edge.start.z+edge.end.z)/2);
      fence.add(group);
      const start=-side.length/2;
      const behind=side.postMode==='behind'&&!isHorizontalFill(side.fill);
      // Visible posts: run right up to the two post faces.
      // Rear posts: the infill passes across the post centres in front of the steel.
      const frontZ=behind?.115:.005;
      const rearZ=behind?-.015:-.09;
      const supportZ=behind?.073:-.008;
      const railY=side.height>2.15?[.32,side.height/2,side.height-.32]:
        [.33,Math.max(.52,side.height-.33)];
      const frontPickets=[],rearPickets=[];
      let renderedEdgeClearance=0;
      for(const section of edge.sections){
      const actualSpan=section.span;
      const infillWidth=Math.max(.025,actualSpan-(behind?0:postWidth));
      const horizontalPickets=[],rearHorizontalPickets=[];
      for(let i=0;i<section.count;i++){
        const mid=start+section.from+(i+.5)*actualSpan;
        const width=infillWidth;
        if(side.fill==='sheet'){
          const geometry=buildC10Geometry(width,side.height-.12);
          previousLineGeometries.push(geometry);
          const panel=new THREE.Mesh(geometry,fillMat);
          panel.position.set(mid,.06,behind?.095:.015);
          panel.receiveShadow=true;
          group.add(panel);
          railY.forEach(y=>frameGeometry(group,base,width,.04,.02,mid,y,supportZ,postMat));
        }else if(side.fill==='jalousie'){
          const rows=Math.max(1,Math.floor((side.height-.12)/.14));
          for(let n=0;n<rows;n++)
            frameGeometry(group,base,width,.11,.026,mid,.13+n*.14,frontZ,fillMat);
        }else if(isHorizontalFill(side.fill)){
          // Horizontal pickets always terminate at visible post faces.
          const doubleRow=side.fill==='horizontal-double';
          guideOffsets(width).forEach(offset=>{
            frameGeometry(group,base,.04,side.height-.12,.02,mid+offset,side.height/2,-.008,postMat);
            if(doubleRow)
              frameGeometry(group,base,.04,side.height-.12,.02,mid+offset,side.height/2,-.078,postMat);
          });
          railY.forEach(y=>frameGeometry(group,base,width,.04,.02,mid,y,doubleRow?-.078:-.008,postMat));
          const rows=horizontalPicketRows(side.height,config.gap,doubleRow);
          rows.front.forEach(y=>horizontalPickets.push({x:mid,y,z:.005}));
          rows.rear.forEach(y=>rearHorizontalPickets.push({x:mid,y,z:-.09}));
        }else if(side.fill==='picket'||side.fill==='picket-double'){
          railY.forEach(y=>frameGeometry(group,base,width,.04,.02,mid,y,supportZ,postMat));
          if(side.fill==='picket-double')
            railY.forEach(y=>frameGeometry(group,base,width,.04,.02,mid,y,behind?-.035:-.078,postMat));
          const stripPlan=verticalPicketPlan(width,config.gap,true);
          const strips=stripPlan.strips;
          strips.forEach(p=>frontPickets.push({x:mid+p.x,y:.065,z:frontZ,width:p.width}));
          if(side.fill==='picket-double'){
            for(let k=0;k<strips.length-1;k++){
              const left=strips[k],right=strips[k+1];
              const rearX=(left.x+left.width/2+right.x-right.width/2)/2;
              rearPickets.push({x:mid+rearX,y:.065,z:rearZ});
            }
          }
          // Exact geometric check: first/last board touches the intended bay boundary.
          if(strips.length){
            const left=strips[0].x-strips[0].width/2;
            const last=strips[strips.length-1];
            const right=last.x+last.width/2;
            renderedEdgeClearance=Math.max(renderedEdgeClearance,
              Math.abs(left+width/2),Math.abs(right-width/2));
          }
        }
      }
      // Each section may have a different span width after opening a gateway.
      // Build horizontal slats separately to preserve their true 3D lengths.
      if(horizontalPickets.length||rearHorizontalPickets.length){
        const geo=buildPicketGeometry(infillWidth,true);
        previousLineGeometries.push(geo);
        instancePickets(group,geo,fillMat,horizontalPickets,0);
        instancePickets(group,geo,fillMat,rearHorizontalPickets,Math.PI);
      }
      }
      if(frontPickets.length||rearPickets.length){
        const geo=buildPicketGeometry(side.height-.13);
        previousLineGeometries.push(geo);
        instancePickets(group,geo,fillMat,frontPickets,0);
        instancePickets(group,geo,fillMat,rearPickets,Math.PI);
      }
      for(const opening of edge.openings){
        const renderOpening=opening.kind==='gate'&&opening.type==='sliding'?
          renderSlidingGate:renderGateFrame;
        renderOpening({
          group,base,opening,openingStart:start+opening.start,postWidth,
          side,sideLength:side.length,otherOpenings:edge.openings,
          behind,gap:config.gap,postMat,fillMat,frameGeometry,
          buildC10Geometry,buildPicketGeometry,instancePickets,horizontalPicketRows,
          verticalPicketPlan,ownedGeometries:previousLineGeometries,
          ownedMaterials:previousMaterials
        });
      }
      if(config.showDimensions){
        const dimension=clearDimensions.find(d=>d.id===edge.id);
        drawDimensionGuides(group,dimension,edge.side.length,edge.id);
      }
      renderedMaxEdgeClearance=Math.max(renderedMaxEdgeClearance,renderedEdgeClearance);
      renderedPostModes[edge.id]=side.postMode;
    }
    let renderedPlanks=0;
    fence.traverse(object=>{if(object.isInstancedMesh)renderedPlanks+=object.count;});
    root.dataset.sceneDimensionCount=String(config.showDimensions?
      clearDimensions.reduce((n,d)=>n+d.spans.length,0):0);
    root.dataset.sceneDimensionValues=config.showDimensions?
      clearDimensions.flatMap(d=>d.spans.map(p=>d.id+':'+p.kind+':'+p.clearMm)).join(';'):'';
    root.dataset.scenePickets=String(renderedPlanks);
    let actualLeaves=0,wicketLeaves=0,visibleHinges=0,diagonalBraces=0,embeddedWickets=0,thresholds=0;
    const leafWidths=[];
    fence.traverse(object=>{
      if(object.userData.kdGateLeaf)actualLeaves++;
      if(object.userData.kdWicketLeaf)wicketLeaves++;
      if(object.userData.kdHinge)visibleHinges++;
      if(object.userData.kdDiagonalBrace)diagonalBraces++;
      if(object.userData.kdEmbeddedWicket)embeddedWickets++;
      if(object.userData.kdEmbeddedThreshold)thresholds++;
      if(typeof object.userData.kdFrameWidth==='number')
        leafWidths.push(object.userData.kdFrameWidth);
    });
    let slidingLeaves=0,slidingTails=0,slidingCenters=0;
    fence.traverse(object=>{
      if(object.userData.kdSlidingLeaf)slidingLeaves++;
      if(object.userData.kdSlidingTail)slidingTails++;
      if(object.userData.kdSlidingCenterPost)slidingCenters++;
    });
    root.dataset.sceneSlidingLeaves=String(slidingLeaves);
    root.dataset.sceneSlidingTails=String(slidingTails);
    root.dataset.sceneSlidingCenters=String(slidingCenters);
    root.dataset.sceneGateLeaves=String(actualLeaves);
    root.dataset.sceneWicketLeaves=String(wicketLeaves);
    root.dataset.sceneHinges=String(visibleHinges);
    root.dataset.sceneBraces=String(diagonalBraces);
    root.dataset.sceneEmbeddedWickets=String(embeddedWickets);
    root.dataset.sceneThresholds=String(thresholds);
    root.dataset.sceneLeafWidths=leafWidths.map(w=>Math.round(w*1000)).join(',');
    root.dataset.sceneOpenings=layout.openings.map(o=>o.sideId+':'+o.kind+':'+o.start.toFixed(2)).join(';');
    const swingPivots=[];
    fence.traverse(object=>{
      if(object.userData.kdSwingPivot)swingPivots.push(object.userData.kdSwingSignature);
    });
    root.dataset.sceneSwingAngles=swingPivots.join(';');
    root.dataset.sceneGateOpening=layout.gate?JSON.stringify({start:layout.gate.start,end:layout.gate.end}):'';
    root.dataset.scenePostModes=JSON.stringify(renderedPostModes);
    root.dataset.sceneEdgeClearance=String(renderedMaxEdgeClearance);
    root.dataset.sceneRequestedGap=String(config.gap);
    root.dataset.sceneActualGaps=getVerticalGapPlans(layout).map(x=>x.id+':'+x.plan.gapUsed.toFixed(6)).join(';');
    root.dataset.sceneFillColors=[...sceneFillColors].sort().join(',');
    root.dataset.sceneRevision=String((Number(root.dataset.sceneRevision)||0)+1);
    renderer.render(scene,camera);
  }
  function fit() {
    if(!webglOk)return;
    const layout=getSiteLayout(config.sides,config.openings);
    const b=layout.bounds;
    const aspect=Math.max(.45,camera.aspect||1);
    const halfFov=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
    const width=Math.max(3,b.width),depth=Math.max(3,b.depth);
    const single=layout.edges.length===1;
    const needed=single ? Math.max(width,depth)/(2*halfFov*aspect) :
      Math.max(width/(2*halfFov*aspect),depth/(2*halfFov));
    const dist=Math.max(6,needed*(single?1.23:1.43));
    if(single){
      // Face the length of whichever single side is enabled, not only side A.
      const edge=layout.edges[0],unitX=(edge.end.x-edge.start.x)/edge.side.length;
      const unitZ=(edge.end.z-edge.start.z)/edge.side.length;
      camera.position.set(b.centerX-unitZ*dist*.94+unitX*dist*.1,
        Math.max(3,dist*.38),b.centerZ+unitX*dist*.94+unitZ*dist*.1);
    }else camera.position.set(b.centerX+dist*.49,Math.max(5,dist*.54),b.centerZ+dist*.85);
    const maxHeight=Math.max(1.8,...layout.posts.map(p=>p.height));
    controls.target.set(b.centerX,maxHeight*.5,b.centerZ);
    controls.maxDistance=500;
    controls.update();
  }
  function resize() {
    if (!webglOk) return;
    const width = Math.max(1,sceneHost.clientWidth), height=Math.max(1,sceneHost.clientHeight);
    camera.aspect=width/height;
    camera.updateProjectionMatrix();
    renderer.setSize(width,height,false);
    renderer.render(scene,camera);
  }
  // Each product editor is permanently bound to its owning perimeter side.
  function afterProductEdit(id){
    config.activeSide=id;
    updateModel();
    syncSideInputs();
  }
  for(const id of SIDE_IDS){
    const get=selector=>productField(id,selector);
    get('[data-gate-type]').querySelectorAll('[data-gate-mode]').forEach(button=>{
      button.addEventListener('click',()=>{
        const gate=config.openings[id].gate;
        gate.type=button.dataset.gateMode==='sliding'?'sliding':'swing';
        config.openings=normalizeOpenings(config.sides,config.openings,config.gate);
        afterProductEdit(id);
      });
    });
    for(const [selector,key] of [
      ['[data-gate-slide-direction]','slideDirection'],
      ['[data-gate-tail-shape]','tailShape'],
      ['[data-gate-center-post]','centerPost']
    ]){
      get(selector).addEventListener('change',event=>{
        config.openings[id].gate[key]=key==='centerPost'?event.target.checked:event.target.value;
        afterProductEdit(id);
      });
    }
    for(const kind of ['gate','wicket']){
      get('[data-'+kind+'-enabled]').addEventListener('change',event=>{
        config.openings[id][kind].enabled=event.target.checked;
        if(event.target.checked)config.sides[id].enabled=true;
        afterProductEdit(id);
      });
      for(const [key,min,max] of [['width',kind==='gate'?2:.7,kind==='gate'?6:1.5],
        ['offset',0,60]]){
        get('[data-'+kind+'-'+key+']').addEventListener('change',event=>{
          const item=config.openings[id][kind];
          item[key]=numeric(event.target.value,min,max,item[key]);
          config.openings=normalizeOpenings(config.sides,config.openings,config.gate);
          afterProductEdit(id);
        });
      }
      get('[data-'+kind+'-open-direction]').addEventListener('change',event=>{
        config.openings[id][kind].openDirection=
          event.target.value==='outward'?'outward':'inward';
        afterProductEdit(id);
      });
      for(const [field,key] of [['frame-profile','frameProfile'],['fill','fill'],['inner-frame','innerFrame']]){
        get('[data-'+kind+'-'+field+']').addEventListener('change',event=>{
          config.openings[id][kind][key]=field==='inner-frame'?
            event.target.checked:event.target.value;
          afterProductEdit(id);
        });
      }
    }
    get('[data-wicket-hinge-side]').addEventListener('change',event=>{
      config.openings[id].wicket.hingeSide=event.target.value==='right'?'right':'left';
      afterProductEdit(id);
    });
    get('[data-builtin-enabled]').addEventListener('change',event=>{
      config.openings[id].gate.builtInWicket=event.target.checked;
      afterProductEdit(id);
    });
    get('[data-builtin-side]').addEventListener('change',event=>{
      config.openings[id].gate.builtInSide=event.target.value==='left'?'left':'right';
      afterProductEdit(id);
    });
    get('[data-builtin-width]').addEventListener('change',event=>{
      const gate=config.openings[id].gate;
      gate.builtInWidth=numeric(event.target.value,.7,1.2,gate.builtInWidth);
      afterProductEdit(id);
    });
  }
  let pendingDrawing='';
  let pendingDrawingFilename='';
  const drawingDialog=find('[data-drawing-dialog]');
  root.querySelectorAll('[data-drawing-kind]').forEach(button=>button.addEventListener('click',()=>{
    const kind=button.dataset.drawingKind;
    const sideId=button.closest('[data-side-products]').dataset.sideProducts;
    const opening=config.openings[sideId][kind];
    if(!opening?.enabled)return;
    const sliding=kind==='gate'&&opening.type==='sliding';
    const plan=sliding?
      getSlidingGatePlan(opening,config.postSize/1000,config.sides[sideId].height):
      getGateFramePlan({kind,...opening},config.postSize/1000,config.sides[sideId].height);
    const drawingData={sideId,opening,postSize:config.postSize,
      fillName:FILL_LABELS[opening.fill==='side'?config.sides[sideId].fill:opening.fill]};
    pendingDrawing=sliding?buildSlidingSketchSvg(plan,drawingData):
      buildOpeningSketchSvg(plan,drawingData);
    pendingDrawingFilename='KD-'+(sliding?'otkatnye-':kind==='gate'?'vorota-':'kalitka-')+sideId+'.svg';
    find('[data-drawing-title]').textContent='Эскиз: '+
      (sliding?'откатные ворота':kind==='gate'?'ворота':'калитка')+
      ' · сторона '+SIDE_NAMES[sideId];
    find('[data-drawing-preview]').innerHTML=pendingDrawing;
    if(!drawingDialog.open)drawingDialog.showModal();
  }));
  find('[data-drawing-close]').addEventListener('click',()=>drawingDialog.close());
  drawingDialog.addEventListener('click',event=>{if(event.target===drawingDialog)drawingDialog.close();});
  find('[data-drawing-download]').addEventListener('click',()=>{
    if(!pendingDrawing)return;
    const href=URL.createObjectURL(new Blob([pendingDrawing],{type:'image/svg+xml;charset=utf-8'}));
    const link=document.createElement('a');
    link.href=href;link.download=pendingDrawingFilename;
    document.body.appendChild(link);link.click();link.remove();
    window.setTimeout(()=>URL.revokeObjectURL(href),10000);
  });
  find('[data-sides]').addEventListener('click',event=>{
    const button=event.target.closest('[data-opening-side][data-opening-kind]');
    if(!button)return;
    const id=button.dataset.openingSide,kind=button.dataset.openingKind;
    if(!config.sides[id]||!['gate','wicket'].includes(kind))return;
    const item=config.openings[id][kind];
    item.enabled=!item.enabled;
    if(item.enabled)config.sides[id].enabled=true;
    config.activeSide=id;
    updateModel();syncSideInputs();resize();fit();
  });
  find('[data-show-dimensions]').addEventListener('change',event=>{
    config.showDimensions=event.target.checked;
    updateModel();
  });
  root.querySelectorAll('[data-post-mode]').forEach(button=>button.addEventListener('click',()=>{
    const side=activeSettings();
    const next=normalizePostMode(side.fill,button.dataset.postMode);
    side.postMode=next;
    syncPostMode();
    updateModel();
  }));
  for(const input of root.querySelectorAll('[data-field]')){
    input.addEventListener('change',()=>{
      const field=input.dataset.field,selected=activeSettings();
      if(field==='fill')selected.fill=FILL_IDS.includes(input.value)?input.value:selected.fill;
      else if(field==='postSize')config.postSize=[60,80,100].includes(Number(input.value))?Number(input.value):config.postSize;
      else if(field==='gap'){
        config.gap=numeric(input.value,0,12,config.gap*100)/100;
        config.gapFit=false;
      }
      else if(field==='ral'){applyFenceColor(input.value);return;}
      else selected[field]=numeric(input.value,field==='height'?.8:1,3,selected[field]);
      syncSideInputs();
      updateModel();
      if(field==='height')fit();
    });
  }
  find('[data-sides]').addEventListener('click',event=>{
    const button=event.target.closest('[data-side]');
    if(!button||!config.sides[button.dataset.side])return;
    config.activeSide=button.dataset.side;
    syncSideInputs();
    updateModel();
  });
  find('[data-sides]').addEventListener('change',event=>{
    const toggle=event.target.closest('[data-side-toggle]');
    if(toggle){
      const side=config.sides[toggle.dataset.sideToggle];
      if(!side)return;
      side.enabled=toggle.checked;
      updateModel();
      resize();fit();
      return;
    }
    const fillInput=event.target.closest('[data-side-quick-fill]');
    const heightInput=event.target.closest('[data-side-quick-height]');
    const ralInput=event.target.closest('[data-side-quick-ral]');
    if(fillInput||heightInput||ralInput){
      const input=fillInput||heightInput||ralInput;
      const id=fillInput?.dataset.sideQuickFill||
        heightInput?.dataset.sideQuickHeight||ralInput.dataset.sideQuickRal;
      const side=config.sides[id];
      if(!side)return;
      if(fillInput)side.fill=FILL_IDS.includes(input.value)?input.value:side.fill;
      if(heightInput)side.height=numeric(input.value,.8,3,side.height);
      if(ralInput)side.ral=Object.hasOwn(RAL,input.value)?input.value:side.ral;
      config.activeSide=id;
      syncSideInputs();updateModel();
      if(heightInput)fit();
      return;
    }
    const field=event.target.closest('[data-side-length-input]');
    if(!field)return;
    const id=field.dataset.sideLengthInput,side=config.sides[id];
    if(!side)return;
    side.length=numeric(field.value,1,60,side.length);
    config.activeSide=id;
    syncSideInputs();updateModel();resize();fit();
  });
  find('[data-presets]').addEventListener('click',event=>{
    const button=event.target.closest('[data-preset]');
    if(!button)return;
    const preset=AREA_PRESETS.find(p=>p.x+'x'+p.z===button.dataset.preset);
    if(!preset)return;
    for(const [id,len] of [['A',preset.x],['V',preset.x],['B',preset.z],['G',preset.z]]){
      config.sides[id].enabled=true;
      config.sides[id].length=len;
    }
    config.activeSide='A';
    syncSideInputs();updateModel();resize();fit();
  });
  root.querySelectorAll('[data-orientation]').forEach(button=>button.addEventListener('click',()=>{
    const horizontal=button.dataset.orientation==='horizontal';
    const double=find('[data-double-row]').checked;
    activeSettings().fill=horizontal?(double?'horizontal-double':'horizontal'):(double?'picket-double':'picket');
    syncSideInputs();updateModel();
  }));
  find('[data-double-row]').addEventListener('change',event=>{
    const horizontal=activeSettings().fill.startsWith('horizontal');
    activeSettings().fill=horizontal?(event.target.checked?'horizontal-double':'horizontal'):
      (event.target.checked?'picket-double':'picket');
    syncSideInputs();updateModel();
  });
  find('[data-auto-gap]').addEventListener('click',()=>{
    const plans=getVerticalGapPlans(getSiteLayout(config.sides,config.openings));
    if(!plans.length||plans.some(x=>x.plan.edgeMargin>.0001))return;
    config.gapFit=true;
    updateModel();
  });
  const gapSlider=find('[data-gap-slider]');
  const gapInput=find('[data-field="gap"]');
  let gapPreviewTimer=null;
  function commitGapPreview(){
    if(gapPreviewTimer!==null){
      window.clearTimeout(gapPreviewTimer);
      gapPreviewTimer=null;
    }
    updateModel();
  }
  function previewGap(value,fromSlider){
    const cm=numeric(value,0,12,config.gap*100);
    config.gap=cm/100;
    config.gapFit=false;
    find('[data-gap-value]').textContent=String(cm).replace('.',',')+' см';
    if(fromSlider)gapInput.value=cm;
    else gapSlider.value=cm;
    // Render while dragging, throttled to avoid rebuilding hundreds of 3D objects
    // on every pointer movement. Release always forces the final exact geometry.
    if(gapPreviewTimer===null)
      gapPreviewTimer=window.setTimeout(()=>{gapPreviewTimer=null;updateModel();},110);
  }
  gapSlider.addEventListener('input',()=>previewGap(gapSlider.value,true));
  gapSlider.addEventListener('change',()=>{
    config.gap=numeric(gapSlider.value,0,12,config.gap*100)/100;
    commitGapPreview();
  });
  gapInput.addEventListener('input',()=>{
    if(gapInput.value.trim()!=='')previewGap(gapInput.value,false);
  });
  const collapse=find('[data-collapse-params]');
  collapse.addEventListener('click',()=>{
    const body=find('[data-editor-content]');
    body.hidden=!body.hidden;
    collapse.setAttribute('aria-expanded',String(!body.hidden));
    collapse.innerHTML=body.hidden?'Развернуть <span aria-hidden="true">⌄</span>':
      'Свернуть <span aria-hidden="true">⌃</span>';
  });
  root.querySelector('[data-fit]').addEventListener('click',fit);
  root.querySelector('[data-reset]').addEventListener('click',()=>{
    Object.assign(config,DEFAULT);
    config.gate=normalizeSwingGate(null,DEFAULT.length);
    config.openings=normalizeOpenings(createDefaultSides(DEFAULT),null,config.gate);
    config.gapFit=false;
    config.showDimensions=false;
    config.sides=createDefaultSides(DEFAULT);
    config.activeSide='A';
    syncSideInputs();
    updateModel();
    resize();
    fit();
  });
  root.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{
    const isScene=button.dataset.mode==='scene';
    root.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b===button));
    sceneHost.hidden=!isScene;parts.hidden=isScene;
    root.querySelector('.kd3d-scene-controls').hidden=!isScene;
    if(isScene)resize();
  }));
  const observer=new ResizeObserver(resize);
  observer.observe(sceneHost);
  updateModel();
  resize();
  fit();
  resize();
  if (webglOk) {
    const tick=()=>{
      if (!root.isConnected) return;
      if (!document.hidden && root.getClientRects().length) {
        controls.update();
        renderer.render(scene,camera);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  instance={root,resize};
}
