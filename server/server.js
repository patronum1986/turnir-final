import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rename, realpath, unlink } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { join, resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest, secret, invitationToken, passwordHash, passwordMatches, participantView } from './security.js';
import { validate } from './validation.js';
import {planImport,revision,exportCSV} from './participants-csv.js';
import {iconSizes,iconRevision,saveIcons} from './app-icons.js';
import { serveFile } from './files.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILES = { participants:'participants.json', tasks:'tasks.json', houses:'houses.json', program:'program.json', site:'site.json' };
const PUBLIC = new Set(['/','/index.html','/app.js','/i18n.js','/english.js','/app-icons.js','/style.css','/sw.js','/manifest.json','/assets/favicon.png','/assets/apple-touch-icon.png','/assets/icon-192.png','/assets/icon-512.png']);
const securityHeaders = {
  'cache-control':'private, no-store', 'x-content-type-options':'nosniff', 'referrer-policy':'no-referrer',
  'x-frame-options':'DENY', 'x-robots-tag':'noindex, nofollow, noarchive',
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
};
const send = (res, status, body) => { res.writeHead(status, {'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(body)); };

export async function createApplication({ data = process.env.DATA_DIR || join(ROOT,'server','data'), assets = process.env.ASSETS_DIR, web = join(ROOT,'web'), seed = join(ROOT,'server','seed'), origin = process.env.PUBLIC_ORIGIN, allowHTTP = process.env.ALLOW_LOCAL_HTTP === '1' } = {}) {
  if (!origin && !allowHTTP) throw Error('Set PUBLIC_ORIGIN=https://your-domain or ALLOW_LOCAL_HTTP=1 for localhost testing');
  if (origin && new URL(origin).protocol !== 'https:' && !allowHTTP) throw Error('PUBLIC_ORIGIN must use HTTPS');
  const DATA=resolve(data), WEB=resolve(web), ASSETS=resolve(assets||join(WEB,'assets'));
  await mkdir(DATA,{recursive:true});
  // A CSV import changes participants and assignments together. A durable journal
  // makes an interrupted two-file commit recoverable before accepting new writes.
  let writeQueue=Promise.resolve(),pendingImport=null;
  const journal=join(DATA,'.csv-import.json');
  const diskRead=async(name,fallback)=>{try{return JSON.parse(await readFile(join(DATA,name),'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}};
  const read=async(name,fallback)=>pendingImport&&Object.hasOwn(pendingImport,name)?structuredClone(pendingImport[name]):diskRead(name,fallback);
  async function atomic(name,value){const tmp=join(DATA,'.'+name+'.'+secret()+'.tmp');await writeFile(tmp,JSON.stringify(value,null,1),{mode:0o600});await rename(tmp,join(DATA,name));}
  async function finishImport(){
    if(!pendingImport)return;
    for(const name of ['participants.json','houses.json'])await atomic(name,pendingImport[name]);
    await unlink(journal);pendingImport=null;
  }
  if(existsSync(journal)){
    pendingImport=JSON.parse(await readFile(journal,'utf8'));
    if(validate('participants',pendingImport?.['participants.json'])||validate('houses',pendingImport?.['houses.json']))throw Error('Invalid pending CSV import');
    await finishImport();
  }
  function enqueue(operation){const next=writeQueue.catch(()=>{}).then(async()=>{await finishImport();return operation();});writeQueue=next;return next;}
  function write(name,value){return enqueue(async()=>{const result=typeof value==='function'?await value(await read(name,{})):value;await atomic(name,result);return result;});}
  function importParticipants(expected,plan){return enqueue(async()=>{
    const participants=await read('participants.json',{people:[]}),houses=await read('houses.json',{});
    if(expected!==revision({participants,houses}))throw Object.assign(Error('Список участников или команды изменились. Повторите предварительную проверку CSV'),{status:409});
    const next={'participants.json':plan.document,'houses.json':plan.houses};
    await atomic('.csv-import.json',next);pendingImport=next;await finishImport();
  });}
  for(const name of Object.values(FILES)) if(!existsSync(join(DATA,name))) await write(name,JSON.parse(await readFile(join(seed,name),'utf8')));
  if(!existsSync(join(DATA,'config.json')))await write('config.json',{version:1,password:null,passwordVersion:secret()});
  // Add public appearance settings once, preserving existing edited content.
  const initialSite=await read('site.json',{});
  if(initialSite.login===undefined)await write('site.json',current=>({
    ...current,login:{title:'Турнир Лидеров - 2026',banner:'assets/login/default.jpg'},
    brand:{...current.brand,footer:/^Турнир лидеров 2026(?: · Группа (?:РФ|СНГ))?$/.test(current.brand?.footer||'')?'Турнир Лидеров 2026':(current.brand?.footer??'Турнир Лидеров 2026')}
  }));
  async function invitations() {
    return write('invitations.json',async current=>{
      const {people}=await read('participants.json',{people:[]});
      const next={};for(const p of people)next[p.id]=current[p.id]||{token:invitationToken(),version:secret(),revoked:false};return next;
    });
  }
  const links = async () => {const inv=await invitations(),{people}=await read('participants.json',{people:[]});return Object.fromEntries(people.map(p=>[p.code,!inv[p.id]||inv[p.id].revoked?'':inv[p.id].token]));};
  const cookieName=allowHTTP?'drakon_session':'__Host-drakon_session';
  const cookie=(res,token,seconds)=>res.setHeader('set-cookie',`${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${allowHTTP?'':'; Secure'}`);
  const getToken=req=>req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';
  async function principal(req) {
    const token=getToken(req);if(!/^[a-f0-9]{64}$/.test(token))return null;
    const session=(await read('sessions.json',{}))[digest(token)];if(!session||session.expires<=Date.now())return null;
    if(session.role==='admin')return session.version===(await read('config.json',{})).passwordVersion?session:null;
    const inv=(await read('invitations.json',{}))[session.id];
    const person=(await read('participants.json',{people:[]})).people.find(p=>p.id===session.id);
    return inv&&!inv.revoked&&inv.version===session.version&&person?{...session,person}:null;
  }
  async function issue(res,role,id,version) {
    const seconds=role==='admin'?8*3600:60*86400,token=secret();
    await write('sessions.json',current=>({...Object.fromEntries(Object.entries(current).filter(([,s])=>s.expires>Date.now())),[digest(token)]:{role,id,version,expires:Date.now()+seconds*1000}}));
    cookie(res,token,seconds);
  }
  async function body(req) {
    const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>40*1024*1024)throw Object.assign(Error('Файл слишком большой'),{status:413});chunks.push(chunk)}
    try { const b=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');if(!b||typeof b!=='object'||Array.isArray(b))throw Error();return b; } catch {throw Object.assign(Error('Некорректный JSON'),{status:400});}
  }
  async function content(user) {
    const c={};for(const [key,file]of Object.entries(FILES))c[key]=await read(file,{});c.draws=await read('draws.json',{});
    if(user.role==='participant')return participantView(c,user.person,user.expires);
    return {...c,server:true,role:'admin',me:null,invites:await links(),offline:null};
  }
  let readiness;
  async function checkReadiness() {
    if (readiness) return readiness;
    readiness=(async()=>{
      try {
        if(pendingImport)return false;
        await iconRevision(DATA,ASSETS);
        for(const [kind,name] of Object.entries(FILES)) {
          const value=JSON.parse(await readFile(join(DATA,name),'utf8'));
          if(validate(kind,value))return false;
        }
        const cfg=JSON.parse(await readFile(join(DATA,'config.json'),'utf8'));
        if(!/^[a-f0-9]{32}$/.test(cfg.password?.salt||'')||!/^[a-f0-9]{128}$/.test(cfg.password?.hash||'')||typeof cfg.passwordVersion!=='string')return false;
        for(const name of ['sessions.json','invitations.json','draws.json']) {
          const value=await read(name,{});
          if(!value||typeof value!=='object'||Array.isArray(value))return false;
          if(name==='sessions.json'&&!Object.values(value).every(s=>s&&['admin','participant'].includes(s.role)&&Number.isFinite(s.expires)&&typeof s.version==='string'))return false;
          if(name==='invitations.json'&&!Object.values(value).every(v=>v&&typeof v.token==='string'&&typeof v.version==='string'&&typeof v.revoked==='boolean'))return false;
          if(name==='draws.json'&&!Object.values(value).every(v=>typeof v==='string'))return false;
        }
        for(const folder of new Set([DATA,ASSETS])) {
          const from=join(folder,'.readiness-'+secret()),to=from+'.renamed';
          try {
            await writeFile(from,'ready',{flag:'wx',mode:0o600});
            await rename(from,to);
            if(await readFile(to,'utf8')!=='ready')return false;
          } finally {
            for(const file of [from,to])await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});
          }
        }
        return true;
      } catch {return false;}
    })();
    try{return await readiness;}finally{readiness=null;}
  }
  const server=createServer(async(req,res)=>{
    for(const [k,v]of Object.entries(securityHeaders))res.setHeader(k,v);
    if(!allowHTTP)res.setHeader('strict-transport-security','max-age=31536000');
    try {
      const expected=origin?new URL(origin).origin:`http://${req.headers.host}`;
      const path=decodeURIComponent(new URL(req.url,expected).pathname);
      if(!['GET','HEAD','POST','PUT'].includes(req.method))return send(res,405,{error:'Метод не поддерживается'});
      if(['POST','PUT'].includes(req.method)) {
        if(req.headers.origin!==expected||req.headers['x-requested-with']!=='drakon-secure'||!(req.headers['content-type']||'').startsWith('application/json'))return send(res,403,{error:'Запрос отклонён'});
      }
      if(path==='/manifest.json'&&['GET','HEAD'].includes(req.method)){
        const manifest=JSON.parse(await readFile(join(WEB,'manifest.json'),'utf8')),revision=await iconRevision(DATA,ASSETS,true);
        if(revision)manifest.icons=manifest.icons.map(i=>({...i,src:i.src.split('?')[0]+'?v='+revision}));
        return send(res,200,manifest);
      }
      const iconName=path.startsWith('/assets/')?path.slice(8):'';
      if(Object.hasOwn(iconSizes,iconName)&&['GET','HEAD'].includes(req.method)){
        const revision=await iconRevision(DATA,ASSETS,true);
        if(revision)return serveFile(res,join(ASSETS,'app-icons',`${revision}-${iconSizes[iconName]}.png`),req);
      }
      if(path==='/api/login-appearance'&&['GET','HEAD'].includes(req.method)) {
        const site=await read('site.json',{}),login=site.login||{};
        return send(res,200,{englishEnabled:site.englishEnabled!==false,title:login.title??'Турнир Лидеров - 2026',intro:login.intro??'Откройте приглашение или войдите как организатор. Для первого входа нужен интернет.',inputLabel:login.inputLabel??'Персональная ссылка или код',footer:site.brand?.footer??'Турнир Лидеров 2026',banner:login.banner?'/api/login-banner?v='+digest(login.banner).slice(0,16):'',en:{title:login.en?.title||'',intro:login.en?.intro||'',inputLabel:login.en?.inputLabel||'',footer:site.brand?.en?.footer||'',banner:site.englishEnabled!==false&&login.en?.banner?'/api/login-banner?lang=en&v='+digest(login.en.banner).slice(0,16):''}});
      }
      if(path==='/api/login-banner'&&['GET','HEAD'].includes(req.method)) {
        const site=await read('site.json',{}),banner=(new URL(req.url,'http://localhost').searchParams.get('lang')==='en'&&site.englishEnabled!==false?site.login?.en?.banner:'')||site.login?.banner||'';
        if(!/^assets\/login\/[A-Za-z0-9._-]+\.(png|jpe?g|webp)$/i.test(banner))return send(res,404,{error:'Баннер не задан'});
        const folder=join(ASSETS,'login'),file=join(ASSETS,banner.slice('assets/'.length));
        if(!existsSync(file)||!statSync(file).isFile())return send(res,404,{error:'Баннер не найден'});
        if(!(await realpath(file)).startsWith((await realpath(folder))+sep))return send(res,403,{error:'Нет доступа'});
        return serveFile(res,file,req);
      }
      if(path==='/api/ready'&&['GET','HEAD'].includes(req.method)){const ready=await checkReadiness();return send(res,ready?200:503,{ready});}
      if(path==='/api/info')return send(res,200,{server:true,secure:true});
      if(path==='/api/login'&&req.method==='POST') {
        const {password}=await body(req),cfg=await read('config.json',{});
        if(!passwordMatches(password,cfg.password))return send(res,401,{error:'Неверный пароль'});
        await issue(res,'admin',null,cfg.passwordVersion);return send(res,200,{ok:true});
      }
      if(path==='/api/enter'&&req.method==='POST') {
        const {token}=await body(req);
        if(typeof token!=='string'||!/^(?:[A-Za-z0-9]{12}|[a-f0-9]{64})$/.test(token))return send(res,401,{error:'Приглашение недействительно'});
        const inv=await read('invitations.json',{}),entry=Object.entries(inv).find(([,v])=>!v.revoked&&digest(v.token)===digest(token));
        if(!entry||!(await read('participants.json',{people:[]})).people.some(p=>p.id===entry[0]))return send(res,401,{error:'Приглашение недействительно'});
        await issue(res,'participant',entry[0],entry[1].version);return send(res,200,{ok:true});
      }
      if(path==='/api/logout'&&req.method==='POST') {
        const key=digest(getToken(req));await write('sessions.json',current=>{delete current[key];return current;});cookie(res,'',0);return send(res,200,{ok:true});
      }
      const user=await principal(req);
      if(path.startsWith('/api/')) {
        if(!user)return send(res,401,{error:'Откройте персональное приглашение или войдите как организатор'});
        if(path==='/api/content'&&req.method==='GET')return send(res,200,await content(user));
        if(path==='/api/session')return send(res,200,{role:user.role});
        if(path==='/api/draw'&&req.method==='POST') {
          if(user.role!=='participant')return send(res,403,{error:'Жребий доступен участнику'});
          const b=await body(req),h=await read('houses.json',{}),person=user.person,assigned=h.assign?.[person.code];
          if(b.code!==person.id)return send(res,403,{error:'Нельзя раскрыть Дом другого участника'});
          if((h.mode||(h.enabled===false?'off':'draw'))!=='draw'||!assigned||b.houseId!==assigned||!h.houses.some(x=>x.id===assigned))return send(res,409,{error:'Назначение или режим изменились'});
          await write('draws.json',current=>({...current,[person.code]:assigned}));return send(res,200,{ok:true,houseId:assigned});
        }
        if(user.role!=='admin')return send(res,403,{error:'Требуется организатор'});
        if(path==='/api/participants/export'&&req.method==='GET') {
          res.setHeader('content-type','text/csv; charset=utf-8');res.setHeader('content-disposition','attachment; filename="participants.csv"');return res.end(exportCSV((await read('participants.json',{people:[]})).people,await read('houses.json',{})));
        }
        if(path==='/api/participants/import'&&req.method==='POST') {
          const b=await body(req);let plan;
          try{plan=planImport(await read('participants.json',{people:[]}),b.csv,await read('houses.json',{}));}catch(e){return send(res,400,{error:e.message});}
          if(b.commit&&b.revision!==plan.preview.revision)return send(res,409,{error:'Список участников или команды изменились. Повторите предварительную проверку CSV'});
          const bad=validate('participants',plan.document)||validate('houses',plan.houses);if(bad)return send(res,400,{error:bad});
          if(!b.commit)return send(res,200,plan.preview);
          if(plan.preview.errors.length)return send(res,400,{error:'Исправьте ошибки CSV перед импортом',...plan.preview});
          if(!plan.preview.changes.length)return send(res,400,{error:'В CSV нет участников'});
          await importParticipants(b.revision,plan);
          return send(res,200,{ok:true,...plan.preview,invites:await links()});
        }
        if(path==='/api/invitations'&&req.method==='GET')return send(res,200,{invites:await links()});
        if(path==='/api/invitations'&&req.method==='POST') {
          const {id,action}=await body(req);if(!['revoke','rotate'].includes(action)||!(await read('participants.json',{people:[]})).people.some(p=>p.id===id))return send(res,400,{error:'Некорректная операция'});
          await invitations();await write('invitations.json',current=>({...current,[id]:{token:invitationToken(),version:secret(),revoked:action==='revoke'}}));return send(res,200,{invites:await links()});
        }
        const match=/^\/api\/(participants|tasks|houses|program|site)$/.exec(path);
        if(match&&req.method==='PUT') {
          const b=await body(req),bad=validate(match[1],b);if(bad)return send(res,400,{error:bad});await write(FILES[match[1]],b);
          return send(res,200,{ok:true,...(match[1]==='participants'?{invites:await links()}:{})});
        }
        if(path==='/api/app-icon'&&req.method==='POST')return send(res,200,{ok:true,revision:await saveIcons(DATA,ASSETS,await body(req))});
        if(path==='/api/upload'&&req.method==='POST') {
          const b=await body(req);if(!['audio','houses','people','img','login'].includes(b.dir)||typeof b.data!=='string'||!b.data||!/^[A-Za-z0-9+/]*={0,2}$/.test(b.data))return send(res,400,{error:'Недопустимый файл'});
          const ext=extname(String(b.name)).toLowerCase();if(!(b.dir==='audio'?['.mp3','.m4a']:['.png','.jpg','.jpeg','.webp']).includes(ext))return send(res,400,{error:'Недопустимый формат'});
          const file=`upload-${secret()}${ext}`,folder=join(ASSETS,b.dir);await mkdir(folder,{recursive:true});await writeFile(join(folder,file),Buffer.from(b.data,'base64'),{mode:0o600});return send(res,200,{path:`assets/${b.dir}/${file}`});
        }
        return send(res,404,{error:'Не найдено'});
      }
      // No generic file serving: raw content, backups, config and scripts are never public.
      if(Object.values(FILES).some(f=>path==='/'+f))return send(res,user?403:401,{error:'Используйте защищённое приложение'});
      if(path==='/robots.txt'){res.setHeader('content-type','text/plain');return res.end('User-agent: *\nDisallow: /\n')}
      const publicFile=PUBLIC.has(path)||/^\/assets\/fonts\/[a-z0-9-]+\.woff2$/.test(path);
      const asset=/^\/assets\/(audio|houses|people|img|login)\/[A-Za-z0-9._-]+\.(png|jpe?g|webp|mp3|m4a)$/i.test(path);
      if(!publicFile&&!asset)return send(res,404,{error:'Не найдено'});
      if(asset&&!user)return send(res,401,{error:'Требуется вход'});
      const root=asset?ASSETS:WEB;
      const file=asset?join(ASSETS,path.slice('/assets/'.length)):join(WEB,path==='/'?'index.html':path.slice(1));
      if(!existsSync(file)||!statSync(file).isFile())return send(res,404,{error:'Не найдено'});
      if(!(await realpath(file)).startsWith((await realpath(root))+sep))return send(res,403,{error:'Нет доступа'});
      return serveFile(res,file,req);
    } catch(e){if(res.headersSent)res.destroy();else send(res,e.status||500,{error:e.status?e.message:'Ошибка сервера'});}
  });
  return {server,async setPassword(password){if(typeof password!=='string'||password.length<12)throw Error('Пароль должен содержать не менее 12 символов');await write('config.json',c=>({...c,password:passwordHash(password),passwordVersion:secret()}));},data:DATA};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const passwordIndex=process.argv.indexOf('--password'), passwordFileIndex=process.argv.indexOf('--password-file');
  const app=await createApplication({allowHTTP:passwordIndex>=0||passwordFileIndex>=0||process.env.ALLOW_LOCAL_HTTP==='1'});
  if(passwordIndex>=0||passwordFileIndex>=0){await app.setPassword(passwordFileIndex>=0?(await readFile(process.argv[passwordFileIndex+1],'utf8')).replace(/[\r\n]+$/,''):process.argv[passwordIndex+1]);console.log('Пароль обновлён; прежние сессии организатора отозваны.');}
  else app.server.listen(Number(process.env.PORT||3100),process.env.HOST||'127.0.0.1',()=>console.log('Закрытая версия запущена.'));
}

