async function refreshAppIcons(){
 try{
  const r=await fetch('/manifest.json',{cache:'no-store'});if(!r.ok)return;
  const m=await r.json(),src=m.icons?.find(x=>x.sizes==='512x512')?.src;
  const version=new URL(src||'/assets/icon-512.png',location.href).search;
  document.querySelector('link[rel="manifest"]').href='/manifest.json'+version;
  document.querySelector('link[rel="icon"]').href='/assets/favicon.png'+version;
  document.querySelector('link[rel="apple-touch-icon"]').href='/assets/apple-touch-icon.png'+version;
  const preview=document.getElementById('appIconPreview');if(preview)preview.src='/assets/icon-512.png'+version;
 }catch{}
}
async function uploadAppIcon(input){
 const file=input.files[0];if(!file)return;input.disabled=true;
 try{
  if(file.type!=='image/png'||file.size>5*1024*1024)throw Error('Выберите PNG 1024×1024 px, не больше 5 МБ');
  const bitmap=await createImageBitmap(file);
  try{
   if(bitmap.width!==1024||bitmap.height!==1024)throw Error('Размер иконки должен быть 1024×1024 px');
   const images={};
   for(const size of [32,180,192,512]){const c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,size,size);ctx.drawImage(bitmap,0,0,size,size);images[size]=c.toDataURL('image/png').split(',')[1];}
   const r=await fetch('/api/app-icon',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({images})});if(!r.ok)throw Error((await r.json()).error||'Не удалось сохранить иконку');
   await refreshAppIcons();toast('Иконка приложения обновлена');
  }finally{bitmap.close();}
 }catch(e){toast(e.message||'Не удалось загрузить иконку');}finally{input.disabled=false;input.value='';}
}
document.addEventListener('change',e=>{if(e.target.id==='appIconFile')void uploadAppIcon(e.target);});
void refreshAppIcons();
