// Private-runtime pricing proposals, not a live provider. No business rates.
// A trusted runtime must select the approved bundle and installation scope.
// Never infer a decorative design, a support specification or a rate.
import {PROFILE_FENCE_DEFAULTS,profileFencePlan} from '../surveyor-app/v2-profile-fence.js';
import {artFencePlan} from '../surveyor-app/v2-art-fences.js';
const money=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=10000000;
const rate=(obj,key)=>{const v=obj?.[key];if(!money(v))throw Error('Нет утверждённой ставки: '+key);return v};
const revision=(b,kind,policy)=>{
 if(b?.kind!==kind||b.approved!==true||b.policy!==policy||typeof b.revision!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(b.revision))throw Error('Нет утверждённой тарифной модели');
 return b.revision;
};
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
function result(kind,rev,configuration,product,posts,installation,extra={}){
 const total=product+posts+installation;
 if(![product,posts,installation,total].every(v=>Number.isSafeInteger(v)&&v>=0)||total<=0)throw Error('Некорректная стоимость');
 return {version:1,kind,tariffRevision:rev,configuration,prices:{product,posts,installation,total},...extra,deliveryPending:true,canIssue:false,canReleaseProduction:false};
}
export function privateProfileFenceQuote(input,bundle,{installationScope}={}){
 const rev=revision(bundle,'profileFence','profile-fence-v1');
 if(!['included','excluded'].includes(installationScope))throw Error('Уточните, входит ли монтаж');
 const s={...PROFILE_FENCE_DEFAULTS};
 for(const k of Object.keys(s))if(Object.hasOwn(input??{},k))s[k]=input[k];
 const q=profileFencePlan(s);
 if(!q.plan||q.errors.length)throw Error(q.errors.join(' ')||'Проверьте комплектацию');
 const p=q.plan;
 if(Number(s.gateMm)+Number(s.wicketMm)>0||p.openingPosts>0)throw Error('Узлы проёмов пока не оценены');
 const rule=bundle.technical;
 // Fixed technical policy for the matching fence; no client-defined norms
 // may enter a trusted monetary calculation without a matching approval.
 if(!rule||rule.sheetMode!==s.sheetMode||rule.post!==s.post||
    !['fullMm','workingMm','rails','screwsPerSheet','kerfMm'].every(k=>Number(s[k])===rule[k]&&Number.isSafeInteger(rule[k]))||
    !integer(rule.minHeightMm,500,2300)||!integer(rule.maxHeightMm,rule.minHeightMm,2300)||
    Number(s.heightMm)<rule.minHeightMm||Number(s.heightMm)>rule.maxHeightMm)throw Error('Не утверждены технические нормы для выбранного забора');
 if(!s.includeNewPosts&&Number(s.existingPostsCount)!==p.posts)throw Error('Подтвердите число готовых опор');
 const r=bundle.rates,markup=rate(r,'productMarkupPercent');
 if(markup>1000)throw Error('Проверьте наценку');
 // These are explicit proposed pricing units, not legacy picket formulas.
 // Rails purchased in 6m lengths, sheets by purchased m2, screws by count.
 // Posts are a finished retail unit (no additional material markup).
 const metal=p.tubeStocks*6*rate(r,'railPerM'),sheet=p.purchaseAreaM2*rate(r,'sheetPerM2'),screws=p.screws*rate(r,'screwEach');
 const fabrication=Number(s.lengthMm)/1000*rate(r,'fabricationPerM');
 const railFinish=p.tubeUsedM*rate(r,'railFinishPerM');
 const product=Math.round((metal+sheet+screws+fabrication+railFinish)*(1+markup/100));
 const posts=p.newPosts?Math.round(p.newPosts*rate(r,'finishedPostEach')):0;
 const installation=installationScope==='included'?Math.round(Number(s.lengthMm)/1000*rate(r,'installPerM')+(p.newPosts?p.newPosts*rate(r,'postInstallEach'):0)):0;
 return result('profileFence',rev,s,product,posts,installation,{installationScope});
}
export function privateArtFenceQuote(input,bundle){
 const rev=revision(bundle,'artFences','exact-section-sku-v1'),q=artFencePlan(input);
 if(!q.plan||q.errors.length)throw Error(q.errors.join(' ')||'Проверьте секции');
 const p=q.plan,s=p.configuration;
 if(!s.article)throw Error('Выберите утверждённый артикул секции');
 // Only an exact approved SKU. No area scaling, no copied gate formula.
 const matches=Array.isArray(bundle.models)?bundle.models.filter(x=>x?.approved===true&&x.article===s.article&&x.widthMm===s.sectionWidthMm&&x.heightMm===s.heightMm&&x.fill===s.fill&&x.paint===s.paint):[];
 if(matches.length!==1)throw Error('Нет однозначной утверждённой цены этой секции');
 const sku=matches[0];
 if(typeof sku.designRevision!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(sku.designRevision)||!money(sku.retailEach)||sku.retailEach<=0)throw Error('Нет утверждённой версии дизайна и цены');
 // Do not infer wall thickness from a 60/80/100 mm square dimension.
 // A trusted bundle must contain one explicit approved post specification.
 let posts=0,postProfile=null;
 if(p.newPosts){
  const support=Array.isArray(bundle.supports)?bundle.supports.filter(x=>x?.approved===true&&x.sizeMm===s.postSizeMm):[];
  if(support.length!==1||typeof support[0].profile!=='string'||!new RegExp('^'+s.postSizeMm+'x'+s.postSizeMm+'x[0-9]+(?:\\.[0-9]+)?$').test(support[0].profile))throw Error('Не утверждён профиль столба');
  postProfile=support[0].profile;
  posts=Math.round(p.newPosts*rate(support[0],'retailEach'));
 }
 const product=Math.round(p.count*sku.retailEach);
 const installation=s.install?Math.round(p.count*rate(sku,'installEach')+(p.newPosts?p.newPosts*rate(bundle,'postInstallEach'):0)):0;
 return result('artFences',rev,s,product,posts,installation,{designRevision:sku.designRevision,postProfile});
}
