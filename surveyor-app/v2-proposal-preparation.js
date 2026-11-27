import {basketLine,readBasket} from './v2-basket.js';
import {PRODUCT_TYPES} from './v2-product-editor.js';
import {ART_GATE_CATALOG} from './v2-art-gates.js';
// Internal preparation only. Contract approval and release are NOT implemented here.
const yn=v=>v?'Да':'Нет';
const mm=(w,h)=>w+' × '+h+' мм';
const opening=(g,w)=>'Ворота '+g+' мм; калитка '+w+' мм (0 — нет)';
const fillNames={none:'Без заполнения',sheet:'Профнастил',vertical:'Вертикальный штакетник',horizontal:'Горизонтальный штакетник',prof:'Профнастил',jalousie:'Жалюзи'};
const fill=v=>fillNames[v]||v;
function specs(kind,d){
 switch(kind){
 case 'artGates':return [['Артикул',d.article],['Ворота',mm(d.dimensions.gateWidthMm,d.dimensions.gateHeightMm)],['Калитка',mm(d.dimensions.wicketWidthMm,d.dimensions.wicketHeightMm)],['Новые усиленные столбы',yn(d.options.posts)],['Монтаж',yn(d.options.installation)]];
 case 'artFences':return [['Модель',d.article||'Не выбрана'],['Секции',d.count+' × '+mm(d.sectionWidthMm,d.heightMm)],['Заполнение',d.fill==='sheet'?'Профнастил':'Открытая ковка'],['Опоры',({existing:'Готовые',new:'Новые',mixed:'Смешанные'})[d.supportMode]],['Покраска',yn(d.paint)],['Монтаж',yn(d.install)]];
 case 'frames':return [['Изделие',({set:'Комплект',gate:'Ворота',wicket:'Калитка'})[d.product]],...(d.product!=='wicket'?[['Ворота',mm(d.gateWidthMm,d.gateHeightMm)]]:[]),...(d.product!=='gate'?[['Калитка',mm(d.wicketWidthMm,d.wicketHeightMm)],['Тип калитки',d.wicketType==='builtIn'?'Встроенная':'Отдельная']]:[]),['Профиль каркаса',d.profile],['Заполнение',fill(d.fill)],['Покраска',yn(d.paint)],['Петли / замок / засовы (выбор)',[d.hinges,d.lock,d.bolts].map(yn).join(' / ')],['Вариант установки',d.installation]];
 case 'sliding':return [['Проём',mm(d.widthMm,d.heightMm)],['Хвостовик',d.tail==='square'?'Квадратный':'Треугольный'],['Тип каркаса',fill(d.frame)],['Заполнение',yn(d.fill&&d.frame!=='jalousie')],['Встроенная калитка',d.builtInWicket?d.builtInWidthMm+' мм':'Нет'],['Покраска',yn(d.paint)],['Автоматика',yn(d.auto)],['Монтаж',yn(d.install)]];
 case 'pickets':return Object.entries(d.sides).flatMap(([id,s])=>[['Сторона '+id,mm(s.lengthMm,s.heightMm)],['Заполнение '+id,({'vertical-single':'Вертикальный односторонний','vertical-double':'Вертикальная шахматка','horizontal-double':'Горизонтальная шахматка'})[s.type]],['Опоры '+id,s.post],['Проёмы '+id,opening(s.gateMm,s.wicketMm)],['Подгонка зазора '+id,yn(s.fit)]]);
 case 'profileFence':return [['Участок',mm(d.lengthMm,d.heightMm)],['Укладка',d.sheetMode==='continuous'?'Столбы сзади':'Между столбами'],['Лист, полная / рабочая ширина',d.fullMm+' / '+d.workingMm+' мм'],['Столбы',d.post],['Прожилины на пролёт',d.rails],['Проёмы',opening(d.gateMm,d.wicketMm)]];
 case 'canopy':return [['Размер по опорам',mm(d.widthMm,d.lengthMm)],['Высота столбов над землёй',d.visibleHeightMm+' мм'],['Кровля',d.coverage],['Ферма',d.trussType],['Профиль',d.materialMode],['Покраска',yn(d.paint)],['Столбы',yn(d.postsNeeded)],['Установка опор',d.installType]];
 }
 return [];
}
export function prepareProposal(items){
 const rows=readBasket(items);
 if(!Array.isArray(items)||!rows.length||rows.length!==items.length)throw Error('Проверьте все изделия черновика');
 const lines=rows.map(row=>{
  const q=basketLine(row.kind,row.draft);
  const imageName=row.kind==='artGates'?ART_GATE_CATALOG.find(r=>r.article===q.draft.article)?.images[0]||null:null;
  return {id:row.id,kind:row.kind,title:PRODUCT_TYPES.find(p=>p.id===row.kind).label,summary:q.summary,details:specs(row.kind,q.draft),imageName,priceRub:null,warning:q.warning};
 });
 return {version:1,status:'internalDraft',lines,totalRub:null,canIssue:false,canReleaseProduction:false,checks:['Подтвердить цену каждого изделия по действующим тарифам','Уточнить цвет, покрытие и направление открывания, где применимо','Проверить общие опоры, монтаж и доставку','Согласовать размеры и комплектацию с клиентом','Заключить договор и зафиксировать его версию перед выпуском ТЗ']};
}
export function mountProposalPreparation(root,items){
 root.replaceChildren();
 let p;try{p=prepareProposal(items)}catch(e){root.textContent=e.message;return}
 const intro=document.createElement('p');intro.textContent='Внутренний лист комплектации. Не коммерческое предложение, не производственное задание.';root.append(intro);
 for(const line of p.lines){
  const section=document.createElement('section');section.className='kd-v2-card';section.dataset.proposalLine=line.id;
  const title=document.createElement('h3');title.textContent=line.title;section.append(title);
  if(line.imageName){const image=document.createElement('img');image.src='../catalog/'+line.imageName;image.onerror=()=>{image.onerror=null;image.src='../assets/catalog/'+line.imageName};image.alt=line.summary;image.loading='lazy';image.style.cssText='display:block;max-width:100%;max-height:180px;object-fit:contain';section.append(image)}
  for(const [name,value] of line.details){const row=document.createElement('p');row.textContent=name+': '+value;section.append(row)}
  if(line.warning){const w=document.createElement('p');w.textContent=line.warning;section.append(w)}
  const price=document.createElement('p');price.textContent='Цена не подтверждена';section.append(price);root.append(section)
 }
 const summary=document.createElement('div');summary.dataset.proposalChecks='';const heading=document.createElement('h3');heading.textContent='Перед оформлением';summary.append(heading);
 for(const check of p.checks){const row=document.createElement('p');row.textContent='• '+check;summary.append(row)}
 const status=document.createElement('p');status.dataset.proposalStatus='';status.textContent='Итог не рассчитан. Выпуск КП и ТЗ заблокирован.';summary.append(status);root.append(summary);
}
