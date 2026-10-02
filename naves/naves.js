(() => {
'use strict';
const $=id=>document.getElementById(id), G=window.TrussGeometry;
const inputs=['widthPosts','overhang','rise','autoRise','trussHeight','endFlat','cellStep','trussCount','chordProfile','webProfile'];
const row=(a,b)=>'<div><dt>'+a+'</dt><dd>'+b+'</dd></div>';
function raw(){return{widthPostsM:$('widthPosts').value,overhangMm:$('overhang').value,riseMm:$('rise').value,heightMm:$('trussHeight').value,endFlatMm:$('endFlat').value,cellStepMm:$('cellStep').value,trussCount:$('trussCount').value,chordProfile:$('chordProfile').value,webProfile:$('webProfile').value}}
function syncRise(){
 const r=Math.round((Number($('widthPosts').value)||3.4)*1000/6);
 $('riseHint').textContent='Рекомендуемый: '+r+' мм (ширина по столбам ÷ 6)';
 if($('autoRise').checked)$('rise').value=r;
}
function table(g){
 const q=g.trussCount;
 const rows=[
 ['P1','Верхний пояс',g.chordProfile,G.mm(g.topCircle.length),1,q,'дуга'],
 ['P2','Нижний пояс',g.chordProfile,G.mm(g.lowerTotalM),1,q,'дуга + края'],
 ['V','Торцевая стойка',g.webProfile,G.mm(g.endPostM),2,2*q,'90°']
 ];
 g.diagonals.forEach(d=>rows.push(['D'+d.index,'Диагональ '+d.index,g.webProfile,G.mm(d.lengthM),1,q,G.fmt(d.angleDeg,1)+'°']));
 $('cutTableBody').innerHTML=rows.map(r=>'<tr>'+r.map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('');
}
function summaries(g){
 $('summaryList').innerHTML=[
 row('Ширина по столбам',G.fmt(g.widthPostsM,2)+' м'),row('Ширина фермы',G.fmt(g.widthM,2)+' м'),
 row('Подъём дуги',G.mm(g.riseM)+' мм'),row('Высота фермы',G.mm(g.heightM)+' мм'),
 row('Прямой край',G.mm(g.endFlatM)+' мм'),row('Шаг узлов',G.mm(g.projectedStepM)+' мм')].join('');
 $('compositionList').innerHTML=[
 row('Верхний пояс',G.mm(g.topCircle.length)+' мм'),row('Нижний пояс',G.mm(g.lowerTotalM)+' мм'),
 row('Торцевые стойки','2 × '+G.mm(g.endPostM)+' мм'),row('Диагонали','D1…D'+g.diagonalCount),
 row('Профиль поясов',g.chordProfile),row('Профиль решётки',g.webProfile)].join('');
}
function render(){
 syncRise();
 const g=G.compute(raw()); window.__TRUSS_CURRENT=g;
 if(!g.ok){
  $('geometryWarning').hidden=false;$('geometryWarning').textContent=g.errors.join(' ');
  $('drawingStatus').textContent='проверьте размеры';
  $('trussSvg').innerHTML='<text x="600" y="300" text-anchor="middle" fill="#9b3c2d" font-size="24">Проверьте геометрию фермы</text>';
  $('summaryList').innerHTML='';$('compositionList').innerHTML='';$('cutTableBody').innerHTML='';return;
 }
 const diff=Math.abs(Number($('rise').value)-g.recommendedRiseMm);
 $('geometryWarning').hidden=diff<15;
 $('geometryWarning').textContent=diff<15?'':'Подъём отличается от рекомендации 1/6 ширины: '+Math.round(g.recommendedRiseMm)+' мм.';
 $('drawingStatus').textContent='готово';
 window.TrussDrawing.render($('trussSvg'),g);summaries(g);table(g);
}
inputs.forEach(id=>{
 $(id).addEventListener('input',()=>{if(id==='rise'&&document.activeElement===$('rise'))$('autoRise').checked=false;render()});
 $(id).addEventListener('change',render);
});
$('resetDefaults').addEventListener('click',()=>{
 $('widthPosts').value='3.4';$('overhang').value='150';$('autoRise').checked=true;$('trussHeight').value='250';
 $('endFlat').value='300';$('cellStep').value='400';$('trussCount').value='6';$('chordProfile').value='25×25×1,5';$('webProfile').value='20×20×1,5';render();
});
$('trussForm').addEventListener('submit',e=>e.preventDefault());
window.TrussApp={render};
render();
})();