export const PLAN_ITEM_TYPES = {
  post: {label:'Столб', short:'Столб'},
  fence: {label:'Пролёт забора', short:'Забор'},
  gate: {label:'Ворота', short:'Ворота'},
  wicket: {label:'Калитка', short:'Калитка'},
  opening: {label:'Свободный проём', short:'Проём'}
};

export const MATERIAL_LABELS = {
  profsheet:'Профнастил',
  euro_vertical:'Евроштакетник вертикальный',
  euro_horizontal:'Евроштакетник горизонтальный',
  forged:'Кованые',
  frame:'Каркас под зашивку'
};

export function planId(prefix='el') {
  return prefix + '_' + Date.now().toString(36) + '_' + crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
}

export function newItem(type) {
  if (type === 'post') return {id:planId('post'),type,state:'new',profile:'100×100×3'};
  if (type === 'fence') return {id:planId('fence'),type,width:2.5,height:1.8,material:'profsheet'};
  if (type === 'gate') return {id:planId('gate'),type,width:3.4,height:1.8,material:'forged',gateKind:'swing'};
  if (type === 'wicket') return {id:planId('wicket'),type,width:1,height:1.8,material:'forged'};
  return {id:planId('opening'),type:'opening',width:1};
}

export function newLine(workTypes=[], index=0) {
  const items = workTypes.includes('gates')
    ? [newItem('post'),newItem('gate'),newItem('post'),newItem('wicket'),newItem('post')]
    : [newItem('post'),newItem('fence'),newItem('post')];
  return {id:planId('line'),name:`Линия ${index+1}`,items};
}

export function ensureSitePlan(configuration, workTypes=[]) {
  const source = configuration && typeof configuration === 'object' ? structuredClone(configuration) : {};
  if (!source.sitePlan || !Array.isArray(source.sitePlan.lines) || !source.sitePlan.lines.length) {
    source.sitePlan = {version:1,lines:[newLine(workTypes,0)]};
  }
  source.sitePlan.lines = source.sitePlan.lines.map((line,index)=>({
    id:String(line?.id || planId('line')),
    name:String(line?.name || `Линия ${index+1}`).slice(0,80),
    items:Array.isArray(line?.items) && line.items.length
      ? line.items.map(normalizeItem).filter(Boolean)
      : [newItem('post'),newItem('fence'),newItem('post')]
  }));
  return source;
}

export function normalizeItem(raw) {
  if (!raw || !PLAN_ITEM_TYPES[raw.type]) return null;
  const item={...raw,id:String(raw.id || planId(raw.type)),type:raw.type};
  if (item.type === 'post') {
    item.state=item.state === 'existing' ? 'existing' : 'new';
    item.profile=['60×60×3','80×80×3','100×100×3'].includes(item.profile) ? item.profile : '100×100×3';
  } else {
    const width=Number(item.width);
    item.width=Number.isFinite(width) ? Math.max(.1,Math.min(100,width)) : 1;
    if (item.type !== 'opening') {
      const height=Number(item.height);
      item.height=Number.isFinite(height) ? Math.max(.5,Math.min(5,height)) : 1.8;
      if (!MATERIAL_LABELS[item.material]) item.material=item.type === 'fence' ? 'profsheet' : 'forged';
    }
    if (item.type === 'gate') item.gateKind=item.gateKind === 'sliding' ? 'sliding' : 'swing';
  }
  return item;
}

export function lineWidth(line) {
  return (line?.items || []).reduce((sum,item)=>sum+(item.type==='post' ? 0 : Number(item.width)||0),0);
}

export function totalPlanWidth(plan) {
  return (plan?.lines || []).reduce((sum,line)=>sum+lineWidth(line),0);
}

export function itemLabel(item) {
  if (!item) return '';
  const base=PLAN_ITEM_TYPES[item.type]?.short || item.type;
  if (item.type === 'post') return `${base}\n${item.state==='existing'?'есть':'новый'}`;
  return `${base}\n${trimNumber(item.width)} м`;
}

export function itemDescription(item) {
  if (item.type === 'post') return `${item.state==='existing'?'Существующий':'Новый'} · ${item.profile}`;
  const bits=[`${trimNumber(item.width)} × ${item.height ? trimNumber(item.height) : '—'} м`];
  if (item.type !== 'opening') bits.push(MATERIAL_LABELS[item.material] || item.material);
  if (item.type === 'gate') bits.push(item.gateKind==='sliding'?'откатные':'распашные');
  return bits.join(' · ');
}

export function trimNumber(value) {
  const n=Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('ru-RU',{maximumFractionDigits:2});
}
