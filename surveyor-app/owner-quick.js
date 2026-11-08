// DEV owner-only sandbox: calculate sliding gates before creating a survey.
// Customer price uses the SAME pure function as the surveyor calculator.
// Owner costs are ephemeral session inputs, never added to public quotes.
import {calculateSlidingQuote} from './sliding-gates/pricing.js';
import {buildSlidingProduction,SLIDING_RATE_FIELDS,slidingRateKey} from './owner-sliding.js';

const STATE_KEY='kd-owner-quick-calculation-v1';
const RATE_KEY='kd-owner-quick-rates-v1';
const ID='owner_quick';
const BASE={
  width:4,height:2,frame:'prof',tail:'square',picket:'single',
  fill:true,paint:true,auto:false,install:true,stand:true,bolts:true,
  distance:0,discount:0,builtInWicket:false,builtInWidth:1,
  builtInMode:'center',builtInOffset:0
};
const SAMPLE={
  rollers:12000,sheet:600,picket:130,weldGate:5000,
  paintMaterial:200,painter:200,cladding:3000,bolts:500,delivery:0,
  automation:20000
};
const money=n=>Number.isFinite(n)?new Intl.NumberFormat('ru-RU').format(Math.round(n))+' ₽':'—';
const qty=n=>Number.isFinite(n)?new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n):'—';
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const select=(label,key,options)=>'<label class="ownerq-field"><span>'+label+'</span><select data-oq-field="'+key+'">'+
  options.map(x=>'<option value="'+x[0]+'">'+safe(x[1])+'</option>').join('')+'</select></label>';
const input=(label,key,min,step)=>'<label class="ownerq-field"><span>'+label+'</span><input data-oq-field="'+key+'" type="number" min="'+min+'" step="'+step+'" inputmode="decimal"></label>';
const check=(label,key)=>'<label class="ownerq-check"><input data-oq-field="'+key+'" type="checkbox"><span>'+label+'</span></label>';
const pill=(label,value)=>'<span class="ownerq-pill">'+safe(label)+': <b>'+safe(value)+'</b></span>';
const row=(k,v)=>'<div class="ownerq-row"><span>'+safe(k)+'</span><strong>'+safe(v)+'</strong></div>';

function sketch(c,p){
  const g=p.geometry;if(!g)return '';
  const left=18,top=15,bottom=116,scale=340/g.full,head=left+g.tail*scale,right=left+g.full*scale;
  const bar=(a,b,d,e,cls='')=>'<line x1="'+a+'" y1="'+b+'" x2="'+d+'" y2="'+e+'" class="'+cls+'"/>';
  let svg=bar(left,bottom,right,bottom)+bar(head,top,right,top)+bar(right,top,right,bottom)+bar(head,top,head,bottom);
  if(c.tail==='square')svg+=bar(left,top,left,bottom)+bar(left,top,head,bottom)+bar(left,bottom,head,top)+bar(left,top,head,top);
  else svg+=bar(left,bottom,head,top)+bar(left,bottom,(left+head)/2,top+50);
  const station=c.frame==='jalousie'?2:Math.ceil(Number(c.width));
  for(let i=1;i<station;i++){
    const dx=head+i*Number(c.width)*scale/station;
    const l=p.wicket?.left,wr=p.wicket?.width;
    if(p.wicket && Number.isFinite(l)&&dx>head+l*scale-2&&dx<head+(l+wr)*scale+2)continue;
    svg+=bar(dx,top+6,dx,bottom-6,'thin');
  }
  if(p.wicket?.valid){
    const wx=head+p.wicket.left*scale,wx2=wx+p.wicket.width*scale;
    svg+='<rect class="wicket" x="'+wx+'" y="'+(top+6)+'" width="'+(wx2-wx)+'" height="'+(bottom-top-12)+'"/>';
    if(c.frame!=='horizontal')svg+=bar(wx+5,(top+bottom)/2,wx2-5,(top+bottom)/2,'thin');
  }
  return '<svg viewBox="0 0 385 150" role="img" aria-label="Предварительный вид откатных ворот">'+
    '<g class="frame">'+svg+'</g><text x="'+((head+right)/2)+'" y="139" text-anchor="middle">Проём '+qty(Number(c.width))+' м</text></svg>';
}
function tryRead(key){try{const x=JSON.parse(sessionStorage.getItem(key)||'null');return x&&typeof x==='object'?x:null;}catch{return null;}}
function tryWrite(key,x){try{sessionStorage.setItem(key,JSON.stringify(x));}catch{}}
export function mountOwnerQuickCalculator(root,{onBack}={}){
  if(!root)return;
  const draft=tryRead(STATE_KEY)||{}, rates=tryRead(RATE_KEY)||{};
  let state={...BASE,...Object.fromEntries(Object.entries(draft).filter(([key])=>Object.hasOwn(BASE,key)))};
  let view='owner',usingSamples=false;
  root.innerHTML=[
    '<section class="ownerq" aria-label="Быстрый расчёт собственника">',
    '<div class="ownerq-head"><button type="button" class="ownerq-back" data-oq-back>← Управление</button><span class="ownerq-tag">Без создания заказа</span></div>',
    '<div class="ownerq-heading"><div class="eyebrow">КД · БЫСТРЫЙ РАСЧЁТ</div><h2>Откатные ворота</h2><p>Изменяй размеры и комплектацию. Цена и экономика пересчитываются сразу.</p></div>',
    '<div class="ownerq-modes" role="tablist" aria-label="Режим расчёта">',
      '<button type="button" data-oq-mode="owner" class="active" aria-selected="true">📊 Для собственника</button>',
      '<button type="button" data-oq-mode="client" aria-selected="false">👁 Для клиента</button>',
    '</div>',
    '<div data-oq-top></div>',
    '<section class="ownerq-panel"><h3>1. Размеры и каркас</h3>',
      '<div class="ownerq-fields">',
        input('Ширина проёма, м','width',.5,.05),
        input('Высота ворот, м','height',.5,.05),
        select('Заполнение','frame',[['prof','Профнастил'],['vertical','Евроштакетник вертикальный'],['horizontal','Евроштакетник горизонтальный'],['jalousie','Каркас под жалюзи']]),
        select('Хвостовик','tail',[['square','Квадратный'],['triangle','Треугольный']]),
        select('Тип евроштакетника','picket',[['single','Односторонний'],['double','Двусторонний']]),
      '</div>',
      '<div class="ownerq-checks">'+
        check('Заполнение','fill')+check('Покраска','paint')+
        check('Станина','stand')+check('Монтаж','install')+
        check('Болты','bolts')+check('Автоматика','auto')+
      '</div>',
    '</section>',
    '<section class="ownerq-panel"><h3>2. Дополнительные параметры</h3>',
      '<div class="ownerq-checks">'+check('Встроенная калитка','builtInWicket')+'</div>',
      '<div class="ownerq-fields" data-oq-wicket>',
        input('Ширина калитки, м','builtInWidth',.7,.05),
        select('Расположение','builtInMode',[['center','По центру'],['left','От левого края'],['right','От правого края']]),
        input('Отступ калитки, м','builtInOffset',0,.05),
      '</div>',
      '<div class="ownerq-fields">',
        input('Доставка, км','distance',0,1),
        input('Скидка клиенту, ₽','discount',0,100),
      '</div>',
    '</section>',
    '<section class="ownerq-panel"><h3>3. Предварительная схема</h3><div class="ownerq-sketch" data-oq-sketch></div></section>',
    '<div data-oq-warning></div>',
    '<div data-oq-client></div>',
    '<div data-oq-owner></div>',
    '</section>'
  ].join('');
  for(const node of root.querySelectorAll('[data-oq-field]')){
    if(node.type==='checkbox')node.checked=!!state[node.dataset.oqField];
    else node.value=state[node.dataset.oqField];
  }
  const quoteView=root.querySelector('[data-oq-client]');
  const ownerView=root.querySelector('[data-oq-owner]');
  function buildRates(){
    return '<details class="ownerq-panel ownerq-rate-editor"><summary>✏️ Настроить закупочные цены и зарплаты</summary>'+
      '<p class="ownerq-note">Тарифы сохраняются только на время текущей сессии в этом браузере. DEV не предназначен для реальных конфиденциальных закупочных данных.</p>'+
      '<button type="button" class="ownerq-demo" data-oq-demo>Подставить примерные ставки для оценки</button>'+
      '<div class="ownerq-rates">'+SLIDING_RATE_FIELDS.map(field=>{
        const key=slidingRateKey(ID,field.key),value=Object.hasOwn(rates,key)?rates[key]:(field.initial??'');
        return '<label class="ownerq-field"><span>'+safe(field.label)+'</span><input data-oq-rate="'+safe(field.key)+'" type="number" min="0" step="any" inputmode="decimal" value="'+safe(value)+'" placeholder="Указать"></label>';
      }).join('')+'</div></details>';
  }
  function refresh(){
    tryWrite(STATE_KEY,state);
    tryWrite(RATE_KEY,rates);
    root.querySelector('[data-oq-wicket]').hidden=!state.builtInWicket;
    root.querySelector('[data-oq-field="builtInOffset"]').closest('.ownerq-field').hidden=state.builtInMode==='center';
    root.querySelector('[data-oq-field="picket"]').closest('.ownerq-field').hidden=state.frame!=='vertical';
    const q=calculateSlidingQuote(state);
    const p=buildSlidingProduction({id:ID,type:'sliding',payload:{configuration:state}},rates);
    root.querySelector('[data-oq-sketch]').innerHTML=sketch(state,q);
    root.querySelector('[data-oq-warning]').innerHTML=(q.errors||[]).concat(p.valid?[]:[p.reason||'Проверь размеры']).map(x=>'<div class="ownerq-error">'+safe(x)+'</div>').join('');
    const price=q.total;
    root.querySelector('[data-oq-top]').innerHTML='<div class="ownerq-price"><small>Цена для клиента</small><strong>'+money(price)+'</strong>'+
      '<span>'+qty(Number(state.width))+' × '+qty(Number(state.height))+' м · '+safe(state.frame==='prof'?'Профнастил':state.frame==='jalousie'?'Каркас под жалюзи':'Евроштакетник')+'</span></div>';
    quoteView.innerHTML='<section class="ownerq-panel"><h3>Состав цены · клиенту</h3>'+
      (price===null?'<p>Проверь размеры и комплектацию.</p>':q.rows.filter(x=>x[1]!==0).map(x=>row(x[0],money(x[1]))).join(''))+
      '<p class="ownerq-note">Клиент видит только итог и состав предложения. Себестоимость и зарплаты не показываются.</p></section>';
    const cost=p.valid?p.calculatedCost:null;
    const profit=price!==null&&cost!==null?price-cost:null;
    ownerView.querySelector('[data-oq-finance]').innerHTML=
      '<section class="ownerq-finance-grid">'+
      '<div><small>Цена клиенту</small><strong>'+money(price)+'</strong></div>'+
      '<div><small>Себестоимость</small><strong>'+money(cost)+'</strong></div>'+
      '<div><small>Предварительная прибыль</small><strong>'+money(profit)+'</strong></div>'+
      '<div><small>Рентабельность продаж</small><strong>'+(profit!==null&&price>0?(100*profit/price).toFixed(1)+' %':'—')+'</strong></div></section>'+
      (usingSamples?'<p class="ownerq-error">Использованы ПРИМЕРНЫЕ ставки, а не проверенные закупочные цены. Результат только для оценки.</p>':'')+
      (p.valid&&p.missing.length?'<p class="ownerq-error">Для прибыли не хватает тарифов: '+safe(p.missing.join(', '))+'. Открой «Настроить цены и зарплаты» ниже.</p>':'')+
      '<section class="ownerq-panel"><h3>Материалы и производство</h3>'+
      (p.valid?'<div class="ownerq-pills">'+[
        pill('60×40×2',qty(p.tube60)+' м / '+p.stocks60+' хлыстов'),
        pill('20×20×1,5',qty(p.tube20)+' м / '+p.stocks20+' хлыстов'),
        pill('Окраска',qty(p.area)+' м²'),
        pill('Профнастил',p.sheets+' листов'),
        pill('Штакетник',p.pickets+' + '+p.sparePickets+' запас')
      ].join('')+'</div>'+
      p.rows.map(x=>row(x.label+' · '+qty(x.qty),x.cost===null?'Нет тарифа':money(x.cost))).join('')+
      '<p class="ownerq-note">Металл в шестиметровых хлыстах округлён по видам профиля, без оптимизированной карты раскроя. Прибыль предварительная, до налогов и непредвиденных затрат.</p>':'Проверь исходные размеры.')+
      '</section>';
  }
  function setView(next){
    view=next;
    for(const button of root.querySelectorAll('[data-oq-mode]')){
      const active=button.dataset.oqMode===view;button.classList.toggle('active',active);
      button.setAttribute('aria-selected',String(active));
    }
    quoteView.hidden=view!=='client';
    ownerView.hidden=view!=='owner';
    if(view==='owner'&&!ownerView.querySelector('[data-oq-finance]')){
      ownerView.innerHTML='<div data-oq-finance></div>'+buildRates();
    }
    refresh();
  }
  root.addEventListener('input',event=>{
    const el=event.target.closest('[data-oq-field],[data-oq-rate]');
    if(!el)return;
    if(el.dataset.oqField){
      const key=el.dataset.oqField;state[key]=el.type==='checkbox'?el.checked:el.type==='number'?(el.value===''?NaN:Number(el.value)):el.value;
      if(key==='frame'&&el.value==='jalousie'){
        state.fill=false;root.querySelector('[data-oq-field="fill"]').checked=false;
      }
    } else if(el.dataset.oqRate){
      const key=slidingRateKey(ID,el.dataset.oqRate);
      if(el.value.trim()==='')delete rates[key];
      else rates[key]=Number(el.value);
      usingSamples=false;
    }
    refresh();
  });
  root.addEventListener('change',event=>{
    if(event.target.matches('select[data-oq-field]'))refresh();
  });
  root.addEventListener('click',event=>{
    const mode=event.target.closest('[data-oq-mode]');
    if(mode){setView(mode.dataset.oqMode);return;}
    if(event.target.closest('[data-oq-back]')){onBack?.();return;}
    if(event.target.closest('[data-oq-demo]')){
      for(const [key,value] of Object.entries(SAMPLE)){
        rates[slidingRateKey(ID,key)]=value;
        const node=root.querySelector('[data-oq-rate="'+key+'"]');if(node)node.value=value;
      }
      usingSamples=true;refresh();
    }
  });
  setView('owner');
}
