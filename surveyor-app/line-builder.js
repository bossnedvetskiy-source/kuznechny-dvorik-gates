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


/**
 * Prepare a sketch from already priced variants, without inventing the position
 * of openings. Never touch any saved plan or change a calculator/price.
 * In fence drawings, posts are schematic (a physical survey still decides
 * foundations and whether posts at different lines are shared).
 */
export function planFromCalculations(selected = []) {
  const lines = [];
  const skipped = [];
  const gates = selected.filter(c => c?.type === 'gates');
  const fences = selected.filter(c => c?.type === 'fence');
  for (const quote of gates) {
    const p = quote.payload || {};
    const width = Number(p.width ?? p.configuration?.width);
    const height = Number(p.height ?? p.configuration?.height) || 1.8;
    const wicketWidth = Number(p.wicketWidth ?? p.configuration?.wicketWidth) || 0;
    if (!(width > 0)) {
      skipped.push('У ворот не сохранена ширина: добавьте их в схему вручную.');
      continue;
    }
    const status = p.posts ? 'new' : 'existing';
    const post = () => ({...newItem('post'),state:status});
    const gate = {...newItem('gate'),width,height,material:'forged',sourceCalculationId:quote.id,sourceKind:'gate'};
    const items = [post(),gate,post()];
    if (wicketWidth > 0) {
      items.push({...newItem('wicket'),width:wicketWidth,height:Number(p.wicketHeight ?? p.configuration?.wicketHeight)||height,
        material:'forged',sourceCalculationId:quote.id,sourceKind:'wicket'});
      items.push(post());
    }
    lines.push({...newLine([],lines.length),name:'Ворота и калитка',items});
  }
  for (const quote of fences) {
    const config = quote.payload?.configuration || {};
    const sections = Array.isArray(config.sections) ? config.sections : [];
    sections.forEach((section,index) => {
      const length = Number(section.length);
      if (!(length > 0)) return;
      if (Number(section.gateOpening) > 0 || Number(section.wicketOpening) > 0) {
        skipped.push('Участок забора '+(index+1)+': есть проёмы. Укажите их расположение вручную, чтобы не дублировать ворота.');
        return;
      }
      const post = () => ({...newItem('post'),state:config.includeNewPosts === false ? 'existing' : 'new'});
      const material = String(config.fenceType||'').startsWith('horizontal') ? 'euro_horizontal' : 'euro_vertical';
      const spans = Math.max(1,Math.ceil(length/2.5));
      const width = Math.round(length / spans * 1000) / 1000;
      const items = [post()];
      for(let k=0;k<spans;k++){
        const segmentWidth = k===spans-1 ? Math.round((length-width*(spans-1))*1000)/1000 : width;
        items.push({...newItem('fence'),width:segmentWidth,
          height:Number(section.height)||1.8,material,sourceCalculationId:quote.id,
          sourceSectionIndex:index,sourceKind:'fence',sourceOriginalLength:length});
        items.push(post());
      }
      lines.push({...newLine([],lines.length),name:'Забор · участок '+(index+1),items});
    });
  }
  return {sitePlan:lines.length ? {version:2,source:'calculations',lines}:null,skipped};
}

// Return a warning for every linked element whose size no longer matches its
// saved calculation. This is informational; the sketch is never overwritten
// when a quote changes in a different screen.
export function planDifferences(sitePlan, selected = []) {
  const byId = new Map(selected.map(item=>[item.id,item]));
  const groups = new Map();
  const differences = [];
  for (const line of sitePlan?.lines || []) {
    for(const item of line.items || []) {
      if (!item.sourceCalculationId) continue;
      const quote = byId.get(item.sourceCalculationId);
      if (!quote) {
        differences.push('Элемент схемы связан с удалённым или исключённым расчётом.');
        continue;
      }
      const p = quote.payload || {};
      let expectedWidth;
      let expectedHeight;
      if(item.sourceKind==='gate') {
        expectedWidth=Number(p.width ?? p.configuration?.width);
        expectedHeight=Number(p.height ?? p.configuration?.height);
      } else if(item.sourceKind==='wicket') {
        expectedWidth=Number(p.wicketWidth ?? p.configuration?.wicketWidth);
        expectedHeight=Number(p.wicketHeight ?? p.configuration?.wicketHeight);
      } else if(item.sourceKind==='fence') {
        const section=p.configuration?.sections?.[item.sourceSectionIndex];
        if (!section || Number(section.gateOpening)>0 || Number(section.wicketOpening)>0) {
          differences.push('Участок забора изменился: проверьте проёмы и ширину схемы.');
          continue;
        }
        expectedWidth=Number(section.length);
        expectedHeight=Number(section.height);
        const key=item.sourceCalculationId+':'+item.sourceSectionIndex;
        const group=groups.get(key)||{sum:0,expected:expectedWidth};
        group.sum+=Number(item.width)||0;
        groups.set(key,group);
      }
      if(item.sourceKind!=='fence' && Number.isFinite(expectedWidth)
          && Math.abs((Number(item.width)||0)-expectedWidth)>0.01) {
        differences.push('Размер ворот или калитки на схеме отличается от сохранённого расчёта.');
      }
      if(Number.isFinite(expectedHeight) && Math.abs((Number(item.height)||0)-expectedHeight)>0.01) {
        differences.push('Высота элемента на схеме отличается от сохранённого расчёта.');
      }
    }
  }
  for (const group of groups.values()) {
    if(Number.isFinite(group.expected) && Math.abs(group.sum-group.expected)>0.02){
      differences.push('Суммарная длина пролётов забора отличается от расчёта.');
    }
  }
  return [...new Set(differences)];
}


/** Apply newly saved sizes to previously linked sketch elements. Positions,
 * post statuses and unrelated/manual elements are retained. */
export function updateLinkedPlanSizes(plan, selected = []) {
  const updated = structuredClone(plan);
  const byId = new Map(selected.map(item=>[item.id,item]));
  const groups = new Map();
  let changed = 0;
  const skipped = [];
  for (const line of updated.lines || []) {
    for(const item of line.items || []) {
      if (!item.sourceCalculationId || item.type==='post') continue;
      const quote=byId.get(item.sourceCalculationId);
      if (!quote) {skipped.push('Связанный расчёт больше не включён в смету.');continue;}
      const p=quote.payload||{};
      if (item.sourceKind === 'fence') {
        const sec=p.configuration?.sections?.[item.sourceSectionIndex];
        if(!sec || Number(sec.gateOpening)>0 || Number(sec.wicketOpening)>0 || !(Number(sec.length)>0)) {
          skipped.push('Участок с проёмами обновите вручную, чтобы сохранить порядок ворот.');
          continue;
        }
        const key=item.sourceCalculationId+':'+item.sourceSectionIndex;
        const entry=groups.get(key)||{items:[],section:sec};
        entry.items.push(item);groups.set(key,entry);
        continue;
      }
      const gate=item.sourceKind==='gate';
      const width=Number(gate?(p.width??p.configuration?.width):(p.wicketWidth??p.configuration?.wicketWidth));
      const height=Number(gate?(p.height??p.configuration?.height):(p.wicketHeight??p.configuration?.wicketHeight));
      if(Number.isFinite(width)&&width>0 && Math.abs(width-item.width)>0.001){item.width=width;changed++;}
      if(Number.isFinite(height)&&height>0 && Math.abs(height-item.height)>0.001){item.height=height;changed++;}
    }
  }
  for (const {items,section} of groups.values()){
    const widthTotal=Number(section.length),height=Number(section.height);
    if (!Number.isFinite(widthTotal)||widthTotal<=0||!items.length) continue;
    const one=Math.round(widthTotal/items.length*1000)/1000;
    for(let index=0;index<items.length;index++){
      const item=items[index];
      const width=index===items.length-1?Math.round((widthTotal-one*(items.length-1))*1000)/1000:one;
      if(Math.abs(item.width-width)>0.001){item.width=width;changed++;}
      if(Number.isFinite(height)&&height>0&&Math.abs(item.height-height)>0.001){item.height=height;changed++;}
    }
    if(widthTotal/items.length>2.5){
      skipped.push('Пролёт забора стал длиннее 2,5 м. Добавьте столб и разделите пролёт на схеме.');
    }
  }
  return {sitePlan:updated,changed,skipped:[...new Set(skipped)]};
}


/** Split a fence span by adding one real support in its middle.
 * Never change the total measured length or source quote reference. */
export function splitFenceWithPost(items, fenceId) {
  const index=items.findIndex(item=>item.id===fenceId);
  const fence=items[index];
  if(!fence || fence.type!=='fence') return {ok:false,reason:'Выберите пролёт забора.'};
  const width=Number(fence.width);
  if(!Number.isFinite(width)||width<0.4) return {ok:false,reason:'Слишком короткий пролёт для разделения. Уточните размеры.'};
  const half=Math.round(width*500)/1000;
  const nextWidth=Math.round((width-half)*1000)/1000;
  const post={...newItem('post')};
  const copy=items.map(item=>({...item}));
  copy.splice(index,1,{...fence,width:half},post,{...fence,id:planId('fence'),width:nextWidth});
  return {ok:true,items:copy,postId:post.id};
}

/** Remove a redundant support only when the drawn load path is still valid.
 * Two adjacent fence spans become one, but never exceed the 2.5m limit.
 * Terminal supports and posts between a gate / wicket cannot be removed. */
export function removePostFromLine(items, postId) {
  const index=items.findIndex(item=>item.id===postId);
  if(index<0 || items[index]?.type!=='post') return {ok:false,reason:'Столб не найден.'};
  const before=items[index-1],after=items[index+1];
  const copy=items.map(item=>({...item}));
  if(before?.type==='post'||after?.type==='post'){
    copy.splice(index,1);
    return {ok:true,items:copy};
  }
  if(before?.type==='fence' && after?.type==='fence'){
    if(before.material!==after.material || Math.abs((Number(before.height)||0)-(Number(after.height)||0))>.01
      || before.sourceCalculationId!==after.sourceCalculationId || before.sourceSectionIndex!==after.sourceSectionIndex){
      return {ok:false,reason:'Это граница разных участков или материалов. Проверьте схему вручную.'};
    }
    const combined=Math.round(((Number(before.width)||0)+(Number(after.width)||0))*1000)/1000;
    if(combined>2.5+0.0001) return {ok:false,reason:'Без столба пролёт будет '+trimNumber(combined)+' м. Максимум — 2,5 м.'};
    copy.splice(index-1,3,{...before,width:combined});
    return {ok:true,items:copy};
  }
  if(!before||!after) return {ok:false,reason:'Крайний столб нужен для опоры. Если он уже стоит, отметьте «Уже стоит».'};
  return {ok:false,reason:'Этот столб поддерживает ворота, калитку или разделяет разные элементы. Если он готовый, отметьте «Уже стоит».'};
}
