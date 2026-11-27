// Build a phone acceptance copy of the real v2 shell under the existing DEV Pages origin.
// This is a synthetic-data sandbox, not a production deploy. All storage is namespaced.
import {cp,mkdir,readdir,readFile,writeFile,rm,stat} from 'node:fs/promises';
import path from 'node:path';

const source=process.argv[2],site=process.argv[3];
if(!source||!site)throw new Error('Usage: node build-kd-v2-phone.mjs <surveyor-app> <existing _site>');
const out=path.join(site,'kd-v2');
const base='/kuznechny-dvorik-gates/kd-v2/';
const prefix='kd-v2-phone-demo:';
const dbName='kd-v2-phone-demo-v1';
const cacheName='kd-v2-phone-demo-shell-'+String(process.env.KD_V2_SOURCE_SHA||'local').slice(0,40);
function replaceRequired(text,old,next,name){
  if(!text.includes(old))throw new Error('Missing expected source marker: '+name);
  return text.replace(old,next);
}
if(!(await stat(path.join(site,'index.html'))).isFile())throw new Error('DEV site must be built first');
await rm(out,{recursive:true,force:true});
await cp(source,out,{recursive:true});
// Do not expose any additional prototype pages or old app service-worker launchers.
await rm(path.join(out,'v2-shell-preview.html'),{force:true});
const read=name=>readFile(path.join(out,name),'utf8');
const write=(name,text)=>writeFile(path.join(out,name),text,'utf8');
let app=await read('app.js');
app=replaceRequired(app,"const DB_NAME = 'kd-surveyor-stage1';","const DB_NAME = '"+dbName+"';",'separate database');
app=replaceRequired(app,"const API_ENABLED = !IS_PREVIEW || Boolean(DEV_API_URL);","const API_ENABLED = false;",'disable API');
app=replaceRequired(app,"const API_BASE = IS_PREVIEW ? DEV_API_URL : '/api/surveyor';","const API_BASE = '';",'empty API base');
app=replaceRequired(app,"const DEV_API_SETTING = String(window.KD_DEV_SURVEYOR_API || '').trim().replace(/\\/$/, '');","const DEV_API_SETTING = '';",'ignore API injection');
const start=app.indexOf('function v2LocalPreviewEnabled() {'),end=app.indexOf('\n// Local opt-in editor:',start);
if(start<0||end<0)throw new Error('Cannot isolate v2 preview mode');
app=app.slice(0,start)+"function v2LocalPreviewEnabled() { return !API_ENABLED; }\n"+app.slice(end);
app=replaceRequired(app,"function launchCalculation(type, options = {}) {","function launchCalculation(type, options = {}) {\n  if(type!=='sliding'){showToast('В этой телефонной копии старые внешние калькуляторы отключены; доступны в локальной сборке.');return;}",'block cross-app routes');
app=replaceRequired(app,"const url=new URL('../naves/admin.html',location.href);","const url=new URL('./',location.href);showToast('Админ-калькулятор в телефонной копии отключён');return;",'block external admin route');
await write('app.js',app);
let html=await read('index.html');
html=replaceRequired(html,'<head>','<head>\n<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' \'unsafe-inline\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob:; font-src \'self\' data:; connect-src \'none\'; worker-src \'self\' blob:; object-src \'none\'; base-uri \'none\'; form-action \'none\'">','phone CSP');
html=html.replace('<title>КД Замерщик</title>','<title>КД Управление 2.0 · тест</title>').replace('<h1>КД Замерщик</h1>','<h1>КД Управление 2.0</h1>');
html=replaceRequired(html,'<p class="muted">Замеры, клиенты и заказы — в одном приложении, даже без связи.</p>','<p class="muted">Телефонная тестовая копия · отдельная локальная база. Не вводите данные реальных клиентов. Серверная синхронизация отключена.</p>','test-only notice');
await write('index.html',html);
const manifest=JSON.parse(await read('manifest.webmanifest'));
Object.assign(manifest,{name:'КД Управление 2.0 · тест',short_name:'КД 2.0 тест',id:base,start_url:base,scope:base});
await write('manifest.webmanifest',JSON.stringify(manifest,null,2)+'\n');
let sw=await read('sw.js');
sw=sw.replace(/const CACHE = '[^']+';/,"const CACHE = "+JSON.stringify(cacheName)+";");
sw=replaceRequired(sw,"k.startsWith('kd-surveyor-')","k.startsWith('kd-v2-phone-demo-shell-')",'separate cache cleanup');
// Cache only own files and public, read-only dependencies. Never respond with an old DEV shell.
sw=replaceRequired(sw,"if (event.request.method !== 'GET') return;","if (event.request.method !== 'GET') return;\n  if(new URL(event.request.url).origin!==self.location.origin)return;",'scope fetch');
await write('sw.js',sw);
// A Storage wrapper changes only this copy, including the old sliding editor.
// Each module or inline script gets its own local adapter. No global Storage patch.
const wrapper="const phoneStore=(store)=>({getItem:key=>store.getItem("+JSON.stringify(prefix)+"+String(key)),setItem:(key,value)=>store.setItem("+JSON.stringify(prefix)+"+String(key),value),removeItem:key=>store.removeItem("+JSON.stringify(prefix)+"+String(key))});\nconst phoneLocalStorage=phoneStore(globalThis.localStorage),phoneSessionStorage=phoneStore(globalThis.sessionStorage);\n";
function wrapStorage(text){
  if(!/\b(?:localStorage|sessionStorage)\b/.test(text))return text;
  const transformed=text.replace(/\b(?:window|globalThis|self)\s*\.\s*(localStorage|sessionStorage)\b/g,'$1').replace(/\b(localStorage|sessionStorage)\b/g,(_,k)=>k==='localStorage'?'phoneLocalStorage':'phoneSessionStorage');
  return wrapper+transformed;
}
async function isolate(dir){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const p=path.join(dir,entry.name);
    if(entry.isDirectory()){await isolate(p);continue}
    if(entry.name.endsWith('.js')&&entry.name!=='sw.js'){
      const text=await readFile(p,'utf8');
      await writeFile(p,wrapStorage(text),'utf8');
    }else if(entry.name.endsWith('.html')){
      let text=await readFile(p,'utf8');
      text=text.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi,(_,open,code,close)=>open+wrapStorage(code)+close);
      if(entry.name==='index.html'&&dir!==out){
        text=text.replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' \'unsafe-inline\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob:; connect-src \'none\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'">');
      }
      await writeFile(p,text,'utf8');
    }
  }
}
await isolate(out);
// Root DEV worker must not take over the new route or use old cache fallbacks.
const rootSw=path.join(site,'site-sw.js');
let root=await readFile(rootSw,'utf8');
root=replaceRequired(root,"  const url=new URL(request.url);","  const url=new URL(request.url);\n  if(url.pathname==="+JSON.stringify(base.slice(0,-1))+"||url.pathname.startsWith("+JSON.stringify(base)+"))return;",'DEV root worker exclusion');
await writeFile(rootSw,root,'utf8');
await write('KD-V2-TEST.txt','Test-only local data; no server API; distinct database and cache; legacy external calculators intentionally unavailable.\nSource: '+String(process.env.KD_V2_SOURCE_SHA||'local')+'\n');
console.log('Phone sandbox ready:',base,dbName,cacheName);
