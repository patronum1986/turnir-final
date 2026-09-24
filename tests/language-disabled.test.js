import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createRequire} from 'node:module';
import {createApplication} from '../server/server.js';import {prepareAssets} from '../server/container.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=await mkdtemp(join(tmpdir(),'drakon-prompt-'));let app,browser;
try{
 const assets=join(dir,'assets');await prepareAssets(assets);app=await createApplication({data:join(dir,'data'),assets,allowHTTP:true});await app.setPassword('prompt-test-password');await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 browser=await chromium.launch({channel:'msedge',headless:true});const admin=await browser.newPage();await admin.goto(base);await admin.locator('summary').click();await admin.locator('#adminPassword').fill('prompt-test-password');await admin.locator('#adminForm button').click();await admin.waitForFunction(()=>S.role==='admin');

 await admin.evaluate(()=>{S.siteEdit='brand';showView('contacts')});
 if(!await admin.locator('#englishEnabled').isChecked()){await admin.locator('#englishEnabled').check();await admin.waitForFunction(()=>S.englishEnabled===true);}
 await admin.locator('[data-language="en"]').click();await admin.waitForFunction(()=>EnglishUI.get()==='en');await admin.evaluate(()=>{S.siteEdit='brand';showView('contacts')});
 await admin.locator('#englishEnabled').uncheck();await admin.waitForFunction(()=>EnglishUI.get()==='ru'&&document.getElementById('languageControl').hidden);
 await admin.evaluate(()=>showView('program'));assert.equal(await admin.locator('#languageControl').isVisible(),false);
 await admin.reload();await admin.waitForFunction(()=>S.role==='admin');assert.equal(await admin.locator('html').getAttribute('lang'),'ru');assert.equal(await admin.locator('#languageControl').isVisible(),false);
 await admin.evaluate(()=>switchLanguage('en'));assert.equal(await admin.locator('html').getAttribute('lang'),'ru');
 const guest=await browser.newPage();await guest.goto(base);await guest.waitForFunction(()=>S.englishEnabled===false);assert.equal(await guest.locator('#languageControl').isVisible(),false);
 await admin.evaluate(()=>{S.siteEdit='brand';showView('contacts')});await admin.locator('#englishEnabled').check();await admin.waitForFunction(()=>!document.getElementById('languageControl').hidden);assert.equal(await admin.locator('html').getAttribute('lang'),'en');
 console.log('PASS: disabled English hides switch and forces RU for admin and guest, survives reload, blocks direct switching; re-enable restores preference');
}finally{if(browser)await browser.close();if(app?.server.listening)await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});}
