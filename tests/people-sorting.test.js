import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validate } from '../server/validation.js';
import { participantView } from '../server/security.js';
const source=await readFile(new URL('../web/app.js',import.meta.url),'utf8');
const functions=source.slice(source.indexOf('// Participant ordering is shared;'),source.indexOf('function shrinkPhoto('));
const S={site:{},people:[{id:'p1',code:'c1',name:'Яков'},{id:'p2',code:'c2',name:'Анна'},{id:'p3',code:'c3',name:'Борис'}],code:'c2',role:'participant',edit:false,q:'',houses:{mode:'immediate',houses:[{id:'fire',name:'Огонь'},{id:'jade',name:'Нефрит'}],assign:{c1:'fire',c2:'jade'}},draws:{}};
const elements=new Map();const $=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',value:'',querySelectorAll:()=>[]});return elements.get(id);};
const c=vm.createContext({S,$,EnglishUI:{get:()=> 'ru'},isOrg:()=>S.role==='admin',hList:()=>S.houses.houses,houseById:id=>S.houses.houses.find(h=>h.id===id),assignOf:code=>S.houses.assign[code]||'',housesOn:()=>S.houses.mode!=='off',houseMode:()=>S.houses.mode,hasDrawn:code=>!!S.houses.assign[code]&&S.draws[code]===S.houses.assign[code],myHouse:()=>S.houses.houses.find(h=>h.id===S.houses.assign[S.code]),saveSite:()=>{},esc:s=>String(s),avatar:()=>'',iconSrc:()=>'',sectionToggle:()=>'',bindParticipantEnglish:()=>{}});
vm.runInContext(functions,c);
const ids=()=>Array.from(c.orderedPeople(S.people),p=>p.id);
assert.deepEqual(ids(),['p2','p3','p1']);
S.role='admin';S.edit=true;c.updatePeopleSort({mode:'manual'});c.movePerson('p3',-1);assert.deepEqual(ids(),['p1','p3','p2']);
c.updatePeopleSort({selfFirst:true});assert.deepEqual(ids(),['p1','p3','p2']);
S.role='participant';S.edit=false;assert.deepEqual(ids(),['p2','p1','p3']);
const old=JSON.stringify(S.site);c.updatePeopleSort({mode:'name'});c.movePerson('p1',1);assert.equal(JSON.stringify(S.site),old);
c.renderPeople();assert.ok(!$('view-people').innerHTML.includes('id="peopleSortMode"'));assert.ok(!$('view-people').innerHTML.includes('data-move-person='));
S.q='Борис';c.renderPeople();assert.ok(!$('view-people').innerHTML.includes('Яков'));assert.ok(!$('view-people').innerHTML.includes('Анна'));S.q='';
S.role='admin';S.edit=true;c.updatePeopleSort({mode:'house',selfFirst:false});assert.deepEqual(ids(),['p1','p2','p3']);
S.role='participant';S.edit=false;S.houses.mode='draw';assert.deepEqual(ids(),['p2','p3','p1']);
S.role='admin';S.edit=true;c.updatePeopleSort({mode:'manual'});assert.deepEqual(ids(),['p1','p3','p2']);
S.people.push({id:'p4',code:'c4',name:'Аарон'});assert.deepEqual(ids(),['p1','p3','p2','p4']);S.people[0].name='Юрий';assert.equal(ids()[0],'p1');
S.q='Юрий';c.movePerson('p1',1);assert.equal(ids()[0],'p1');S.q='';
c.renderPeople();assert.ok($('view-people').innerHTML.includes('id="peopleSortMode"'));assert.ok($('view-people').innerHTML.includes('data-move-person='));
for(const peopleSort of [{mode:'bad',selfFirst:false,order:[]},{mode:'manual',selfFirst:'true',order:[]},{mode:'manual',selfFirst:false,order:['p1','p1']}])assert.ok(validate('site',{contacts:[],peopleSort}));
assert.equal(validate('site',{contacts:[]}),null);assert.equal(validate('site',{contacts:[],peopleSort:S.site.peopleSort}),null);
const projected=participantView({participants:{people:S.people},houses:S.houses,site:S.site},S.people[1],Date.now()+10000);assert.deepEqual(projected.site.peopleSort,S.site.peopleSort);assert.equal(projected.participants.people[1].id,'p2');
// English edits must save the shared settings rather than a translation overlay.
c.structuredClone=structuredClone;c.englishAdmin=()=>true;c.englishFields=new Set();c.englishContent=v=>v;S.rawContent={site:{contacts:[]}};
const english=await readFile(new URL('../web/english.js',import.meta.url),'utf8');vm.runInContext(english.slice(english.indexOf('function storeLanguageEdits('),english.indexOf('function readLanguageDraft(')),c);
assert.deepEqual(c.storeLanguageEdits('site',{contacts:[],peopleSort:S.site.peopleSort}).peopleSort,structuredClone(S.site.peopleSort));
// Persist through the real authenticated API, then read it after restarting.
const {createApplication}=await import('../server/server.js');const data=await mkdtemp(join(tmpdir(),'people-sort-'));let app;
try{
 app=await createApplication({data,allowHTTP:true});await app.setPassword('sorting-tests-only-2026');await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+app.server.address().port;
 const headers={'content-type':'application/json','origin':base,'x-requested-with':'drakon-secure'};
 const login=await fetch(base+'/api/login',{method:'POST',headers,body:JSON.stringify({password:'sorting-tests-only-2026'})});assert.equal(login.status,200);headers.cookie=login.headers.get('set-cookie').split(';')[0];
 const content=await (await fetch(base+'/api/content',{headers})).json();content.site.peopleSort=structuredClone(S.site.peopleSort);
 const save=await fetch(base+'/api/site',{method:'PUT',headers,body:JSON.stringify(content.site)});assert.equal(save.status,200);
 assert.deepEqual(JSON.parse(await readFile(join(data,'site.json'))).peopleSort,content.site.peopleSort);
 await new Promise(r=>app.server.close(r));app=await createApplication({data,allowHTTP:true});
 assert.deepEqual(JSON.parse(await readFile(join(data,'site.json'))).peopleSort,content.site.peopleSort);
}finally{if(app?.server.listening)await new Promise(r=>app.server.close(r));await rm(data,{recursive:true,force:true});}
console.log('PASS: sorting modes, self-first, admin-only controls, search, hidden Houses, new participants, EN persistence, validation, API save and restart');
