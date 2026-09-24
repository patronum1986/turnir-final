import { mkdir, cp, readFile, access } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApplication } from './server.js';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export async function prepareAssets(target, source=join(ROOT,'web','assets')) {
  await mkdir(target,{recursive:true});
  for(const dir of ['audio','houses','people','img','login']) {
    try {await access(join(source,dir));}catch(e){if(e.code==='ENOENT')continue;throw e;}
    await cp(join(source,dir),join(target,dir),{recursive:true,force:false,errorOnExist:false});
  }
}
export async function startContainer() {
  if(!process.env.DATA_DIR||!process.env.ASSETS_DIR)throw Error('DATA_DIR and ASSETS_DIR required');
  if(process.env.ALLOW_LOCAL_HTTP==='1')throw Error('Container requires production HTTPS origin');
  await prepareAssets(process.env.ASSETS_DIR);
  const app=await createApplication();
  const cfg=JSON.parse(await readFile(join(app.data,'config.json'),'utf8'));
  if(!cfg.password){
    if(!process.env.ADMIN_PASSWORD_FILE)throw Error('ADMIN_PASSWORD_FILE required on first start');
    await app.setPassword((await readFile(process.env.ADMIN_PASSWORD_FILE,'utf8')).replace(/[\r\n]+$/,''));
  }
  app.server.listen(Number(process.env.PORT||3100),process.env.HOST||'0.0.0.0',()=>console.log('Protected application started'));
  const stop=()=>{app.server.close(()=>process.exit(0));setTimeout(()=>process.exit(1),25000).unref();};
  process.once('SIGTERM',stop);process.once('SIGINT',stop);
  return app;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await startContainer();
