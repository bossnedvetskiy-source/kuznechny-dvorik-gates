(() => {
'use strict';
const $=id=>document.getElementById(id), G=window.TrussGeometry;
function tz(g){
 const lines=[
 'ТЗ СВАРЩИКУ — АРОЧНАЯ ФЕРМА',
 'Ширина по столбам: '+G.mm(g.widthPostsM)+' мм',
 'Ширина фермы: '+G.mm(g.widthM)+' мм',
 'Подъём дуги: '+G.mm(g.riseM)+' мм',
 'Высота фермы: '+G.mm(g.heightM)+' мм',
 'Пояса: '+g.chordProfile,
 'Решётка: '+g.webProfile,
 'Ферм: '+g.trussCount+' шт.','',
 'P1 Верхний пояс: '+G.mm(g.topCircle.length)+' мм × 1',
 'P2 Нижний пояс: '+G.mm(g.lowerTotalM)+' мм × 1',
 'V Торцевые стойки: '+G.mm(g.endPostM)+' мм × 2'
 ];
 g.diagonals.forEach(d=>lines.push('D'+d.index+': '+G.mm(d.lengthM)+' мм, угол оси '+G.fmt(d.angleDeg,1)+'°'));
 lines.push('','Перед серийной резкой изготовить одну контрольную ферму по шаблону.');
 return lines.join('\n');
}
function download(){
 const g=window.__TRUSS_CURRENT;if(!g?.ok)return;
 const source=window.TrussDrawing.serialize($('trussSvg'));
 const blob=new Blob([source],{type:'image/svg+xml;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='ferma-'+G.mm(g.widthM)+'-'+G.mm(g.riseM)+'-'+G.mm(g.heightM)+'.svg';
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
}
async function copy(){
 const g=window.__TRUSS_CURRENT;if(!g?.ok)return;
 const button=$('copyTz'),old=button.textContent;
 try{
  await navigator.clipboard.writeText(tz(g));
  button.textContent='ТЗ скопировано ✓';
 }catch{
  button.textContent='Копирование недоступно';
 }
 setTimeout(()=>button.textContent=old,1600);
}
$('downloadSvg').addEventListener('click',download);
$('printPdf').addEventListener('click',()=>window.print());
$('copyTz').addEventListener('click',copy);
})();