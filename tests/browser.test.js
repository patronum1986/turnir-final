import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdtemp, readdir, unlink, rmdir, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';import { join } from 'node:path';
import { createApplication } from '../server/server.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const data=await mkdtemp(join(tmpdir(),'secure-browser-'));let browser,app;
try{
 app=await createApplication({data,allowHTTP:true});await app.setPassword('test-secure-browser-2026');
 const fixture=JSON.parse(await readFile(new URL('./fixtures/participants.json',import.meta.url),'utf8'));
 await writeFile(join(data,'participants.json'),JSON.stringify(fixture));
 const houses=JSON.parse(await readFile(join(data,'houses.json'),'utf8'));houses.mode='draw';houses.assign={test1:'fire',test2:'jade'};
 await writeFile(join(data,'houses.json'),JSON.stringify(houses));await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 browser=await chromium.launch({channel:'msedge',headless:true});const adminCtx=await browser.newContext({viewport:{width:390,height:844}}),userCtx=await browser.newContext({viewport:{width:390,height:844}}),otherCtx=await browser.newContext();
 const admin=await adminCtx.newPage(),user=await userCtx.newPage(),other=await otherCtx.newPage();const errors=[];
 for(const p of [admin,user,other])p.on('pageerror',e=>errors.push(e.message));
 await admin.goto(base);await admin.locator('#accessGate').waitFor({state:'visible'});await admin.locator('summary').click();await admin.locator('#adminPassword').fill('test-secure-browser-2026');await admin.locator('#adminForm button').click();await admin.waitForFunction(()=>S.role==='admin'&&!document.body.classList.contains('access-locked'));
 const raw=await admin.evaluate(()=>fetch('/api/content').then(r=>r.json()));const participant=raw.participants.people[0],second=raw.participants.people[1];
 const invite=raw.invites[participant.code];assert.ok(invite);
 await user.goto(base+'/#invite='+invite);await user.waitForFunction(()=>S.role==='participant'&&!document.body.classList.contains('access-locked'));assert.equal(new URL(user.url()).hash,'');
 await other.goto(base+'/#invite='+raw.invites[second.code]);await other.waitForFunction(()=>S.role==='participant');
 await user.locator('[data-view="people"]').click();assert.equal(await user.locator('.phouse').count(),0);
 await user.locator('[data-view="program"]').click();await user.locator('[data-act="cer-open"]').click();await user.locator('[data-act="cer-pick"]').click();await user.waitForTimeout(900);await user.locator('[data-scroll="0"]').click({force:true});await user.waitForFunction(()=>drawn());await user.waitForFunction(()=>!S.drawSyncing);await user.locator('[data-act="cer-close"]').click();
 // Re-projecting languages must retain the completed draw after the pending queue is cleared.
 const completed=await user.evaluate(()=>({house:myHouse().id,draws:structuredClone(S.draws)}));
 assert.equal(await user.evaluate(()=>Object.keys(S.drawPending).length),0);
 for(const language of ['en','ru','en','ru']){
   await user.locator(`[data-language="${language}"]`).click();
   assert.equal(await user.evaluate(()=>drawn()),true);
   assert.equal(await user.locator('[data-act="cer-open"]').count(),0);
   assert.equal(await user.locator('.hcard').count(),1);
   assert.deepEqual(await user.evaluate(()=>S.draws),completed.draws);
   assert.equal(await user.evaluate(()=>myHouse().id),completed.house);
 }
 await other.evaluate(()=>refresh());await other.locator('[data-view="people"]').click();assert.equal(await other.locator('.phouse').count(),1);
 await user.evaluate(()=>downloadAll());await user.evaluate(()=>navigator.serviceWorker.ready);await userCtx.setOffline(true);await user.reload();await user.waitForFunction(()=>S.role==='participant'&&!document.body.classList.contains('access-locked'));assert.equal(await user.locator('.hcard').count(),1);
 for(const language of ['en','ru']){await user.locator(`[data-language="${language}"]`).click();assert.equal(await user.evaluate(()=>drawn()),true);assert.equal(await user.locator('[data-act="cer-open"]').count(),0);}
 await userCtx.setOffline(false);
 await admin.evaluate(()=>{S.hEdit=true;S.edit=true;showView('people')});await admin.locator('[name="house-mode"][value="immediate"]').check();await admin.evaluate(()=>flushPending());await user.evaluate(()=>refresh());await user.locator('[data-view="people"]').click();assert.equal(await user.locator('.phouse').count(),raw.participants.people.length);
 await admin.locator('[name="house-mode"][value="off"]').check();await admin.evaluate(()=>flushPending());await user.evaluate(()=>refresh());assert.equal(await user.locator('.phouse').count(),0);
 const banner=await admin.locator('#cover').boundingBox();assert.ok(Math.abs(banner.width/banner.height-2.8)<0.02);
 const size=await admin.evaluate(async()=>{const c=document.createElement('canvas');c.width=1400;c.height=500;const b=await new Promise(r=>c.toBlob(r));const resized=await shrinkWide(new File([b],'banner.png',{type:'image/png'}),1400);const image=await createImageBitmap(resized);return [image.width,image.height];});assert.deepEqual(size,[1400,500]);
 // Admin can create a participant; invitation is created only server-side.
 await admin.evaluate(()=>{S.hEdit=false;S.edit=true;renderPeople()});await admin.locator('#pname').fill('Новый тестовый участник');await admin.locator('#pbank').fill('Банк тест');await admin.locator('#pform button[type="submit"]').click();await admin.evaluate(()=>flushPending());assert.ok(await admin.evaluate(()=>Object.values(S.invites).every(v=>/^[A-Za-z0-9]{12}$/.test(v))));
 await admin.evaluate(async id=>{await fetch('/api/invitations',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id,action:'revoke'})})},participant.id);
 await user.reload();await user.waitForFunction(()=>S.role==='guest');assert.equal(await user.locator('#accessGate').isVisible(),true);assert.equal(await user.evaluate(()=>localStorage.getItem(LS.content)),null);
 assert.equal((await user.request.get(base+'/api/content')).status(),401);
 // Invalid old links cannot use an earlier cached session.
 await other.goto(base+'/#invite=test1');await other.waitForFunction(()=>document.body.classList.contains('access-locked'));assert.equal(await other.locator('#accessGate').isVisible(),true);
 await mkdir(new URL('./screenshots/',import.meta.url),{recursive:true});await admin.evaluate(()=>showView('program'));assert.equal(await admin.evaluate(()=>DAYS.length),8);assert.equal(await admin.evaluate(()=>DAYS[0].date),'2026-10-24');await admin.screenshot({path:decodeURIComponent(new URL('./screenshots/program.png',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1'),fullPage:true});await admin.evaluate(()=>showView('people'));await admin.screenshot({path:decodeURIComponent(new URL('./screenshots/admin.png',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1')});await user.screenshot({path:decodeURIComponent(new URL('./screenshots/access.png',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1')});
 assert.deepEqual(errors,[]);console.log('PASS: browser login, admin/participant, invitation fragment removed, draw sharing, download and offline reload, modes, new participant, revoked access, no JS errors');
}finally{if(browser)await browser.close();if(app?.server.listening)await new Promise(r=>app.server.close(r));for(const name of await readdir(data))await unlink(join(data,name));await rmdir(data);}


