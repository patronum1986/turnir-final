import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {createRequire} from 'node:module';
import {createApplication} from '../server/server.js';import {prepareAssets} from '../server/container.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=await mkdtemp(join(tmpdir(),'drakon-banners-'));let app,browser;
try{
 const assets=join(dir,'assets');await prepareAssets(assets);app=await createApplication({data:join(dir,'data'),assets,allowHTTP:true});await app.setPassword('banner-test-password');await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 browser=await chromium.launch({channel:'msedge',headless:true});const ctx=await browser.newContext(),p=await ctx.newPage(),guestCtx=await browser.newContext(),g=await guestCtx.newPage();
 await p.goto(base);await p.locator('summary').click();await p.locator('#adminPassword').fill('banner-test-password');await p.locator('#adminForm button').click();await p.waitForFunction(()=>S.role==='admin');
 const get=()=>p.evaluate(()=>fetch('/api/content').then(r=>r.json()));const initial=(await get()).site;
 await p.locator('[data-language="en"]').click();await p.waitForFunction(()=>EnglishUI.get()==='en');await p.evaluate(()=>{S.siteEdit='brand';showView('contacts')});
 // Editing unrelated text must not pin the Russian fallback as an EN image.
 await p.locator('#bfoot').fill('English footer');await p.evaluate(()=>flushPending());assert.equal((await get()).site.brand.en.cover,undefined);
 const png=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=1400;c.height=500;c.getContext('2d').fillRect(0,0,1400,500);return c.toDataURL().split(',')[1];});
 const file={name:'banner.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')};
 assert.equal(await p.locator('#bcover').isEnabled(),true);await p.locator('#bcover').setInputFiles(file);await p.waitForFunction(()=>S.site.brand.cover.includes('upload-'));await p.evaluate(()=>flushPending());
 await p.locator('#loginBannerFile').setInputFiles(file);await p.waitForFunction(()=>S.site.login.banner.includes('upload-'));await p.evaluate(()=>flushPending());let site=(await get()).site;
 assert.equal(site.brand.cover,initial.brand.cover);assert.equal(site.login.banner,initial.login.banner);assert.ok(site.brand.en.cover.includes('upload-'));assert.ok(site.login.en.banner.includes('upload-'));const enCover=site.brand.en.cover,enLogin=site.login.en.banner;
 await g.goto(base);await g.locator('[data-language="en"]').click();await g.waitForFunction(()=>document.querySelector('#accessBanner').src.includes('lang=en')&&document.querySelector('#accessBanner').naturalWidth===1400);
 const appearance=await g.request.get(base+'/api/login-appearance').then(r=>r.json());assert.ok(!JSON.stringify(appearance).includes(enCover));assert.equal((await g.request.get(base+'/'+enCover)).status(),401);assert.equal((await g.request.get(base+'/'+enLogin)).status(),401);assert.equal((await g.request.get(base+appearance.en.banner)).status(),200);
 const invalid=await p.evaluate(async()=>{const c=await fetch('/api/content').then(r=>r.json());c.site.login.en.banner='assets/people/private.jpg';return (await fetch('/api/site',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(c.site)})).status});assert.equal(invalid,400);
 await p.locator('[data-language="ru"]').click();await p.waitForFunction(()=>EnglishUI.get()==='ru');await p.evaluate(()=>{S.siteEdit='brand';showView('contacts')});await p.locator('#bcover').setInputFiles(file);await p.waitForFunction(()=>S.site.brand.cover.includes('upload-'));await p.evaluate(()=>flushPending());site=(await get()).site;assert.equal(site.brand.en.cover,enCover);assert.notEqual(site.brand.cover,initial.brand.cover);
 // Both languages remain in the offline download list and can be loaded from local blobs.
 const wanted=await p.evaluate(()=>tracks());for(const key of [site.brand.cover,enCover,site.login.banner,enLogin])assert.ok(wanted.includes(key),key);
 await p.evaluate(async()=>{for(const key of tracks()){if(!key.startsWith('assets/'))continue;const r=await fetch(key);if(r.ok)await idbPut(key,{blob:await r.blob(),at:Date.now()});}await loadSaved();});
 await p.locator('[data-language="en"]').click();await p.waitForFunction(()=>EnglishUI.get()==='en');await ctx.setOffline(true);await p.evaluate(()=>{loadSaved();applyBrand()});await p.waitForFunction(()=>document.querySelector('#cover img').src.startsWith('blob:')&&document.querySelector('#cover img').naturalWidth===1400);await ctx.setOffline(false);
 await p.evaluate(()=>{S.siteEdit='brand';showView('contacts')});await p.locator('#resetEnglishCover').click();await p.locator('#removeLoginBanner').click();await p.evaluate(()=>flushPending());site=(await get()).site;assert.equal(site.brand.en.cover,'');assert.equal(site.login.en.banner,'');assert.equal(await p.evaluate(()=>S.site.brand.cover),site.brand.cover);assert.equal(await p.evaluate(()=>S.site.login.banner),site.login.banner);
 await g.reload();await g.waitForFunction(()=>!document.querySelector('#accessBanner').src.includes('lang=en')&&document.querySelector('#accessBanner').naturalWidth>0);
 console.log('PASS: separate RU/EN uploads, fallback/reset, unrelated edits, public banner allowlist, private main banner, invalid paths, offline assets');
}finally{if(browser)await browser.close();if(app?.server.listening)await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});}
