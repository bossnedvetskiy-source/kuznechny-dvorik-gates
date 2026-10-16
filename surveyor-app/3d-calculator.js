import * as THREE from '../naves/vendor/three.module.js';
import { OrbitControls } from '../naves/vendor/OrbitControls.js';
import { SIDE_IDS, SIDE_NAMES, FILL_IDS, createDefaultSides, normalizeSides, getSiteLayout } from './3d-layout.js';

// Standalone DEV prototype. This is visual geometry only, not a retail price quote.
const DRAFT_KEY = 'kd-surveyor-3d-draft-v1';
const DEFAULT = { length: 12, height: 1.8, step: 2.5, postSize: 80, fill: 'picket', gap: 0.05, ral: '7024' };
// Approximate screen representations of powder-coated RAL metal, not calibrated paint samples.
const RAL = { '7024': '#46494f', '8017': '#49312c', '6005': '#114436', '9005': '#151719', '9003': '#eeefea' };
const RAL_LABELS = { '7024':'Графит', '8017':'Шоколад', '6005':'Зелёный', '9005':'Чёрный', '9003':'Белый' };
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
    gap:numeric(o.gap,0.02,0.12,DEFAULT.gap),
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

// The independent DEV screen must remain styled even if an older PWA serves stale CSS.
const SIDE_CARD_STYLE_ID='kd3d-side-cards-style-v2';
const SIDE_CARD_CRITICAL_CSS="\n/* Critical mobile side-card styling is inserted with the JS module as an offline CSS fallback. */\n#threeDScreen .kd3d-side-panel{display:grid!important;gap:12px!important;padding:14px!important;border:1px solid #e7dfd1!important;border-radius:17px!important;background:linear-gradient(180deg,#fffefb,#f9f6ef)!important}\n#threeDScreen .kd3d-sides-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important}\n#threeDScreen .kd3d-sides-head strong{font-size:15px!important;line-height:1.2!important;color:#27231d!important}\n#threeDScreen .kd3d-sides-count{flex-shrink:0;background:#24211d;color:#f1d084;font-size:11px;font-weight:800;border-radius:40px;padding:6px 9px}\n#threeDScreen .kd3d-sides-help{font-size:12px;line-height:1.45;color:#756f65;margin:0}\n#threeDScreen .kd3d-sides{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:9px!important;margin:0}\n#threeDScreen .kd3d-side-entry{min-width:0!important;min-height:74px!important;display:grid!important;grid-template-columns:minmax(0,1fr) 32px!important;gap:4px!important;align-items:stretch!important;padding:8px!important;border:1.5px solid #e4ded4!important;border-radius:14px!important;background:#fff!important;box-shadow:0 2px 5px #00000008!important}\n#threeDScreen .kd3d-side-entry.enabled{border-color:#d2b575!important;background:#fffcf6!important}\n#threeDScreen .kd3d-side-entry.selected{border-color:#c99b46!important;background:#24211e!important;box-shadow:0 0 0 1px #c99b46,0 4px 10px #00000014!important}\n#threeDScreen .kd3d-side-entry [data-side]{display:flex!important;align-items:center!important;min-width:0!important;width:100%!important;gap:7px!important;border:0!important;border-radius:0!important;background:transparent!important;color:#39342d!important;text-align:left!important;padding:3px 0!important;box-shadow:none!important}\n#threeDScreen .kd3d-side-letter{flex:0 0 30px;display:grid;place-items:center;width:30px;height:38px;border-radius:10px;font-size:21px;font-weight:900;background:#f3eee4;color:#8b631c}\n#threeDScreen .kd3d-side-copy{min-width:0;display:grid;align-content:center;gap:2px}\n#threeDScreen .kd3d-side-copy b{font-size:13px;font-weight:900;white-space:nowrap;letter-spacing:-.02em}\n#threeDScreen .kd3d-side-copy small{font-size:10px;color:#80796d;white-space:nowrap}\n#threeDScreen .kd3d-side-entry.selected .kd3d-side-letter{background:#c99b46;color:#211d16}\n#threeDScreen .kd3d-side-entry.selected .kd3d-side-copy b{color:#fff5e2}\n#threeDScreen .kd3d-side-entry.selected .kd3d-side-copy small{color:#d7be8e}\n#threeDScreen .kd3d-side-entry [data-side-toggle]{width:32px!important;height:36px!important;min-width:32px!important;align-self:center!important;display:grid!important;place-items:center!important;border:0!important;border-radius:10px!important;padding:0!important;background:#f0ede8!important;color:#777268!important;font-size:20px!important;font-weight:800!important;line-height:1!important;box-shadow:none!important}\n#threeDScreen .kd3d-side-entry.enabled [data-side-toggle]{background:#c99b46!important;color:#251e13!important}\n#threeDScreen .kd3d-side-entry [data-side-toggle]:focus-visible,#threeDScreen .kd3d-side-entry [data-side]:focus-visible{outline:3px solid #c99b46;outline-offset:2px}\n#threeDScreen .kd3d-side-current{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 10px;padding-top:11px;border-top:1px solid #eae2d5}\n#threeDScreen .kd3d-side-current strong{font-size:13px;color:#292620}\n#threeDScreen .kd3d-side-current small{font-size:11px;font-weight:800;color:#8d6832;background:#f8edda;padding:6px 9px;border-radius:22px}\n#threeDScreen .kd3d-side-current small.is-off{background:#eee;color:#777}\n#threeDScreen .kd3d-fields label{min-width:0!important}\n#threeDScreen .kd3d-side-warning{display:block;border-radius:12px;padding:11px 12px;margin:0;background:#fff5e5;color:#83521c;font-size:12px;line-height:1.5}\n#threeDScreen .kd3d-side-warning[hidden]{display:none!important}\n@media(max-width:360px){#threeDScreen .kd3d-side-panel{padding:10px!important}#threeDScreen .kd3d-sides{gap:6px!important}#threeDScreen .kd3d-side-entry{padding:6px!important}#threeDScreen .kd3d-side-copy b{font-size:12px}}\n";
function ensureSideCardStyles() {
  if(document.getElementById(SIDE_CARD_STYLE_ID))return;
  const style=document.createElement('style');
  style.id=SIDE_CARD_STYLE_ID;
  style.textContent=SIDE_CARD_CRITICAL_CSS;
  document.head.appendChild(style);
}

export function mount3DCalculator(root) {
  if (instance && instance.root === root) {
    instance.resize();
    return;
  }
  if (!root) throw new Error('Не найден раздел 3D расчёта');
  ensureSideCardStyles();
  const config = loadDraft();
  const activeSettings=()=>config.sides[config.activeSide];
  root.innerHTML = [
    '<div class="kd3d-top"><div><strong>Конструктор участка</strong><small>Этап 3 · геометрия участка</small></div><span>DEV</span></div>',
    '<div class="kd3d-mode" role="group" aria-label="Вид результата"><button type="button" data-mode="scene" class="active">3D-модель</button><button type="button" data-mode="parts">Комплектация</button></div>',
    '<div class="kd3d-viewport" data-viewport><div class="kd3d-scene" data-scene></div><div class="kd3d-parts" data-parts hidden></div>',
    '<div class="kd3d-scene-controls"><button type="button" data-fit>Показать целиком</button></div>',
    '<p class="kd3d-webgl-error" data-error hidden></p></div>',
    '<div class="kd3d-form"><h3>Параметры участка</h3>',
    '<section class="kd3d-side-panel" aria-label="Выбор сторон участка">',
    '<div class="kd3d-sides-head"><strong>Стороны участка</strong><span class="kd3d-sides-count" data-active-side-count>1 из 4</span></div>',
    '<p class="kd3d-sides-help">Нажми на карточку для настройки. Кнопка справа включает или убирает сторону из 3D.</p>',
    '<div class="kd3d-sides" data-sides role="group" aria-label="Стороны участка">'+SIDE_IDS.map(id=>
      '<div class="kd3d-side-entry" data-side-entry="'+id+'"><button type="button" data-side="'+id+'" aria-pressed="false"><span class="kd3d-side-letter">'+SIDE_NAMES[id]+'</span><span class="kd3d-side-copy"><b data-side-length="'+id+'"></b><small>Настроить</small></span></button><button type="button" data-side-toggle="'+id+'" aria-pressed="false" aria-label="Включить сторону '+SIDE_NAMES[id]+'"></button></div>').join('')+'</div>',
    '<div class="kd3d-side-current"><strong data-current-side-label>Настройка стороны А</strong><small data-current-side-status>Включена</small></div>',
    '<p class="kd3d-side-warning" data-site-warning hidden></p></section>',
    '<div class="kd3d-fields"><label data-length-label>Длина стороны А, м<input data-field="length" inputmode="decimal" type="number" min="1" max="60" step="0.1"></label>',
    '<label>Высота, м<input data-field="height" inputmode="decimal" type="number" min="0.8" max="3" step="0.1"></label>',
    '<label>Макс. шаг столбов, м<input data-field="step" inputmode="decimal" type="number" min="1" max="3" step="0.1"></label></div>',
    '<label class="kd3d-select-label">Столбы · профильная труба<select data-field="postSize"><option value="60">60×60 мм</option><option value="80">80×80 мм</option><option value="100">100×100 мм</option></select></label>',
    '<label class="kd3d-select-label">Заполнение<select data-field="fill"><option value="picket">Штакетник · вертикальный односторонний</option><option value="picket-double">Штакетник · вертикальный шахматка</option><option value="horizontal">Штакетник · горизонтальный односторонний</option><option value="horizontal-double">Штакетник · горизонтальный шахматка</option><option value="sheet">Профнастил С10 · объёмный</option><option value="jalousie">Жалюзи · схематично</option></select></label>',
    '<div class="kd3d-picket-settings" data-picket-settings><div><strong>Штакетник 120 мм</strong><span>Объёмный профиль с продольным ребром и загнутыми краями</span></div><label>Зазор между планками, см<input data-field="gap" inputmode="decimal" type="number" min="2" max="12" step="0.5"></label></div>',
    '<label class="kd3d-select-label">Порошковая окраска · RAL<select data-field="ral"><option value="7024">7024 · графит</option><option value="8017">8017 · шоколад</option><option value="6005">6005 · зелёный</option><option value="9005">9005 · чёрный</option><option value="9003">9003 · белый</option></select></label>',
    '<div class="kd3d-ral-swatches" data-ral-swatches role="group" aria-label="Выбор цвета RAL"></div>',
    '<p class="kd3d-color-note">Цвета приближены к окрашенному металлу. На экране оттенок зависит от освещения и настроек телефона.</p>',
    '<div class="kd3d-stats" data-stats></div>',
    '<div class="kd3d-hint">3D-модель строит до четырёх сторон и общие угловые столбы. Чтобы замкнуть прямоугольный участок, сделай длины А и В, Б и Г одинаковыми. Ворота, калитки и цены будут добавлены позже.</div>',
    '<button type="button" data-reset class="kd3d-reset">↶ Сбросить тестовые параметры</button></div>'
  ].join('');
  const find = selector => root.querySelector(selector);
  function syncSideInputs() {
    const selected=activeSettings();
    for(const key of ['length','height','step','fill','ral'])
      find('[data-field="'+key+'"]').value=selected[key];
    find('[data-field="postSize"]').value=config.postSize;
    find('[data-field="gap"]').value=Number((config.gap*100).toFixed(1));
    syncSwatches();
  }
  function syncSideButtons() {
    SIDE_IDS.forEach(id=>{
      const selected=id===config.activeSide;
      const enabled=config.sides[id].enabled;
      const button=find('[data-side="'+id+'"]');
      const toggle=find('[data-side-toggle="'+id+'"]');
      button.setAttribute('aria-pressed',String(selected));
      toggle.setAttribute('aria-pressed',String(enabled));
      toggle.textContent=enabled?'✓':'＋';
      toggle.setAttribute('aria-label',(enabled?'Выключить':'Включить')+' сторону '+SIDE_NAMES[id]);
      button.setAttribute('aria-label','Настроить сторону '+SIDE_NAMES[id]+', '+config.sides[id].length.toFixed(1).replace('.',',')+' м');
      find('[data-side-entry="'+id+'"]').classList.toggle('selected',selected);
      find('[data-side-entry="'+id+'"]').classList.toggle('enabled',enabled);
      find('[data-side-length="'+id+'"]').textContent=config.sides[id].length.toFixed(1).replace('.',',')+' м';
    });
    find('[data-active-side-count]').textContent=SIDE_IDS.filter(id=>config.sides[id].enabled).length+' из 4';
    find('[data-current-side-label]').textContent='Настройка стороны '+SIDE_NAMES[config.activeSide];
    const status=find('[data-current-side-status]');
    status.textContent=activeSettings().enabled?'Включена в 3D':'Сторона выключена';
    status.classList.toggle('is-off',!activeSettings().enabled);
    find('[data-length-label]').firstChild.textContent='Длина стороны '+SIDE_NAMES[config.activeSide]+', м';
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
    activeSettings().ral=button.dataset.ralSwatch;
    find('[data-field="ral"]').value=activeSettings().ral;
    updateModel();
    syncSwatches();
  });
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
  function summary() {
    const layout=getSiteLayout(config.sides);
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
        FILL_NAMES[edge.side.fill]+' · RAL '+edge.side.ral+
        (edge.side.fill==='sheet'?'':' · зазор '+format(config.gap*100)+' см')+'.</p>';
    }
    description+='<p>Периметр активных сторон: <b>'+format(layout.perimeter)+' м</b>. '+
      'Пролётов: <b>'+layout.totalSpans+'</b>; металлических столбов: <b>'+
      layout.posts.length+'</b> ('+config.postSize+'×'+config.postSize+' мм). Угловые столбы не дублируются.</p>';
    if(layout.warnings.length) description+='<p class="kd3d-unpriced">'+layout.warnings.join(' ')+'</p>';
    description+='<p class="kd3d-unpriced">Схема и количество столбов предварительные. '+
      'Без проёмов, производственного раскроя, прочностной проверки и расчёта стоимости.</p>';
    parts.innerHTML=description;
    find('[data-picket-settings]').hidden=!['picket','picket-double','horizontal','horizontal-double'].includes(activeSettings().fill);
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
    const selected=activeSettings();
    // Legacy keys retained for older locally saved drafts and existing integrations.
    for(const key of ['length','height','step','fill','ral']) config[key]=selected[key];
    const layout=summary();
    saveDraft(config);
    if(!webglOk)return;
    clearGeometry();
    const postWidth=config.postSize/1000;
    const paintedPost=new THREE.Color(RAL[config.sides.A.ral]).multiplyScalar(.88);
    const postMat=new THREE.MeshStandardMaterial({color:paintedPost,metalness:.19,roughness:.49});
    previousMaterials.push(postMat);
    const capGeometry=buildPostCapGeometry(postWidth);
    previousLineGeometries.push(capGeometry);
    for(const p of layout.posts){
      const h=p.height+.10;
      frameGeometry(fence,base,postWidth,h,postWidth,p.x,h/2,p.z,postMat);
      frameGeometry(fence,base,postWidth+.013,.012,postWidth+.013,p.x,h+.006,p.z,postMat);
      const cap=new THREE.Mesh(capGeometry,postMat);
      cap.position.set(p.x,h+.012,p.z);
      fence.add(cap);
    }
    for(const edge of layout.edges){
      const side=edge.side;
      const fillMat=new THREE.MeshStandardMaterial({
        color:RAL[side.ral],metalness:.22,roughness:.43,side:THREE.DoubleSide
      });
      previousMaterials.push(fillMat);
      const group=new THREE.Group();
      const dx=edge.end.x-edge.start.x,dz=edge.end.z-edge.start.z;
      group.rotation.y=-Math.atan2(dz,dx);
      group.position.set((edge.start.x+edge.end.x)/2,0,(edge.start.z+edge.end.z)/2);
      fence.add(group);
      const start=-side.length/2,actualSpan=edge.span,count=edge.count;
      const railY=side.height>2.15?[.32,side.height/2,side.height-.32]:
        [.33,Math.max(.52,side.height-.33)];
      const frontPickets=[],rearPickets=[],horizontalPickets=[],rearHorizontalPickets=[];
      const isPicket=FILL_IDS.includes(side.fill);
      for(let i=0;i<count;i++){
        const mid=start+(i+.5)*actualSpan;
        const width=Math.max(.2,actualSpan-postWidth-.035);
        if(side.fill==='sheet'){
          const geometry=buildC10Geometry(width,side.height-.12);
          previousLineGeometries.push(geometry);
          const panel=new THREE.Mesh(geometry,fillMat);
          panel.position.set(mid,.06,.015);
          panel.receiveShadow=true;
          group.add(panel);
          railY.forEach(y=>frameGeometry(group,base,width,.04,.02,mid,y,-.005,postMat));
        }else if(side.fill==='jalousie'){
          const rows=Math.max(1,Math.floor((side.height-.12)/.14));
          for(let n=0;n<rows;n++)
            frameGeometry(group,base,width,.11,.026,mid,.13+n*.14,0,fillMat);
        }else if(side.fill==='horizontal'||side.fill==='horizontal-double'){
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
        }else if(isPicket){
          railY.forEach(y=>frameGeometry(group,base,width,.04,.02,mid,y,-.008,postMat));
          if(side.fill==='picket-double')
            railY.forEach(y=>frameGeometry(group,base,width,.04,.02,mid,y,-.078,postMat));
          const plank=.12,gap=config.gap;
          const n=Math.max(1,Math.floor((width+gap)/(plank+gap)));
          const occupied=n*plank+(n-1)*gap;
          const firstX=mid-occupied/2+plank/2;
          for(let k=0;k<n;k++)
            frontPickets.push({x:firstX+k*(plank+gap),y:.065,z:.005});
          if(side.fill==='picket-double')
            for(let k=0;k<n-1;k++)
              rearPickets.push({x:firstX+(k+.5)*(plank+gap),y:.065,z:-.09});
        }
      }
      if(frontPickets.length||rearPickets.length){
        const geo=buildPicketGeometry(side.height-.13);
        previousLineGeometries.push(geo);
        instancePickets(group,geo,fillMat,frontPickets,0);
        instancePickets(group,geo,fillMat,rearPickets,Math.PI);
      }
      if(horizontalPickets.length||rearHorizontalPickets.length){
        const geo=buildPicketGeometry(Math.max(.2,actualSpan-postWidth-.035),true);
        previousLineGeometries.push(geo);
        instancePickets(group,geo,fillMat,horizontalPickets,0);
        instancePickets(group,geo,fillMat,rearHorizontalPickets,Math.PI);
      }
    }
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
  for (const input of root.querySelectorAll('[data-field]')) {
    input.addEventListener('change',()=>{
      const field=input.dataset.field;
      const selected=activeSettings();
      if(field==='fill') selected.fill=FILL_IDS.includes(input.value)?input.value:selected.fill;
      else if(field==='postSize') config.postSize=[60,80,100].includes(Number(input.value))?Number(input.value):config.postSize;
      else if(field==='gap') config.gap=numeric(input.value,2,12,config.gap*100)/100;
      else if(field==='ral') selected.ral=Object.hasOwn(RAL,input.value)?input.value:selected.ral;
      else selected[field]=numeric(input.value,
        field==='length'?1:field==='height'?.8:1,
        field==='length'?60:3,selected[field]);
      input.value=field==='gap'?Number((config.gap*100).toFixed(1)):
        field==='postSize'?config.postSize:selected[field];
      updateModel();
      if(field==='length'||field==='height')fit();
      if(field==='ral')syncSwatches();
    });
  }
  find('[data-sides]').addEventListener('click',event=>{
    const toggle=event.target.closest('[data-side-toggle]');
    if(toggle){
      const side=config.sides[toggle.dataset.sideToggle];
      if(!side)return;
      side.enabled=!side.enabled;
      updateModel();
      resize();
      fit();
      return;
    }
    const button=event.target.closest('[data-side]');
    if(!button||!config.sides[button.dataset.side])return;
    config.activeSide=button.dataset.side;
    syncSideInputs();
    updateModel();
  });
  root.querySelector('[data-fit]').addEventListener('click',fit);
  root.querySelector('[data-reset]').addEventListener('click',()=>{
    Object.assign(config,DEFAULT);
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
