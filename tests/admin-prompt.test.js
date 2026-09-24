import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createRequire} from 'node:module';
import {createApplication} from '../server/server.js';import {prepareAssets} from '../server/container.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=await mkdtemp(join(tmpdir(),'drakon-prompt-'));let app,browser;
try{
 const assets=join(dir,'assets');await prepareAssets(assets);app=await createApplication({data:join(dir,'data'),assets,allowHTTP:true});await app.setPassword('prompt-test-password');await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 browser=await chromium.launch({channel:'msedge',headless:true});const admin=await browser.newPage();await admin.goto(base);await admin.locator('summary').click();await admin.locator('#adminPassword').fill('prompt-test-password');await admin.locator('#adminForm button').click();await admin.waitForFunction(()=>S.role==='admin');
 const token=await admin.evaluate(async()=>{const c=await fetch('/api/content').then(r=>r.json());return Object.values(c.invites)[0]});const ctx=await browser.newContext(),p=await ctx.newPage();await p.goto(base+'/#invite='+token);await p.waitForFunction(()=>S.role==='participant'&&!document.body.classList.contains('access-locked'));await p.evaluate(()=>{closeCeremony();selectDay(2);showView('contacts')});
 let logins=0;p.on('request',r=>{if(r.url().endsWith('/api/login'))logins++});
 const state=()=>p.evaluate(()=>({role:S.role,view:S.view,day:S.sel,locked:document.body.classList.contains('access-locked'),url:location.href}));const before=await state();
 const hold=async answer=>{const dialog=p.waitForEvent('dialog');await p.locator('#cover').dispatchEvent('pointerdown',{button:0});const d=await dialog;assert.equal(d.type(),'prompt');if(answer===null)await d.dismiss();else await d.accept(answer);await p.locator('#cover').dispatchEvent('pointerup');};
 await hold(null);assert.deepEqual(await state(),before);assert.equal(logins,0);
 await hold('');assert.deepEqual(await state(),before);assert.equal(logins,0);
 await hold('wrong-password');await p.waitForFunction(()=>!organiserLoginPending);assert.deepEqual(await state(),before);assert.equal(logins,1);assert.match(await p.locator('#toast').innerText(),/Неверный пароль/);
 await ctx.setOffline(true);await hold('prompt-test-password');await p.waitForFunction(()=>!organiserLoginPending);assert.deepEqual(await state(),before);await ctx.setOffline(false);
 await hold('prompt-test-password');await p.waitForFunction(()=>S.role==='admin'&&!organiserLoginPending);const after=await state();assert.equal(after.view,before.view);assert.equal(after.day,before.day);assert.equal(after.locked,false);assert.equal(after.url,before.url);
 console.log('PASS: native password prompt; cancel/empty/wrong/offline preserve participant page; successful login preserves section and day');
}finally{if(browser)await browser.close();if(app?.server.listening)await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});}
