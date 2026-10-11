import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'kd-dev-sync-'));
const port=19713+Math.floor(Math.random()*4000);
const url='http://127.0.0.1:'+port+'/api/surveyor/';
const origin='https://bossnedvetskiy-source.github.io';
const child=spawn(process.execPath,['dev-sync/server.mjs'],{
  cwd:process.cwd(),
  env:{...process.env,PORT:String(port),DATA_FILE:join(dir,'sync.json'),
    DEV_OWNER_PASSWORD:'owner-temporary-test',DEV_SURVEYOR_PASSWORD:'surveyor-temporary-test',
    DEV_ORIGIN:origin},
  stdio:['ignore','pipe','pipe']
});
let errors='';
child.stderr.on('data',x=>errors+=x.toString());
async function request(path,data,token='',originHeader=origin){
  const response=await fetch(url+path,{method:'POST',headers:{'content-type':'application/json',
    ...(token?{authorization:'Bearer '+token}:{}),origin:originHeader},
    body:JSON.stringify(data)});
  return {status:response.status,body:await response.json()};
}
try{
  let running=false;
  for(let i=0;i<100;i++){
    try{const r=await request('sync',{});if(r.status===401){running=true;break}}catch{}
    await delay(50);
  }
  assert(running,'DEV server failed to start: '+errors);
  const surveyor=await request('login',{username:'zamer',password:'surveyor-temporary-test'});
  const owner=await request('login',{username:'admin',password:'owner-temporary-test'});
  assert.equal(surveyor.status,200);
  assert.equal(owner.status,200);
  assert.equal((await request('login',{username:'admin',password:'incorrect'})).status,401);
  assert.equal((await request('login',{username:'admin',password:'owner-temporary-test'},'', 'https://kuzdvor.tw1.ru')).status,403);
  const token=surveyor.body.token,ownerToken=owner.body.token;
  const local={id:'sv_test12345',clientId:'',clientName:'',clientPhone:'',address:'',note:'Размер 3,4 м',
    workTypes:['canopy'],configuration:{calculations:[{id:'calc_demo',type:'canopy'}]},
    status:'draft',archived:false,updatedAt:'2026-10-11T07:00:00.000Z',serverRevision:0};
  let first=await request('sync',{since:'1970-01-01 00:00:00',clients:[],surveys:[local]},token);
  assert.equal(first.status,200);
  assert.equal(first.body.acks.surveys.length,1);
  assert.equal(first.body.acks.surveys[0].serverRevision,1);
  assert.equal(first.body.acks.surveys[0].address,'','Optional address must be preserved');
  assert.equal(first.body.pull.surveys.length,1);
  const retry=await request('sync',{clients:[],surveys:[local]},token);
  assert.equal(retry.body.acks.surveys[0].serverRevision,1,'Retried initial write must not duplicate');
  assert.equal(retry.body.pull.surveys.length,1);
  const ownerPull=await request('sync',{clients:[],surveys:[]},ownerToken);
  assert.equal(ownerPull.body.pull.surveys.length,1,'Owner sees surveyor job on second device');
  const bad={...local,note:'Concurrent edit',updatedAt:'2026-10-11T07:30:00.000Z',serverRevision:0};
  const conflict=await request('sync',{clients:[],surveys:[bad]},token);
  assert.equal(conflict.body.conflicts.length,1,'Divergent revision must be a conflict');
  assert.equal(conflict.body.acks.surveys.length,0);
  const update=await request('sync',{clients:[],surveys:[{...bad,serverRevision:1}]},token);
  assert.equal(update.body.acks.surveys[0].serverRevision,2);
  assert.equal(update.body.acks.surveys[0].note,'Concurrent edit');
  const stored=JSON.parse(await readFile(join(dir,'sync.json'),'utf8'));
  assert.equal(Object.keys(stored.surveys).length,1,'One survey despite retransmission');
  assert.equal(stored.surveys.sv_test12345.serverRevision,2);
  const s2=await request('sync',{clients:[],surveys:[{...local,id:'sv_different',serverRevision:0}]},ownerToken);
  assert.equal(s2.status,200);
  const unauthorized=await request('sync',{clients:[],surveys:[{...local,id:'sv_different',serverRevision:1}]},token);
  assert.equal(unauthorized.status,403,'Surveyor cannot edit another employee survey');
  console.log('DEV isolated sync server: login, optional fields, retries, owner visibility, conflicts, RBAC, durability OK');
}finally{
  child.kill();
  await rm(dir,{recursive:true,force:true});
}
