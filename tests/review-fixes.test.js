import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rename,rm} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';import {tmpdir} from 'node:os';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';
import {createApplication} from '../server/server.js';import {prepareAssets} from '../server/container.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const temp=await mkdtemp(join(tmpdir(),'drakon-fixes-'));let app,browser;
try {
 const data=join(temp,'data'),assets=join(temp,'assets');await prepareAssets(assets);
 app=await createApplication({data,assets,seed:fileURLToPath(new URL('./fixtures/',import.meta.url)),allowHTTP:true});await app.setPassword('review-fixes-password');await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 const call=(path,body,cookie='')=>fetch(base+path,{method:body?'POST':'GET',headers:{cookie,origin:base,'content-type':'application/json','x-requested-with':'drakon-secure'},body:body?JSON.stringify(body):undefined});
 assert.deepEqual(await call('/api/ready').then(r=>r.json()),{ready:true});
 const original=await readFile(join(data,'participants.json'),'utf8');await writeFile(join(data,'participants.json'),'{bad');assert.equal((await call('/api/ready')).status,503);assert.equal((await call('/api/info')).status,200);await writeFile(join(data,'participants.json'),original);
 await rename(assets,assets+'-held');await writeFile(assets,'not a directory');assert.equal((await call('/api/ready')).status,503);await rm(assets);await rename(assets+'-held',assets);assert.equal((await call('/api/ready')).status,200);
 for(let i=0;i<15;i++)assert.equal((await call('/api/login',{password:'wrong'})).status,401);
 const login=await call('/api/login',{password:'review-fixes-password'}),cookie=login.headers.get('set-cookie').split(';')[0];
 const get=()=>call('/api/content',null,cookie).then(r=>r.json());const before=await get(),person=before.participants.people[0];
 for(let i=0;i<105;i++)assert.equal((await call('/api/enter',{token:before.invites[person.code]})).status,200);
 browser=await chromium.launch({channel:'msedge',headless:true});const ctx=await browser.newContext(),page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.locator('summary').click();await page.locator('#adminPassword').fill('review-fixes-password');await page.locator('#adminForm button').click();await page.waitForFunction(()=>S.role==='admin'&&!document.body.classList.contains('access-locked'));
 await page.locator('[data-dedit="0"]').click();await page.locator('#dtitle').fill('Draft title');await page.locator('#ddate').fill('2027-01-01');await page.locator('[data-act="srow-add"]').click();await page.locator('.di[data-f="what"]').last().fill('Draft row');
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=20;c.height=20;return c.toDataURL().split(',')[1]});await page.locator('#dimg').setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.waitForFunction(()=>!!S.dayImage);
 await page.waitForTimeout(900);assert.deepEqual((await get()).program,before.program);assert.deepEqual((await get()).tasks,before.tasks);
 await page.locator('[data-act="dcancel"]').click();assert.deepEqual((await get()).program,before.program);assert.equal(await page.evaluate(()=>S.dayImage),null);
 await page.locator('[data-act="dday-add"]').click();await page.locator('[data-act="dcancel"]').click();assert.deepEqual((await get()).program,before.program);
 await page.evaluate(()=>selectDay(0));await page.locator('[data-dedit="0"]').click();await page.locator('#dtitle').fill('Saved title');await page.locator('#ddate').fill('2027-01-01');await page.locator('[data-act="srow-add"]').click();await page.locator('.di[data-f="what"]').last().fill('Saved row');
 await page.locator('#dimg').setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.waitForFunction(()=>!!S.dayImage);await page.locator('#dform button[type="submit"]').click();await page.waitForFunction(()=>S.dayEdit===-1&&!S.daySaving);await page.evaluate(()=>flushPending());
 const saved=await get(),day=saved.program.days.find(d=>d.date==='2027-01-01');assert.equal(day.title,'Saved title');assert.equal(day.schedule.at(-1)[1],'Saved row');assert.match(day.img,/assets\/img\/upload-/);assert.equal((await call('/'+day.img,null,cookie)).status,200);
 const oldDate=before.program.days[0].date;if(before.tasks.tasks[oldDate]){assert.deepEqual(saved.tasks.tasks['2027-01-01'],before.tasks.tasks[oldDate]);assert.equal(saved.tasks.tasks[oldDate],undefined);}
 await page.evaluate(()=>{S.site.contactNote='UNSAVED';stash('site',S.site)});await app.setPassword('new-review-fixes-password');await page.evaluate(()=>push('site'));assert.equal(await page.evaluate(()=>localStorage.getItem(LS.site)),null);assert.match(await page.locator('#toast').innerText(),/Несохранённая правка удалена/);assert.deepEqual(errors,[]);
 console.log('PASS: readiness data/storage failure and recovery; 105 valid entries, no login throttling; day draft cancel/save/date/photo; accurate expired-session message');
}finally{if(browser)await browser.close();if(app?.server.listening)await new Promise(r=>app.server.close(r));assert.ok(resolve(temp).startsWith(resolve(tmpdir())+sep+'drakon-fixes-'));await rm(temp,{recursive:true,force:true});}
