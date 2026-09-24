import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,readdir,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {prepareAssets} from '../server/container.js';
import {createApplication} from '../server/server.js';
import {validate} from '../server/validation.js';
const temp=await mkdtemp(join(tmpdir(),'drakon-container-'));let app;
async function cleanup(p){for(const x of await readdir(p,{withFileTypes:true})){const child=join(p,x.name);if(x.isDirectory())await cleanup(child);else await unlink(child);}await rmdir(p);}
try {
 const source=join(temp,'source'),assets=join(temp,'assets'),data=join(temp,'data');await mkdir(join(source,'img'),{recursive:true});
 await writeFile(join(source,'img','test.jpg'),'source');await prepareAssets(assets,source);
 await writeFile(join(assets,'img','test.jpg'),'changed by admin');await prepareAssets(assets,source);
 assert.equal(await readFile(join(assets,'img','test.jpg'),'utf8'),'changed by admin');
 process.env.TRUSTED_PROXY_CIDRS='127.0.0.1/32';
 app=await createApplication({data,assets,allowHTTP:true});await app.setPassword('container-test-password');
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 const post=(path,body,ip='198.51.100.1',cookie='')=>fetch(base+path,{method:'POST',headers:{origin:base,'content-type':'application/json','x-requested-with':'drakon-secure','x-real-ip':ip,cookie},body:JSON.stringify(body)});
 assert.equal((await fetch(base+'/assets/img/test.jpg')).status,401);
 for(let i=0;i<12;i++)assert.equal((await post('/api/login',{password:'wrong'})).status,401);
 assert.equal((await post('/api/login',{password:'wrong'})).status,401);
 const login=await post('/api/login',{password:'container-test-password'},'198.51.100.2');assert.equal(login.status,200);
 const cookie=login.headers.get('set-cookie').split(';')[0];
 assert.equal(await fetch(base+'/assets/img/test.jpg',{headers:{cookie}}).then(r=>r.text()),'changed by admin');
 const upload=await post('/api/upload',{dir:'img',name:'new.jpg',data:Buffer.from('uploaded').toString('base64')},'198.51.100.2',cookie).then(r=>r.json());
 assert.equal(await readFile(join(assets,upload.path.slice('assets/'.length)),'utf8'),'uploaded');
 for(const kind of ['program','site','tasks','participants','houses']){
  const value=JSON.parse(await readFile(join(data,kind+'.json'),'utf8'));assert.equal(validate(kind,value),null,kind);
 }
 await new Promise(r=>app.server.close(r));delete process.env.TRUSTED_PROXY_CIDRS;
 app=await createApplication({data,assets,allowHTTP:true});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 assert.equal((await fetch('http://127.0.0.1:'+app.server.address().port+'/assets/img/test.jpg',{headers:{cookie}})).status,200);
 console.log('PASS: independent data path, protected persistent media, no seed overwrite, unlimited login attempts, group schemas, restart');
}finally{delete process.env.TRUSTED_PROXY_CIDRS;if(app?.server.listening)await new Promise(r=>app.server.close(r));await cleanup(temp);}
