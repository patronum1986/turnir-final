import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createApplication} from '../server/server.js';
import {planImport,parseCSV} from '../server/participants-csv.js';
const dir=await mkdtemp(join(tmpdir(),'drakon-csv-houses-'));let app;
try{
 app=await createApplication({data:dir,allowHTTP:true});await app.setPassword('csv-houses-test-password');await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 const call=(path,body,cookie='',method=body?'POST':'GET')=>fetch(base+path,{method,headers:{cookie,origin:base,'content-type':'application/json','x-requested-with':'drakon-secure'},body:body?JSON.stringify(body):undefined});
 const auth=await call('/api/login',{password:'csv-houses-test-password'}),cookie=auth.headers.get('set-cookie').split(';')[0];const get=()=>call('/api/content',null,cookie).then(r=>r.json());
 const initial=await get(),h=initial.houses.houses[0],h2=initial.houses.houses[1];
 const preview=csv=>call('/api/participants/import',{csv},cookie).then(r=>r.json());const commit=(csv,p)=>call('/api/participants/import',{csv,commit:true,revision:p.revision},cookie);
 const csv=`name;bank;house\nCSV House Test;Bank;${h.name}`;let p=await preview(csv);assert.equal(p.errors.length,0);assert.equal(p.changes[0].house,h.name);assert.equal((await commit(csv,p)).status,200);
 let c=await get(),person=c.participants.people.find(x=>x.name==='CSV House Test'),token=c.invites[person.code];assert.equal(c.houses.assign[person.code],h.id);assert.deepEqual(c.draws,initial.draws);assert.equal((await commit(csv,p)).status,409);
 const update=`id;name;house\n${person.id};CSV Updated;${h2.en?.name||h2.name}`;p=await preview(update);assert.equal((await commit(update,p)).status,200);c=await get();assert.equal(c.houses.assign[person.code],h2.id);assert.equal(c.invites[person.code],token);
 for(const text of [`id;name;house\n${person.id};CSV Updated;`,`id;name\n${person.id};CSV Updated`]){p=await preview(text);assert.equal((await commit(text,p)).status,200);assert.equal((await get()).houses.assign[person.code],h2.id);}
 const exported=await call('/api/participants/export',null,cookie).then(r=>r.text());assert.equal(parseCSV(exported).find(x=>x.id===person.id).house,h2.name);
 const bad=`name;house\nValid New;${h.name}\nInvalid New;Unknown house`;p=await preview(bad);assert.equal(p.errors.length,1);const before=await get();assert.equal((await commit(bad,p)).status,400);const after=await get();assert.deepEqual(after.participants,before.participants);assert.deepEqual(after.houses,before.houses);
 const repeat=`id;name;house\n${person.id};CSV Updated;${h.name}`;p=await preview(repeat);const houses=structuredClone(after.houses);houses.houses[0].name+=' renamed';await call('/api/houses',houses,cookie,'PUT');assert.equal((await commit(repeat,p)).status,409);
 const ambiguous=structuredClone(houses);ambiguous.houses[1].name=ambiguous.houses[0].name;assert.equal(planImport(after.participants,`name;house\nAmbiguous;${ambiguous.houses[0].name}`,ambiguous).preview.errors.length,1);
 const login=await call('/api/enter',{token}),user=login.headers.get('set-cookie').split(';')[0];assert.equal((await call('/api/participants/import',{csv},user)).status,403);
 // Recover a committed import interrupted between the two file replacements.
 await new Promise(r=>app.server.close(r));const pendingParticipants=JSON.parse(await readFile(join(dir,'participants.json'),'utf8')),pendingHouses=JSON.parse(await readFile(join(dir,'houses.json'),'utf8'));pendingParticipants.people.find(x=>x.id===person.id).name='Recovered CSV';pendingHouses.assign[person.code]=h.id;
 await writeFile(join(dir,'.csv-import.json'),JSON.stringify({'participants.json':pendingParticipants,'houses.json':pendingHouses}));await writeFile(join(dir,'participants.json'),JSON.stringify(pendingParticipants));
 app=await createApplication({data:dir,allowHTTP:true});assert.deepEqual(JSON.parse(await readFile(join(dir,'houses.json'),'utf8')),pendingHouses);await assert.rejects(readFile(join(dir,'.csv-import.json')),{code:'ENOENT'});
 console.log('PASS: CSV house assignment/new/update/blank/export, EN name, unknown/ambiguous rejection, stale houses, invitation/draw preservation, participant forbidden, interrupted import recovery');
}finally{if(app?.server.listening)await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});}
