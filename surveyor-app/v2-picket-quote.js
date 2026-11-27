import {picketSitePlan} from './v2-pickets.js';
// For a trusted provider or synthetic tests only. No rate constants are bundled.
// Recalculates quantities from inputs; never accepts client-supplied quantities or totals.
export function picketSiteQuote(sides,corners,rates){
 const q=picketSitePlan(sides,corners),p=q.summary;
 if(!p||!p.approved)throw Error('Сначала подтвердите раскладку без подрезки на всех сторонах');
 const keys=['picketSinglePrice','picketDoublePrice','tube40Price','post60Price','post80Price','post100Price','postMetalMarkupPercent','postPaintMarkupPercent','paintPrice','workVerticalSingle','workVerticalDouble','workHorizontalDouble','postInstallPrice','screwPrice','markupPercent','measurerPercent'];
 for(const key of keys){if(typeof rates?.[key]!=='number'||!Number.isFinite(rates[key])||rates[key]<0||rates[key]>10000000)throw Error('Нет корректного тарифа: '+key);}
 const round=x=>Math.round(Math.max(0,x));
 const profile={ '60x60x2':{rate:rates.post60Price,perimeter:.24},'80x80x3':{rate:rates.post80Price,perimeter:.32},'100x100x3':{rate:rates.post100Price,perimeter:.40}};
 const labor={'vertical-single':rates.workVerticalSingle,'vertical-double':rates.workVerticalDouble,'horizontal-double':rates.workHorizontalDouble};
 const picket=round(p.batches.reduce((n,b)=>n+(b.actualM+b.reserve*b.lengthMm/1000)*(b.coating==='single'?rates.picketSinglePrice:rates.picketDoublePrice),0));
 const tube=round(p.tubeStocks*6*rates.tube40Price);
 let postBase=0,postArea=0;
 for(const [key,count] of Object.entries(p.newPostsByProfile)){postBase+=count*3*profile[key].rate;postArea+=count*3*profile[key].perimeter;}
 const posts=round(postBase)+round(postBase*rates.postMetalMarkupPercent/100);
 const paint=round((p.tubeUsed*.12+postArea)*rates.paintPrice)+round(postArea*rates.paintPrice*rates.postPaintMarkupPercent/100);
 const work=round(Object.entries(p.laborLengthByType).reduce((n,[key,length])=>n+length*labor[key],0));
 const postInstall=round(p.newPosts*rates.postInstallPrice),screws=round(p.screws*rates.screwPrice);
 const beforeMarkup=picket+tube+posts+paint+work+postInstall+screws;
 const order=round(beforeMarkup*(1+rates.markupPercent/100)),measurer=round(order*rates.measurerPercent/100);
 // Not net profit. No opening hardware, delivery, gate leaf or foundations priced here.
 return {version:1,kind:'picketSite',quantities:p,costs:{picket,tube,posts,paint,work,postInstall,screws,beforeMarkup,order,measurer,total:order+measurer},deliveryPending:true,openingsExcluded:true,netProfit:null};
}
