import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createRequire} from 'node:module';
import {createApplication} from '../server/server.js';import {prepareAssets} from '../server/container.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=await mkdtemp(join(tmpdir(),'drakon-prompt-'));let app,browser;
try{
 const assets=join(dir,'assets');await prepareAssets(assets);app=await createApplication({data:join(dir,'data'),assets,allowHTTP:true});await app.setPassword('prompt-test-password');await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 browser=await chromium.launch({channel:'msedge',headless:true});const admin=await browser.newPage();await admin.goto(base);await admin.locator('summary').click();await admin.locator('#adminPassword').fill('prompt-test-password');await admin.locator('#adminForm button').click();await admin.waitForFunction(()=>S.role==='admin');

 const guest=await browser.newPage();await guest.goto(base);
 assert.equal((await guest.request.post(base+'/api/app-icon',{data:{},headers:{origin:base,'x-requested-with':'drakon-secure'}})).status(),401);
 await admin.evaluate(()=>{S.siteEdit='brand';showView('contacts')});
 const initial=await guest.request.get(base+'/manifest.json').then(r=>r.json());
 const make=async size=>Buffer.from(await admin.evaluate(size=>{const c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d');ctx.fillStyle='#008899';ctx.fillRect(0,0,size,size);return c.toDataURL().split(',')[1]},size),'base64');
 await admin.locator('#appIconFile').setInputFiles({name:'bad.png',mimeType:'image/png',buffer:await make(200)});await admin.waitForFunction(()=>!document.getElementById('appIconFile').disabled);assert.match(await admin.locator('#toast').innerText(),/1024/);
 assert.deepEqual(await guest.request.get(base+'/manifest.json').then(r=>r.json()),initial);
 await admin.locator('#appIconFile').setInputFiles({name:'icon.png',mimeType:'image/png',buffer:await make(1024)});await admin.waitForFunction(()=>document.getElementById('appIconPreview').src.includes('?v=')&&!document.getElementById('appIconFile').disabled);
 const manifest=await guest.request.get(base+'/manifest.json').then(r=>r.json());assert.ok(manifest.icons[0].src.includes('?v='));assert.equal(manifest.name,initial.name);assert.equal(manifest.id,initial.id);
 for(const [name,size]of Object.entries({'favicon.png':32,'apple-touch-icon.png':180,'icon-192.png':192,'icon-512.png':512})){const response=await guest.request.get(base+'/assets/'+name);assert.equal(response.status(),200);const png=await response.body();assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);}
 const invalid=await admin.evaluate(async()=>{const r=await fetch('/api/app-icon',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({images:{512:'abc'}})});return r.status});assert.equal(invalid,400);assert.deepEqual(await guest.request.get(base+'/manifest.json').then(r=>r.json()),manifest);
 await guest.reload();await guest.waitForFunction(()=>document.querySelector('link[rel="apple-touch-icon"]').href.includes('?v='));
 await guest.evaluate(()=>navigator.serviceWorker.ready);await guest.reload();await guest.waitForFunction(()=>!!navigator.serviceWorker.controller);
 const iconURL=manifest.icons[1].src;const online=await guest.evaluate(async url=>Array.from(new Uint8Array(await fetch(url).then(r=>r.arrayBuffer()))),iconURL);await guest.context().setOffline(true);const offline=await guest.evaluate(async url=>Array.from(new Uint8Array(await fetch(url).then(r=>r.arrayBuffer()))),iconURL);assert.deepEqual(offline,online);await guest.context().setOffline(false);
 const c=await admin.evaluate(()=>fetch('/api/content').then(r=>r.json()));const token=Object.values(c.invites)[0];await guest.goto(base+'/#invite='+token);await guest.waitForFunction(()=>S.role==='participant');
 assert.equal(await guest.evaluate(async()=>{return (await fetch('/api/app-icon',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status}),403);
 await app.server.close();app=await createApplication({data:join(dir,'data'),assets,allowHTTP:true});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const restarted='http://127.0.0.1:'+app.server.address().port;
 assert.deepEqual(await guest.request.get(restarted+'/manifest.json').then(r=>r.json()),manifest);
 console.log('PASS: icon upload/resizes, invalid image rejection, admin-only write, public icon read, versioned manifest and links, persisted restart');
}finally{if(browser)await browser.close();if(app?.server.listening)await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});}
