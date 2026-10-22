// Side-first mobile editor for the DEV 3D surveyor.
// Shares the existing config object with the advanced editors; no price engine.
const escapeAttr=value=>String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;')
  .replace(/</g,'&lt;').replace(/>/g,'&gt;');
const viewNumber=value=>Number.isFinite(Number(value))?String(Number(value)):'0';

export function createCompactSideEditor({root,config,sideIds,sideNames,subtitles,
  fillIds,fillLabels,ral,normalizeOpenings,onSelectSide,onEdit,onDetails}){
  const gallery=root.querySelector('[data-view-gallery]');
  if(!gallery)throw new Error('3D gallery missing for compact controls');
  gallery.insertAdjacentHTML('afterend',
    '<section class="kd3d-compact" data-compact-editor aria-label="Быстрое редактирование участка">'+
    '<div class="kd3d-compact-head"><div><strong>Настроить участок</strong>'+
    '<small>Сторона → изделие → параметры</small></div>'+
    '<button type="button" data-compact-details aria-label="Все настройки выбранного элемента">Все настройки ↗</button></div>'+
    '<div class="kd3d-compact-side-tabs" data-compact-side-tabs role="group" aria-label="Выберите сторону участка"></div>'+
    '<div class="kd3d-compact-kind-tabs" data-compact-kind-tabs role="group" aria-label="Выберите элемент участка"></div>'+
    '<div class="kd3d-compact-body" data-compact-body></div></section>');
  const panel=root.querySelector('[data-compact-editor]');
  const sideTabs=panel.querySelector('[data-compact-side-tabs]');
  const kindTabs=panel.querySelector('[data-compact-kind-tabs]');
  const body=panel.querySelector('[data-compact-body]');
  const kinds=[['fence','Забор'],['gate','Ворота'],['wicket','Калитка']];
  let currentSide=sideIds.includes(config.activeSide)?config.activeSide:sideIds[0];
  let currentKind='fence';
  const numberField=(title,key,value,min,max,step='0.1')=>
    '<label class="kd3d-compact-field"><span>'+title+'</span>'+
    '<span class="kd3d-compact-number"><input data-compact-field="'+key+
    '" aria-label="'+title+'" type="number" inputmode="decimal" min="'+min+
    '" max="'+max+'" step="'+step+'" value="'+escapeAttr(viewNumber(value))+'">'+
    '<small>м</small></span></label>';
  const selectField=(title,key,options,current)=>
    '<label class="kd3d-compact-field kd3d-compact-wide"><span>'+title+'</span>'+
    '<select data-compact-field="'+key+'" aria-label="'+title+'">'+
    options.map(([value,label])=>'<option value="'+escapeAttr(value)+'"'+
      (String(value)===String(current)?' selected':'')+'>'+label+'</option>').join('')+
    '</select></label>';
  const segmented=(title,key,options,current)=>
    '<div class="kd3d-compact-segment kd3d-compact-wide"><span>'+title+'</span>'+
    '<div role="group" aria-label="'+title+'">'+
    options.map(([value,label])=>'<button type="button" data-compact-setting="'+key+
      '" data-compact-value="'+value+'" aria-pressed="'+String(value===current)+'">'+
      label+'</button>').join('')+'</div></div>';
  function render(){
    // External editors and 3D picking can change the active side.
    currentSide=sideIds.includes(config.activeSide)?config.activeSide:sideIds[0];
    const side=config.sides[currentSide];
    const product=config.openings[currentSide]?.[currentKind];
    sideTabs.innerHTML=sideIds.map(id=>
      '<button type="button" data-compact-side="'+id+'" aria-pressed="'+
      String(currentSide===id)+'" aria-label="Сторона '+sideNames[id]+', '+subtitles[id]+
      (config.sides[id].enabled?'':' — отключена')+'">'+
      '<strong>'+sideNames[id]+'</strong><small>'+subtitles[id]+'</small>'+
      '<span class="kd3d-compact-side-dot'+(config.sides[id].enabled?' is-on':'')+'"></span>'+
      '</button>').join('');
    kindTabs.innerHTML=kinds.map(([key,title])=>
      '<button type="button" data-compact-kind="'+key+'" aria-pressed="'+
      String(key===currentKind)+'">'+title+'</button>').join('');
    panel.dataset.compactSelection=currentSide+':'+currentKind;
    const headline='<div class="kd3d-compact-current"><strong>Сторона '+sideNames[currentSide]+
      ' · '+subtitles[currentSide]+'</strong>'+
      '<span>'+escapeAttr(viewNumber(side.length))+' м</span></div>';
    if(!side.enabled){
      body.innerHTML=headline+
        '<div class="kd3d-compact-empty"><p>Сторона отключена. Включите её для настройки забора, ворот и калитки.</p>'+
        '<button type="button" data-compact-action="enable-side">+ Включить сторону '+sideNames[currentSide]+'</button></div>';
      return;
    }
    if(currentKind==='fence'){
      body.innerHTML=headline+
        '<div class="kd3d-compact-grid">'+
        numberField('Длина стороны', 'length',side.length,1,60)+
        numberField('Высота забора','height',side.height,.8,3)+
        selectField('Материал стороны','fill',
          fillIds.map(id=>[id,fillLabels[id]]),side.fill)+
        selectField('Цвет RAL','ral',Object.keys(ral).map(code=>[code,code]),side.ral)+
        '</div><p class="kd3d-compact-help">Материал и цвет применяются только к стороне '+
        sideNames[currentSide]+'. Дополнительные параметры — в полных настройках.</p>';
      return;
    }
    const title=currentKind==='gate'?'Ворота':'Калитка';
    if(!product?.enabled){
      body.innerHTML=headline+
        '<div class="kd3d-compact-empty"><p>'+title+
        ' на этой стороне ещё не добавлены.</p>'+
        '<button type="button" data-compact-action="enable-product">+ Добавить '+
        (currentKind==='gate'?'ворота':'калитку')+'</button></div>';
      return;
    }
    const maxWidth=currentKind==='gate'?(product.type==='sliding'?5:6):1.5;
    const minWidth=currentKind==='gate'?2:.7;
    const maxOffset=Math.max(0,side.length-product.width);
    const controls=
      (currentKind==='gate'?segmented('Тип ворот','type',
        [['swing','Распашные'],['sliding','Откатные']],product.type):'')+
      '<div class="kd3d-compact-grid">'+
      numberField('Ширина '+(currentKind==='gate'?'ворот':'калитки'),
        'width',product.width,minWidth,maxWidth)+
      numberField('Отступ от начала стороны','offset',product.offset,0,maxOffset)+
      selectField('Заполнение','fill',
        [['side','Как у забора'],...fillIds.map(id=>[id,fillLabels[id]])],product.fill)+
      (currentKind==='gate'&&product.type==='sliding'?
        selectField('Направление отката','slideDirection',
          [['left','Влево'],['right','Вправо']],product.slideDirection):
        selectField('Открывание','openDirection',
          [['inward','Внутрь участка'],['outward','Наружу участка']],product.openDirection))+
      (currentKind==='wicket'?
        selectField('Петли калитки','hingeSide',
          [['left','Слева'],['right','Справа']],product.hingeSide):'')+
      '</div>'+
      segmented('Положение в 3D','preview',
        [['closed','Закрыто'],['open','Открыто']],
        (currentKind==='gate'&&product.type==='sliding'?product.slideOpen:product.swingOpen)?
          'open':'closed')+
      '<p class="kd3d-compact-help">Отступ отсчитывается от начала стороны '+
      sideNames[currentSide]+' до края проёма. Изменения сразу видны на модели.</p>';
    body.innerHTML=headline+controls;
  }
  function chooseSide(id){
    if(!sideIds.includes(id))return;
    currentSide=id;
    config.activeSide=id;
    onSelectSide(id);
    render();
  }
  function chooseKind(kind){
    if(!kinds.some(k=>k[0]===kind))return;
    currentKind=kind;
    render();
  }
  function updateSetting(key,value){
    const side=config.sides[currentSide];
    const item=config.openings[currentSide]?.[currentKind];
    let geometryChanged=false;
    if(currentKind==='fence'){
      if(key==='length'){side.length=clamp(value,1,60,side.length);geometryChanged=true;}
      else if(key==='height'){side.height=clamp(value,.8,3,side.height);geometryChanged=true;}
      else if(key==='fill'&&fillIds.includes(value))side.fill=value;
      else if(key==='ral'&&Object.prototype.hasOwnProperty.call(ral,value))side.ral=value;
      else return;
    }else{
      if(!item?.enabled)return;
      if(key==='width'){
        item.width=clamp(value,currentKind==='gate'?2:.7,
          currentKind==='gate'&&item.type==='sliding'?5:currentKind==='gate'?6:1.5,item.width);
        geometryChanged=true;
      }else if(key==='offset'){
        item.offset=clamp(value,0,Math.max(0,side.length-item.width),item.offset);
        geometryChanged=true;
      }else if(key==='type'&&currentKind==='gate'){
        item.type=value==='sliding'?'sliding':'swing';geometryChanged=true;
      }else if(key==='fill'&&(value==='side'||fillIds.includes(value)))item.fill=value;
      else if(key==='openDirection')item.openDirection=value==='outward'?'outward':'inward';
      else if(key==='slideDirection'&&currentKind==='gate')
        item.slideDirection=value==='left'?'left':'right';
      else if(key==='hingeSide'&&currentKind==='wicket')
        item.hingeSide=value==='right'?'right':'left';
      else if(key==='preview'){
        if(currentKind==='gate'&&item.type==='sliding')item.slideOpen=value==='open';
        else item.swingOpen=value==='open';
      }else return;
      config.openings=normalizeOpenings(config.sides,config.openings,config.gate);
    }
    config.activeSide=currentSide;
    onEdit(currentSide,{geometryChanged});
    render();
  }
  const clamp=(value,min,max,fallback)=>{
    const n=Number(String(value).replace(',','.'));
    return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
  };
  panel.addEventListener('click',event=>{
    const side=event.target.closest('[data-compact-side]');
    if(side){chooseSide(side.dataset.compactSide);return;}
    const kind=event.target.closest('[data-compact-kind]');
    if(kind){chooseKind(kind.dataset.compactKind);return;}
    const setting=event.target.closest('[data-compact-setting]');
    if(setting){updateSetting(setting.dataset.compactSetting,setting.dataset.compactValue);return;}
    const action=event.target.closest('[data-compact-action]');
    if(action){
      if(action.dataset.compactAction==='enable-side'){
        config.sides[currentSide].enabled=true;
      }else if(action.dataset.compactAction==='enable-product'&&currentKind!=='fence'){
        config.sides[currentSide].enabled=true;
        config.openings[currentSide][currentKind].enabled=true;
      }else return;
      onEdit(currentSide,{geometryChanged:true});
      render();
    }
  });
  panel.addEventListener('change',event=>{
    const field=event.target.closest('[data-compact-field]');
    if(field)updateSetting(field.dataset.compactField,field.value);
  });
  panel.querySelector('[data-compact-details]').addEventListener('click',()=>{
    config.activeSide=currentSide;
    onDetails(currentSide,currentKind);
  });
  render();
  return {refresh:render,select(side,kind){chooseSide(side);chooseKind(kind);},
    getSelection:()=>({side:currentSide,kind:currentKind})};
}
