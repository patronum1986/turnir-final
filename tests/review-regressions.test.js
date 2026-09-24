import assert from 'node:assert/strict';import {mkdtemp,rm,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createRequire} from 'node:module';
import {createApplication} from '../server/server.js';import {prepareAssets} from '../server/container.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=await mkdtemp(join(tmpdir(),'drakon-prompt-'));let app,browser;
try{
 const assets=join(dir,'assets');await prepareAssets(assets);app=await createApplication({data:join(dir,'data'),assets,allowHTTP:true});await app.setPassword('prompt-test-password');await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 browser=await chromium.launch({channel:'msedge',headless:true});const admin=await browser.newPage();await admin.goto(base);await admin.locator('summary').click();await admin.locator('#adminPassword').fill('prompt-test-password');await admin.locator('#adminForm button').click();await admin.waitForFunction(()=>S.role==='admin');

 await admin.evaluate(()=>{S.site.englishEnabled=true;saveSite()});await admin.evaluate(()=>flushPending());await admin.reload();await admin.waitForFunction(()=>S.role==='admin');
 await admin.locator('[data-dedit="0"]').click();await admin.locator('#dtitle').fill('PRESERVED DRAFT');await admin.evaluate(()=>tick());assert.equal(await admin.locator('#dtitle').inputValue(),'PRESERVED DRAFT');await admin.locator('[data-act="dcancel"]').click();
 const before=await admin.evaluate(()=>fetch('/api/content').then(r=>r.json()));
 await admin.locator('[data-language="en"]').click();await admin.waitForFunction(()=>EnglishUI.get()==='en');await admin.evaluate(()=>{S.siteEdit='brand';showView('contacts')});
 let release;const held=new Promise(r=>release=r);let uploading;const started=new Promise(r=>uploading=r);
 await admin.route('**/api/upload',async route=>{uploading();await held;await route.continue()});
 const png=await admin.evaluate(()=>{const c=document.createElement('canvas');c.width=1400;c.height=500;return c.toDataURL().split(',')[1]});
 await admin.locator('#loginBannerFile').setInputFiles({name:'review.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await started;
 await admin.locator('[data-language="ru"]').click();await admin.waitForFunction(()=>EnglishUI.get()==='ru');release();await admin.waitForFunction(()=>S.rawContent.site.login.en?.banner?.includes('upload-'));await admin.evaluate(()=>flushPending());
 const after=await admin.evaluate(()=>fetch('/api/content').then(r=>r.json()));assert.equal(before.site.login.banner,after.site.login.banner);assert.notEqual(before.site.login.en?.banner,after.site.login.en?.banner);
 const token=Object.values(after.invites)[0];const ctx=await browser.newContext(),user=await ctx.newPage();await user.goto(base+'/#invite='+token);await user.waitForFunction(()=>S.role==='participant'&&!document.body.classList.contains('access-locked'));await user.evaluate(()=>navigator.serviceWorker.ready);
 let stalled;const requestStarted=new Promise(r=>stalled=r);let endStall;const stop=new Promise(r=>endStall=r);
 await user.route('**/api/content',async route=>{stalled();await stop;await route.abort()});await user.reload();await requestStarted;await user.waitForFunction(()=>S.role==='participant'&&!document.body.classList.contains('access-locked'),{},{timeout:12000});endStall();
 await writeFile(join(dir,'data','app-icons.json'),'{broken');assert.equal((await fetch(base+'/api/ready')).status,503);assert.equal((await fetch(base+'/manifest.json')).status,200);assert.equal((await fetch(base+'/assets/icon-512.png')).status,200);await writeFile(join(dir,'data','app-icons.json'),JSON.stringify({revision:'a'.repeat(32)}));assert.equal((await fetch(base+'/api/ready')).status,503);assert.equal((await fetch(base+'/assets/icon-192.png')).status,200);await rm(join(dir,'data','app-icons.json'));assert.equal((await fetch(base+'/api/ready')).status,200);console.log('PASS: timer preserves draft, EN upload stays EN across RU switch, stalled API falls back automatically, icon corruption fails readiness but falls back publicly');
}finally{if(browser)await browser.close();if(app?.server.listening)await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});}
