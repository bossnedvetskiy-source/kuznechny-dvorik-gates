import * as THREE from '../naves/vendor/three.module.js';
import { OrbitControls } from '../naves/vendor/OrbitControls.js';
import { SIDE_IDS, SIDE_NAMES, FILL_IDS, createDefaultSides, normalizeSides, getSiteLayout, normalizePostMode, verticalPicketPlan, isHorizontalFill } from './3d-layout.js';

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
    '<div class="kd3d-scene-controls"><button type="button" data-fit>Показать целиком</button></div>',
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
    '<div class="kd3d-sides-head"><strong>Стороны участка</strong><span class="kd3d-sides-count" data-active-side-count>1 из 4</span></div>',
    '<div class="kd3d-sides kd3d-side-list" data-sides role="group" aria-label="Стороны участка">'+SIDE_IDS.map(id=>
      '<div class="kd3d-side-entry" data-side-entry="'+id+'"><div class="kd3d-side-line"><label class="kd3d-side-checkbox"><input type="checkbox" data-side-toggle="'+id+'" aria-label="Включить сторону '+SIDE_NAMES[id]+'"><span aria-hidden="true"></span></label><button type="button" data-side="'+id+'" aria-pressed="false"><b>Сторона '+SIDE_NAMES[id]+' <small>('+SIDE_SUBTITLES[id]+')</small></b><span data-side-material="'+id+'">Штакетник</span></button></div>'+
      '<label class="kd3d-side-inline-length"><span>Длина стороны</span><span class="kd3d-side-input-wrap"><input type="number" inputmode="decimal" min="1" max="60" step="0.1" data-side-length-input="'+id+'" aria-label="Длина стороны '+SIDE_NAMES[id]+', м"><small>м</small></span></label></div>').join('')+'</div>',
    '<div class="kd3d-side-current"><strong data-current-side-label>Настройка стороны А</strong><small data-current-side-status>Включена</small></div>',
    '<div class="kd3d-fields"><label data-height-label>Высота стороны А, м<input data-field="height" inputmode="decimal" type="number" min="0.8" max="3" step="0.1"></label>',
    '<label>Шаг столбов, м<input data-field="step" inputmode="decimal" type="number" min="1" max="3" step="0.1"></label></div>',
    '<label class="kd3d-select-label">Столбы · профильная труба<select data-field="postSize"><option value="60">60×60 мм</option><option value="80">80×80 мм</option><option value="100">100×100 мм</option></select></label>',
    '<div class="kd3d-post-layout" data-post-layout><div class="kd3d-subheading">Расположение столбов</div><div class="kd3d-post-options" role="group" aria-label="Расположение столбов"><button type="button" data-post-mode="visible" aria-pressed="true"><strong>Столбы видны</strong><small>Заполнение между столбами, без боковых щелей</small></button><button type="button" data-post-mode="behind" aria-pressed="false"><strong>Столбы сзади</strong><small>Сплошная линия забора перед столбами</small></button></div><p class="kd3d-post-note" data-post-note>Для выбранной стороны участка</p></div>',
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
    '<div class="kd3d-hint">Предварительная 3D-визуализация. Стоимость, ворота, калитки и доставка будут подключены отдельно.</div>',
    '<button type="button" data-reset class="kd3d-reset">↶ Сбросить параметры</button>',
    '</div></div>'
  ].join('');
  const find = selector => root.querySelector(selector);
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
    const selected=activeSettings();
    for(const key of ['height','step','fill','ral'])
      find('[data-field="'+key+'"]').value=selected[key];
    find('[data-field="postSize"]').value=config.postSize;
    find('[data-field="gap"]').value=Number((config.gap*100).toFixed(1));
    syncPicketSettings();
    syncPostMode();
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
  const formatGapCm=metres=>Number((metres*100).toFixed(2)).toString().replace('.',',');
  function getVerticalGapPlans(layout){
    return layout.edges.filter(edge=>edge.side.fill==='picket'||edge.side.fill==='picket-double')
      .map(edge=>{
        const behind=edge.side.postMode==='behind';
        const width=Math.max(.025,edge.span-(behind?0:config.postSize/1000));
        return {id:edge.id,plan:verticalPicketPlan(width,config.gap,config.gapFit)};
      });
  }
  function syncGapWarning(plans){
    const element=find('[data-gap-alert]');
    if(!plans.length){element.hidden=true;return;}
    const unresolved=plans.filter(x=>x.plan.edgeMargin>.0001);
    const message=find('[data-gap-message]');
    const button=find('[data-auto-gap]');
    const impossible=unresolved.filter(x=>!x.plan.canFit);
    const targetList=plans.map(x=>SIDE_NAMES[x.id]+': '+formatGapCm(x.plan.gapUsed)+' см');
    if(!unresolved.length && !config.gapFit){element.hidden=true;return;}
    element.hidden=false;
    if(config.gapFit&&!unresolved.length){
      message.textContent='Без подрезки. Фактические зазоры между целыми планками: '+targetList.join('; ')+'. Заданный зазор — верхняя граница.';
      button.hidden=true;
      element.classList.add('is-fitted');
      return;
    }
    element.classList.remove('is-fitted');
    const sides=unresolved.map(x=>SIDE_NAMES[x.id]).join(', ');
    const maxMargin=Math.max(...unresolved.map(x=>x.plan.edgeMargin));
    message.textContent='Внимание: на стороне '+sides+' при заданном зазоре остаются пустоты у столбов до '+
      formatGapCm(maxMargin)+' см с каждой стороны пролёта. Штакетник 120 мм не подрезаем.'+
      (impossible.length?' Для некоторых пролётов одного уменьшения зазора недостаточно — измените шаг столбов или длину стороны.':'');
    button.hidden=impossible.length>0;
  }
  function summary() {
    const layout=getSiteLayout(config.sides);
    const gapPlans=getVerticalGapPlans(layout);
    syncGapWarning(gapPlans);
    const format=value=>value.toFixed(1).replace('.',',');
    const format2=value=>value.toFixed(2).replace('.',',');
    const warning=find('[data-site-warning]');
    warning.hidden=!layout.warnings.length;
    warning.textContent=layout.warnings.join(' ');
    stats.innerHTML=
      '<div><small>Забор, м</small><b>'+format(layout.perimeter)+'</b></div>'+
      '<div><small>Пролётов</small><b>'+layout.totalSpans+'</b></div>'+
      '<div><small>Столбов</small><b>'+layout.posts.length+'</b></div>';
    let description='<h3>Комплектация · геометрия участка</h3>';
    if(!layout.edges.length) description+='<p>Включите хотя бы одну сторону участка.</p>';
    for(const edge of layout.edges){
      description+='<p><b>Сторона '+SIDE_NAMES[edge.id]+': '+format(edge.side.length)+' м</b> · высота '+
        format(edge.side.height)+' м · пролётов '+edge.count+' (по '+format2(edge.span)+' м).<br>'+
        FILL_NAMES[edge.side.fill]+' · RAL '+edge.side.ral+' · '+(edge.side.postMode==='behind'?'столбы сзади':'столбы видны')+
        (edge.side.fill==='sheet'?'':(edge.side.fill==='picket'||edge.side.fill==='picket-double')
          ?' · зазор '+(gapPlans.find(x=>x.id===edge.id)?.plan.gapUsed*100??config.gap*100).toFixed(2).replace('.',',')+' см'+(config.gapFit?' (подогнан без подрезки)':' (заданный)'):
          ' · зазор '+format(config.gap*100)+' см')+'.</p>';
    }
    description+='<p>Периметр активных сторон: <b>'+format(layout.perimeter)+' м</b>. '+
      'Пролётов: <b>'+layout.totalSpans+'</b>; металлических столбов: <b>'+
      layout.posts.length+'</b> ('+config.postSize+'×'+config.postSize+' мм). Угловые столбы не дублируются.</p>';
    if(layout.warnings.length) description+='<p class="kd3d-unpriced">'+layout.warnings.join(' ')+'</p>';
    description+='<p class="kd3d-unpriced">Схема и количество столбов предварительные. '+
      'Без проёмов, производственного раскроя, прочностной проверки и расчёта стоимости.</p>';
    parts.innerHTML=description;
    syncSideButtons();
    return layout;
  }
  function clearGeometry() {
    if (!fence) return;
    fence.clear();
    previousMaterials.forEach(m => m.dispose());
    previousLineGeometries.forEach(g => g.dispose());
    previousMaterials = [];
    previousLineGeometries = [];
  }
  function updateModel() {
    SIDE_IDS.forEach(id=>{
      const side=config.sides[id];
      side.postMode=normalizePostMode(side.fill,side.postMode);
    });
    const selected=activeSettings();
    // Legacy keys retained for older locally saved drafts and existing integrations.
    for(const key of ['length','height','step','fill','ral']) config[key]=selected[key];
    const layout=summary();
    saveDraft(config);
    if(!webglOk)return;
    clearGeometry();
    const postWidth=config.postSize/1000;
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
      const rearOnly=p.sides.length>0 && p.sides.every(id=>
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
      const start=-side.length/2,actualSpan=edge.span,count=edge.count;
      const behind=side.postMode==='behind'&&!isHorizontalFill(side.fill);
      // Visible posts: run right up to the two post faces.
      // Rear posts: the infill passes across the post centres in front of the steel.
      const infillWidth=Math.max(.025,actualSpan-(behind?0:postWidth));
      const frontZ=behind?.115:.005;
      const rearZ=behind?-.015:-.09;
      const supportZ=behind?.073:-.008;
      const railY=side.height>2.15?[.32,side.height/2,side.height-.32]:
        [.33,Math.max(.52,side.height-.33)];
      const frontPickets=[],rearPickets=[],horizontalPickets=[],rearHorizontalPickets=[];
      let renderedEdgeClearance=0;
      for(let i=0;i<count;i++){
        const mid=start+(i+.5)*actualSpan;
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
          const stripPlan=verticalPicketPlan(width,config.gap,config.gapFit);
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
      if(frontPickets.length||rearPickets.length){
        const geo=buildPicketGeometry(side.height-.13);
        previousLineGeometries.push(geo);
        instancePickets(group,geo,fillMat,frontPickets,0);
        instancePickets(group,geo,fillMat,rearPickets,Math.PI);
      }
      if(horizontalPickets.length||rearHorizontalPickets.length){
        const geo=buildPicketGeometry(infillWidth,true);
        previousLineGeometries.push(geo);
        instancePickets(group,geo,fillMat,horizontalPickets,0);
        instancePickets(group,geo,fillMat,rearHorizontalPickets,Math.PI);
      }
      renderedMaxEdgeClearance=Math.max(renderedMaxEdgeClearance,renderedEdgeClearance);
      renderedPostModes[edge.id]=side.postMode;
    }
    let renderedPlanks=0;
    fence.traverse(object=>{if(object.isInstancedMesh)renderedPlanks+=object.count;});
    root.dataset.scenePickets=String(renderedPlanks);
    root.dataset.scenePostModes=JSON.stringify(renderedPostModes);
    root.dataset.sceneEdgeClearance=String(renderedMaxEdgeClearance);
    root.dataset.sceneFillColors=[...sceneFillColors].sort().join(',');
    root.dataset.sceneRevision=String((Number(root.dataset.sceneRevision)||0)+1);
    renderer.render(scene,camera);
  }
  function fit() {
    if(!webglOk)return;
    const layout=getSiteLayout(config.sides);
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
    const plans=getVerticalGapPlans(getSiteLayout(config.sides));
    if(!plans.length||plans.some(x=>x.plan.edgeMargin>.0001&&!x.plan.canFit))return;
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
    config.gapFit=false;
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
