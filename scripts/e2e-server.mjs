import http from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {extname, join, normalize} from 'node:path';

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const delivery = await readFile(join(root, 'delivery-prices.json'), 'utf8');
const pricesJs = await readFile(join(root, 'prices.js'), 'utf8');
const priceMatch = pricesJs.match(/window\.PRICE_DATA\s*=\s*({[\s\S]*?});\s*$/);
const defaultPrices = priceMatch ? Function(`return (${priceMatch[1]})`)() : {catalogInstallation:8000,catalogPosts:25000,catalog:[],extraProducts:[]};
const mime = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.webp':'image/webp', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.svg':'image/svg+xml'
};

let adminPrices = structuredClone(defaultPrices);
let adminDelivery = JSON.parse(delivery);
let adminSite = {
  phoneDisplay:'8 937 329-67-50',phoneDigits:'79373296750',whatsappDigits:'79373296750',businessHours:'Пн–Пт, 9:00–18:00',
  serviceAreaKm:150,warrantyYears:3,productionDays:30,deliveryRate:90,heroEyebrow:'Собственное производство · Мелеуз',
  heroTitleMain:'Ворота с калиткой',heroTitleAccent:'по вашим размерам',heroText:'Тестовый текст',trustText:'Тест доверия',finalCtaTitle:'Финал',finalCtaText:'Финальный текст'
};
const adminGalleries = {
  'Арт.6':{photos:['/assets/catalog/art-6-1.webp'],positions:{},zooms:{},defaultPhotos:['/assets/catalog/art-6-1.webp'],fitMode:'contain',mediaType:'photo',customized:false,colorPhotos:{}},
  'Арт.18':{photos:['/assets/catalog/art-18-1.webp'],positions:{},zooms:{},defaultPhotos:['/assets/catalog/art-18-1.webp'],fitMode:'contain',mediaType:'photo',customized:false,colorPhotos:{}}
};
const leadRows = [
  {id:2,created_at:'2026-09-12 10:00:00',updated_at:'2026-09-12 10:00:00',status:'new',name:'Иван',phone:'+7 937 111-22-33',city:'Салават',category:'gates',source:'yandex / cpc / gates / art6',article:'Арт.6',product_title:'Ворота с калиткой',configuration:{tracking:{utmSource:'yandex',utmMedium:'cpc',utmCampaign:'gates',utmContent:'art6',utmTerm:'ворота с калиткой',yclid:'test-yclid',gclid:'',referrer:'https://yandex.ru/',landingPage:'/?utm_source=yandex'},color:'graphite'},width:3.4,wicket_width:1,wicket_height:1.8,height:1.8,install:true,posts:false,color:'Графит · RAL 7024',total:64600,client_total:64600,quote_verified:true,delivery_pending:false,delivery_out_of_area:false,delivery_distance_km:null,consent:true,consent_at:'2026-09-12 10:00:00',policy_version:'2026-09',comment:'Позвонить после 18:00',message:'Тестовая заявка'},
  {id:1,created_at:'2026-09-11 09:00:00',updated_at:'2026-09-11 09:00:00',status:'contacted',name:'Анна',phone:'+7 937 444-55-66',city:'Мелеуз',category:'gates',source:'vk / cpc / retarget',article:'Арт.18',product_title:'Ворота с калиткой',configuration:{tracking:{utmSource:'vk',utmMedium:'cpc',utmCampaign:'retarget',utmContent:'video',utmTerm:'',yclid:'',gclid:'',referrer:'',landingPage:'/'},color:''},width:3.4,wicket_width:1,wicket_height:1.8,height:1.8,install:true,posts:true,color:'',total:99000,client_total:99000,quote_verified:true,delivery_pending:false,delivery_out_of_area:false,delivery_distance_km:null,consent:true,consent_at:'2026-09-11 09:00:00',policy_version:'2026-09',comment:'',message:'Вторая заявка'}
];
const workflows = {
  2:{stage:'new',note:'',nextActionAt:'',lossReason:'',color:'Графит · RAL 7024',tracking:leadRows[0].configuration.tracking},
  1:{stage:'measurement_scheduled',note:'Замер завтра',nextActionAt:'2026-09-13T11:00',lossReason:'',color:'',tracking:leadRows[1].configuration.tracking}
};

function send(res, status, body, type='text/plain; charset=utf-8') {
  res.writeHead(status, {'content-type':type, 'cache-control':'no-store'});
  res.end(body);
}
async function bodyJson(req){let raw='';for await(const chunk of req)raw+=chunk;try{return JSON.parse(raw||'{}')}catch{return {}}}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || `127.0.0.1:${port}`}`);
  if (url.pathname === '/api/catalog-images') return send(res, 200, JSON.stringify({galleries:{}}), mime['.json']);
  if (url.pathname === '/api/leads') {
    if (req.method !== 'POST') return send(res, 405, JSON.stringify({error:'Метод не поддерживается'}), mime['.json']);
    const payload=await bodyJson(req);
    return send(res, 201, JSON.stringify({ok:true,id:1,quote:{verified:true,total:Number(payload.total)||0}}), mime['.json']);
  }
  if (url.pathname === '/api/delivery') return send(res, 502, JSON.stringify({error:'Маршрут не настроен в тестовом сервере'}), mime['.json']);

  if (url.pathname === '/api/admin/login') return send(res,200,JSON.stringify({ok:true}),mime['.json']);
  if (url.pathname === '/api/admin/logout') return send(res,200,JSON.stringify({ok:true}),mime['.json']);
  if (url.pathname === '/api/admin/catalog') return send(res,200,JSON.stringify({galleries:adminGalleries,photoUploadEnabled:true}),mime['.json']);
  if (url.pathname === '/api/admin/prices') {
    if(req.method==='POST'){const body=await bodyJson(req);adminPrices=body.prices||adminPrices;}
    return send(res,200,JSON.stringify({ok:true,prices:adminPrices}),mime['.json']);
  }
  if (url.pathname === '/api/admin/site-settings') {
    if(req.method==='POST'){const body=await bodyJson(req);adminSite=body.site||adminSite;}
    return send(res,200,JSON.stringify({ok:true,site:adminSite}),mime['.json']);
  }
  if (url.pathname === '/api/admin/delivery') {
    if(req.method==='POST'){const body=await bodyJson(req);adminDelivery=body.delivery||adminDelivery;}
    return send(res,200,JSON.stringify({ok:true,delivery:adminDelivery}),mime['.json']);
  }
  if (url.pathname === '/api/admin/leads') {
    return send(res,200,JSON.stringify({leads:leadRows,totalCount:leadRows.length,filteredTotal:leadRows.length,counts:{new:1,contacted:1,done:0,archived:0},sources:[{value:'yandex / cpc / gates / art6',count:1},{value:'vk / cpc / retarget',count:1}],page:{hasMore:false,nextBeforeId:null}}),mime['.json']);
  }
  if (url.pathname === '/api/admin/lead-workflows') {
    const ids=String(url.searchParams.get('ids')||'').split(',').map(Number);const selected={};for(const id of ids)if(workflows[id])selected[id]=workflows[id];
    return send(res,200,JSON.stringify({workflows:selected}),mime['.json']);
  }
  if (url.pathname.startsWith('/api/admin/lead-workflows/')) {
    const id=Number(url.pathname.split('/').pop());const body=await bodyJson(req);workflows[id]={...(workflows[id]||{}),...body,tracking:workflows[id]?.tracking||{},color:workflows[id]?.color||''};
    return send(res,200,JSON.stringify({ok:true,id,...workflows[id]}),mime['.json']);
  }
  if (/^\/api\/admin\/leads\/\d+$/.test(url.pathname)) return send(res,200,JSON.stringify({ok:true}),mime['.json']);
  if (url.pathname === '/api/admin/history') {
    const key=url.searchParams.get('key');const value=key==='prices'?adminPrices:key==='site_profile'?adminSite:adminDelivery;
    return send(res,200,JSON.stringify({history:[{id:1,key,savedAt:'2026-09-10 12:00:00',updatedBy:'admin',value}]}),mime['.json']);
  }
  if (url.pathname === '/api/admin/history/restore') return send(res,200,JSON.stringify({ok:true}),mime['.json']);

  try {
    if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/vorota' || url.pathname === '/vorota/') {
      let html = await readFile(join(root, 'index.html'), 'utf8');
      html = html.replace('<script id="deliveryData" type="application/json">{}</script>', `<script id="deliveryData" type="application/json">${delivery.replace(/</g,'\\u003c')}</script>`);
      html = html.replace('<script src="app.js"></script>', '<script src="runtime-price-adjustment.js"></script>\n  <script src="app.js"></script>');
      html = html.replace('<script src="gate-page-ui.js"></script>', '<script src="gate-page-ui.js"></script>\n  <script src="color-photo-site.js"></script>');
      return send(res, 200, html, mime['.html']);
    }
    if (url.pathname === '/admin' || url.pathname === '/admin/') {
      let html=await readFile(join(root,'admin.html'),'utf8');
      html=html.replace('<script src="admin.js"></script>','<script src="admin.js"></script>\n  <script src="admin-colors.js"></script>');
      html=html.replace('<script src="admin-prices.js"></script>','<script src="admin-prices.js"></script>\n  <script src="admin-site.js"></script>\n  <script src="admin-delivery.js"></script>\n  <script src="admin-leads.js"></script>\n  <script src="admin-workflow.js"></script>\n  <script src="admin-tabs-fix.js"></script>\n  <script src="admin-history.js"></script>');
      return send(res,200,html,mime['.html']);
    }
    const relative = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, '');
    const path = join(root, relative);
    if (!path.startsWith(root)) return send(res, 403, 'Forbidden');
    const info = await stat(path);
    if (!info.isFile()) return send(res, 404, 'Not found');
    return send(res, 200, await readFile(path), mime[extname(path).toLowerCase()] || 'application/octet-stream');
  } catch {
    return send(res, 404, 'Not found');
  }
});

server.listen(port, '127.0.0.1', () => console.log(`E2E server listening on http://127.0.0.1:${port}`));
