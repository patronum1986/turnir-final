import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,readdir,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createApplication} from '../server/server.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const data=await mkdtemp(join(tmpdir(),'drakon-contacts-'));let app,browser;
try {
 app=await createApplication({data,allowHTTP:true});await app.setPassword('contacts-test-password-2026');await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Intercept external navigation: this test never contacts real Telegram accounts.
 await context.route('https://t.me/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<p>Telegram destination intercepted for local test</p>'}));
 await page.goto(base);await page.locator('summary').click();await page.locator('#adminPassword').fill('contacts-test-password-2026');await page.locator('#adminForm button').click();await page.waitForFunction(()=>S.role==='admin');
 const normalized=await page.evaluate(()=>['sample_user',' @sample_user ','https://t.me/sample_user','t.me/sample_user/','https://telegram.me/sample_user','https://t.me/@sample_user','javascript:alert(1)','https://evil.example/sample_user','https://t.me/sample_user/123','https://t.me.evil.example/sample_user','bad user',''].map(telegramUsername));
 assert.deepEqual(normalized,['sample_user','sample_user','sample_user','sample_user','sample_user','sample_user','','','','','','']);
 await page.evaluate(()=>{S.site.contacts=[{name:'Contact test',role:'Organizer',wechat:'  test_wechat_ID  ',telegram:'https://t.me/sample_user'}];S.siteEdit='';showView('contacts');});
 const link=page.locator('#view-contacts a[href="https://t.me/sample_user"]');assert.equal(await link.count(),1);assert.equal(await page.locator('.contact-note').count(),0);assert.equal(await page.locator('[data-copy="@sample_user"]').count(),0);assert.ok(!(await page.locator('[data-copy-kind="wechat"]').innerText()).includes('Скопировать'));
 const popupWait=context.waitForEvent('page');await link.click();const popup=await popupWait;await popup.waitForLoadState();assert.equal(popup.url(),'https://t.me/sample_user');await popup.close();
 await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedContact=text}}});});
 await page.locator('[data-copy-kind="wechat"]').click();await page.waitForFunction(()=>window.copiedContact==='test_wechat_ID');assert.match(await page.locator('#toast').innerText(),/ID скопирован/);
 await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined});document.execCommand=command=>{window.fallbackCopy=command;window.fallbackValue=document.activeElement.value;return true;};});
 await page.locator('[data-copy-kind="wechat"]').click();await page.waitForFunction(()=>window.fallbackCopy==='copy');assert.equal(await page.evaluate(()=>window.fallbackValue),'test_wechat_ID');
 await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('Denied')}}});document.execCommand=()=>false;});
 const dialogWait=page.waitForEvent('dialog');const clickPending=page.locator('[data-copy-kind="wechat"]').click();const dialog=await dialogWait;assert.equal(dialog.type(),'prompt');assert.equal(dialog.defaultValue(),'test_wechat_ID');await dialog.dismiss();await clickPending;
 await page.evaluate(()=>{S.site.contacts[0].telegram='https://evil.example';renderContacts();});assert.equal(await page.locator('#view-contacts a[href^="https://t.me/"]').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: Telegram input formats, safe destination and popup; WeChat ID copy, unavailable/denied clipboard fallback and manual copy');
}finally{if(browser)await browser.close();if(app?.server.listening)await new Promise(r=>app.server.close(r));for(const f of await readdir(data))await unlink(join(data,f));await rmdir(data);}

