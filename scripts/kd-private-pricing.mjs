// Private-runtime preparation only. Not a deployed endpoint, not auth.
// The caller is responsible for authorization, approved tariff storage and revision lookup.
// This module contains no real rates and must not receive them in a browser.
import {swingFramePlan} from '../surveyor-app/v2-swing-frame.js';
import {makeSwingQuote} from '../surveyor-app/simple-gate-quote.js';
import {picketSiteQuote} from '../surveyor-app/v2-picket-quote.js';
export function fullSwingPricingInput(draft){
 const p=swingFramePlan(draft);
 if(p.errors.length)throw Error(p.errors.join(' '));
 const d=p.configuration;
 if(!p.quoteInput||d.product!=='set'||!p.workbookGeometry)throw Error('Отдельное изделие или другая диагональ: тарифная модель не утверждена');
 if(!d.hinges||!d.lock||!d.bolts)throw Error('Excel включает полный комплект фурнитуры: выберите петли, замок и засовы либо дождитесь отдельного расчёта');
 if(d.posts)throw Error('Для комплекта выберите столбы только в разделе услуг');
 if(p.rearNeedsJoin)throw Error('Требуется согласовать стыковку задней закрывашки');
 return p.quoteInput;
}
function revision(bundle,kind){
 if(!bundle||bundle.kind!==kind||bundle.approved!==true||typeof bundle.revision!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(bundle.revision)||!bundle.rates)throw Error('Нет утверждённого набора тарифов');
 return bundle.revision;
}
// Only the customer price crosses the adapter. The private rate bundle must be
// selected server-side, not submitted in an estimate request by a client.
export function calculatePrivateSwing(draft,bundle){
 const rev=revision(bundle,'frames'),input=fullSwingPricingInput(draft);
 const {customer}=makeSwingQuote(input,bundle.rates,{role:'surveyor',revision:rev});
 return {kind:'frames',status:'calculated',quote:customer,deliveryPending:true,canIssue:false,canReleaseProduction:false};
}
export function calculatePrivatePickets(draft,bundle){
 const rev=revision(bundle,'pickets');
 if(draft?.version!==2||!draft.sides||Array.isArray(draft.sides))throw Error('Требуется нормализованный черновик сторон');
 const q=picketSiteQuote(draft.sides,draft.corners||{},bundle.rates);
 // The existing formula does not price opening supports or opening hardware.
 // Do not misrepresent a partial fence as the full product price.
 if(q.quantities.openingPosts>0)throw Error('Опоры проёмов и проёмы требуют отдельного согласования');
 if(!Number.isSafeInteger(q.costs.total)||q.costs.total<=0)throw Error('Некорректная цена');
 return {kind:'pickets',status:'calculated',quote:{version:1,kind:'picketSite',tariffRevision:rev,total:q.costs.total},deliveryPending:true,canIssue:false,canReleaseProduction:false};
}
