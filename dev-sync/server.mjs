// Isolated DEV-only sync backend. Node 22+, no third-party packages.
// Run behind an HTTPS reverse proxy on a *separate* staging host.
// NEVER point its DATA_FILE at the production server or publish this as static files.
import http from 'node:http';
import {randomBytes, scryptSync, timingSafeEqual, createHash} from 'node:crypto';
import {readFile, mkdir, writeFile, rename} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';

const PORT=Number(process.env.PORT||8787);
const DATA_FILE=resolve(process.env.DATA_FILE||'./dev-sync-data/private.json');
const ORIGIN=process.env.DEV_ORIGIN||'https://bossnedvetskiy-source.github.io';
const OWNER_PASS=process.env.DEV_OWNER_PASSWORD||'';
const SURVEYOR_PASS=process.env.DEV_SURVEYOR_PASSWORD||'';
if (!OWNER_PASS || !SURVEYOR_PASS || OWNER_PASS===SURVEYOR_PASS) {
  throw new Error('Set distinct DEV_OWNER_PASSWORD and DEV_SURVEYOR_PASSWORD');
}
if (process.env.NODE_ENV==='production' && !process.env.DEV_STAGING_CONFIRMED) {
  throw new Error('DEV_STAGING_CONFIRMED required to run on a hosted server');
}
const hash=v=>createHash('sha256').update(v).digest('hex');
const passwordOk=(given,wanted)=>{
  const salt='kd-dev-isolated-v1';
  const a=scryptSync(String(given),salt,32),b=scryptSync(wanted,salt,32);
  return timingSafeEqual(a,b);
};
let state={clients:{},surveys:{},sessions:{}},chain=Promise.resolve();
try{state=JSON.parse(await readFile(DATA_FILE,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
async function persist(){
  await mkdir(dirname(DATA_FILE),{recursive:true,mode:0o700});
  const temp=DATA_FILE+'.tmp.'+randomBytes(5).toString('hex');
  await writeFile(temp,JSON.stringify(state),{mode:0o600});
  await rename(temp,DATA_FILE);
}
function serialize(fn){
  const work=chain.then(fn);chain=work.catch(()=>{});return work;
}
const json=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(body))};
const validId=s=>typeof s==='string'&&/^(?:sv|cl)_[A-Za-z0-9_-]{5,90}$/.test(s);
const userForToken=req=>{
  const token=String(req.headers.authorization||'').match(/^Bearer ([A-Za-z0-9_-]{40,160})$/)?.[1];
  const session=token?state.sessions[hash(token)]:null;
  return session&&session.expiresAt>Date.now()?session:null;
};
function syncItem(item,type,user,conflicts,acks){
  if(!item||!validId(item.id))throw Object.assign(new Error('Invalid id'),{status:400});
  const store=state[type],original=store[item.id],revision=Number(item.serverRevision)||0;
  if(original && user.role!=='owner' && original.createdBy!==user.id && type==='surveys')
    throw Object.assign(new Error('No access to survey'),{status:403});
  const updatedAt=String(item.updatedAt||'').slice(0,40);
  if(original && revision!==original.serverRevision){
    if(!(revision===0&&original.updatedAt===updatedAt)){
      conflicts.push({entity:type==='surveys'?'survey':'client',id:item.id,server:original});
      return;
    }
    acks.push(original);return;
  }
  if(type==='surveys'){
    const config=item.configuration&&typeof item.configuration==='object'?item.configuration:{};
    if(JSON.stringify(config).length>120000)throw Object.assign(new Error('Configuration too large'),{status:413});
    store[item.id]={
      id:item.id,number:original?.number||('DEV-'+Object.keys(store).length.toString().padStart(5,'0')),
      clientId:String(item.clientId||''),clientName:String(item.clientName||'').slice(0,120),
      clientPhone:String(item.clientPhone||'').slice(0,60),address:String(item.address||'').slice(0,500),
      note:String(item.note||'').slice(0,5000),workTypes:Array.isArray(item.workTypes)?item.workTypes:[],
      configuration:config,status:item.status==='ready'?'ready':'draft',
      archived:user.role==='owner'?Boolean(item.archived):Boolean(original?.archived),
      createdBy:original?.createdBy||user.id,
      createdByName:original?.createdByName||user.name,
      createdAt:original?.createdAt||new Date().toISOString(),
      updatedAt,serverUpdatedAt:new Date().toISOString(),
      serverRevision:(original?.serverRevision||0)+1
    };
  }else{
    store[item.id]={
      id:item.id,name:String(item.name||'').slice(0,120),phone:String(item.phone||'').slice(0,60),
      address:String(item.address||'').slice(0,500),
      updatedAt,serverUpdatedAt:new Date().toISOString(),
      serverRevision:(original?.serverRevision||0)+1
    };
  }
  acks.push(store[item.id]);
}
const server=http.createServer(async(req,res)=>{
  if(req.headers.origin===ORIGIN){
    res.setHeader('access-control-allow-origin',ORIGIN);
    res.setHeader('vary','Origin');
    res.setHeader('access-control-allow-methods','POST, OPTIONS');
    res.setHeader('access-control-allow-headers','content-type, authorization');
  }
  if(req.method==='OPTIONS')return res.writeHead(req.headers.origin===ORIGIN?204:403).end();
  if(req.method!=='POST'||!req.url?.startsWith('/api/surveyor/'))return json(res,404,{error:'Not found'});
  if(req.headers.origin&&req.headers.origin!==ORIGIN)return json(res,403,{error:'Origin denied'});
  try{
    let raw='';
    for await(const part of req){raw+=part;if(raw.length>524288)throw Object.assign(new Error('Payload too large'),{status:413})}
    const body=JSON.parse(raw||'{}'),path=req.url.slice('/api/surveyor/'.length);
    if(path==='login'){
      const username=String(body.username||'').toLowerCase();
      const candidate=username==='admin'?'owner':username==='zamer'?'surveyor':null;
      const password=candidate==='owner'?OWNER_PASS:SURVEYOR_PASS;
      if(!candidate||!passwordOk(body.password||'',password))return json(res,401,{error:'Invalid credentials'});
      const token=randomBytes(48).toString('base64url');
      const user={id:'dev:'+candidate,name:candidate==='owner'?'Руководитель DEV':'Замерщик DEV',role:candidate};
      await serialize(async()=>{state.sessions[hash(token)]={...user,expiresAt:Date.now()+7*864e5};await persist()});
      return json(res,200,{token,user});
    }
    const user=userForToken(req);
    if(!user)return json(res,401,{error:'Login required'});
    if(path==='sync'){
      return await serialize(async()=>{
        const before=JSON.stringify(state);
        try{
          const acks={clients:[],surveys:[]},conflicts=[];
          for(const item of (Array.isArray(body.clients)?body.clients:[]).slice(0,200))syncItem(item,'clients',user,conflicts,acks.clients);
          for(const item of (Array.isArray(body.surveys)?body.surveys:[]).slice(0,200))syncItem(item,'surveys',user,conflicts,acks.surveys);
          await persist();
          // Full accessible snapshot: staging queues are intentionally small.
          const pull={
            clients:Object.values(state.clients),
            surveys:Object.values(state.surveys).filter(x=>user.role==='owner'||x.createdBy===user.id)
          };
          return json(res,200,{ok:true,serverNow:new Date().toISOString().replace('T',' ').slice(0,19),
            acks,conflicts,pull,user:{id:user.id,name:user.name,role:user.role}});
        }catch(e){state=JSON.parse(before);throw e}
      });
    }
    return json(res,404,{error:'Not found'});
  }catch(e){return json(res,e.status||500,{error:e.status?e.message:'Internal server error'})}
});
server.listen(PORT,'127.0.0.1',()=>console.log('DEV surveyor sync listening on localhost:'+PORT));
