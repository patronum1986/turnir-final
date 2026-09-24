import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
export const iconSizes={'favicon.png':32,'apple-touch-icon.png':180,'icon-192.png':192,'icon-512.png':512};
export async function iconRevision(data,assets,fallback=false){
 try{
  let text;try{text=await readFile(join(data,'app-icons.json'),'utf8');}catch(e){if(e.code==='ENOENT')return '';throw e;}
  const v=JSON.parse(text);if(!/^[a-f0-9]{32}$/.test(v?.revision))throw Error('Invalid icon revision');
  if(assets)for(const size of Object.values(iconSizes)){
   const b=await readFile(join(assets,'app-icons',`${v.revision}-${size}.png`));
   if(b.length<33||b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||b.toString('ascii',12,16)!=='IHDR'||b.readUInt32BE(16)!==size||b.readUInt32BE(20)!==size)throw Error('Invalid icon file');
  }
  return v.revision;
 }catch(e){if(fallback)return '';throw e;}
}
export async function saveIcons(data,assets,body){
 const images=[];
 for(const size of Object.values(iconSizes)){
  const value=body?.images?.[size];
  if(typeof value!=='string'||value.length>1500000||!value||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw Object.assign(Error('Некорректная иконка'),{status:400});
  const b=Buffer.from(value,'base64');
  if(b.length<33||b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||b.toString('ascii',12,16)!=='IHDR'||b.readUInt32BE(16)!==size||b.readUInt32BE(20)!==size)throw Object.assign(Error('Нужна квадратная иконка PNG нужного размера'),{status:400});
  images.push([size,b]);
 }
 const revision=randomBytes(16).toString('hex'),folder=join(assets,'app-icons');await mkdir(folder,{recursive:true});
 for(const [size,b]of images)await writeFile(join(folder,`${revision}-${size}.png`),b,{mode:0o600});
 const tmp=join(data,`.app-icons-${revision}.tmp`);await writeFile(tmp,JSON.stringify({revision}),{mode:0o600});await rename(tmp,join(data,'app-icons.json'));return revision;
}
