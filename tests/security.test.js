import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApplication } from '../server/server.js';
const data=await mkdtemp(join(tmpdir(),'drakon-secure-test-'));
let app,base;
const open=async()=>{app=await createApplication({data,seed:fileURLToPath(new URL('./fixtures/',import.meta.url)),allowHTTP:true});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+app.server.address().port;};
const call=async(path,{cookie='',body,method=body?'POST':'GET',origin=base,headers={}}={})=>fetch(base+path,{method,headers:{cookie,...(body?{'content-type':'application/json','x-requested-with':'drakon-secure',origin}:{}),...headers},body:body?JSON.stringify(body):undefined});
const cookieOf=r=>r.headers.get('set-cookie').split(';')[0];
try{
 await open();await app.setPassword('test-password-long-2026');
 for(const path of ['/api/content','/participants.json','/houses.json','/site.json','/assets/houses/fire.webp','/assets/audio/d2.mp3','/assets/img/d1.jpg'])assert.equal((await call(path)).status,401,path);
 for(const path of ['/server/data/config.json','/data/config.json','/README.md','/.env','/assets/img/../../participants.json','/p/test1/'])assert.ok([401,403,404].includes((await call(path)).status),path);
 assert.equal((await call('/api/enter',{body:{token:'test1'}})).status,401);
 assert.equal((await call('/api/login',{body:{password:'test-password-long-2026'},origin:'https://attacker.invalid'})).status,403);
 const login=await call('/api/login',{body:{password:'test-password-long-2026'}});assert.equal(login.status,200);assert.match(login.headers.get('set-cookie'),/HttpOnly/);const admin=cookieOf(login);
 let c=await call('/api/content',{cookie:admin}).then(r=>r.json());assert.equal(c.role,'admin');assert.ok(!c.offline);const code=c.participants.people[0].code,id=c.participants.people[0].id,invite=c.invites[code];assert.match(invite,/^[A-Za-z0-9]{12}$/);
 const enter=await call('/api/enter',{body:{token:invite}});assert.equal(enter.status,200);let participant=cookieOf(enter);
 const view=await call('/api/content',{cookie:participant}).then(r=>r.json());assert.equal(view.role,'participant');assert.equal(view.me.id,id);assert.ok(!JSON.stringify(view).includes(invite));assert.ok(!view.invites);assert.ok(!JSON.stringify(view).includes('test1'));assert.ok(view.participants.people.length>0);
 assert.equal((await call('/api/invitations',{cookie:participant})).status,403);
 assert.equal((await call('/api/site',{cookie:participant,method:'PUT',body:c.site})).status,403);
 assert.equal((await call('/api/draw',{cookie:participant,body:{code:'other',houseId:'fire'}})).status,403);
 assert.equal((await call('/assets/houses/fire.webp',{cookie:participant})).status,200);
 assert.equal((await call('/api/upload',{cookie:admin,body:{dir:'img',name:'x.svg',data:Buffer.from('<svg/>').toString('base64')}})).status,400);
 const bad=structuredClone(c.participants);bad.people[0].id='" onmouseover="x';assert.equal((await call('/api/participants',{cookie:admin,method:'PUT',body:bad})).status,400);
 // Session survives a server process lifecycle.
 await new Promise(r=>app.server.close(r));await open();assert.equal((await call('/api/content',{cookie:participant})).status,200);
 assert.equal((await call('/api/invitations',{cookie:admin,body:{id,action:'rotate'}})).status,200);
 assert.equal((await call('/api/content',{cookie:participant})).status,401);assert.equal((await call('/api/enter',{body:{token:invite}})).status,401);
 c=await call('/api/content',{cookie:admin}).then(r=>r.json());participant=cookieOf(await call('/api/enter',{body:{token:c.invites[code]}}));
 assert.equal((await call('/api/logout',{cookie:participant,body:{}})).status,200);assert.equal((await call('/api/content',{cookie:participant})).status,401);
 await app.setPassword('a-new-long-password-2026');assert.equal((await call('/api/content',{cookie:admin})).status,401);
 const secureApp=await createApplication({data,origin:'https://secure.example',allowHTTP:false});await new Promise(r=>secureApp.server.listen(0,'127.0.0.1',r));
 const secureLogin=await fetch('http://127.0.0.1:'+secureApp.server.address().port+'/api/login',{method:'POST',headers:{'content-type':'application/json','x-requested-with':'drakon-secure',origin:'https://secure.example'},body:JSON.stringify({password:'a-new-long-password-2026'})});assert.match(secureLogin.headers.get('set-cookie'),/^__Host-.*; Secure$/);await new Promise(r=>secureApp.server.close(r));
 console.log('PASS: anonymous access, raw files, invitation secrecy, roles, CSRF, media authorization, XSS inputs, persistent sessions, revoke/rotate/logout/password change, Secure cookies');
}finally{if(app?.server.listening)await new Promise(r=>app.server.close(r));for(const name of await readdir(data))await unlink(join(data,name));await rmdir(data);}

