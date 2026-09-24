/* Participant language, explicit content translations and organiser CSV tools. */
function renderLanguageControl(language=EnglishUI.get(),role=S.role,enabled=S.englishEnabled){
 const control=document.getElementById('languageControl');if(!control)return;
 const parent=document.getElementById(role==='guest'?'accessBannerWrap':'cover');
 if(parent&&control.parentElement!==parent)parent.appendChild(control);
 control.hidden=!enabled;
 const html=['ru','en'].map(lang=>lang===language?`<span aria-current="true">${lang.toUpperCase()}</span>`:`<a href="#" data-language="${lang}" lang="${lang}">${lang.toUpperCase()}</a>`).join('<span class="language-divider" aria-hidden="true">|</span>');
 if(control.innerHTML!==html)control.innerHTML=html;
}
function englishTransliterate(value) {
 const letters={а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',і:'i',ї:'yi',є:'ye',ґ:'g',ў:'u',ә:'a',ғ:'gh',қ:'q',ң:'ng',ө:'o',ұ:'u',ү:'u',һ:'h',ҷ:'j',ӣ:'i',ӯ:'u',ҳ:'h',җ:'zh'};
 return String(value).replace(/\p{Script=Cyrillic}+/gu,word=>{const upper=word===word.toUpperCase();return [...word].map(c=>{const out=letters[c.toLowerCase()]??c;return upper?out.toUpperCase():c===c.toUpperCase()?out.charAt(0).toUpperCase()+out.slice(1):out;}).join('');});
}
function englishOverlay(base,override){
 if(typeof override==='boolean'||override===null)return override;
 if(typeof override==='string')return override.trim()?override:base;
 if(Array.isArray(override))return override.map((v,i)=>englishOverlay(base?.[i],v));
 return base;
}
function englishContent(value){
 if(Array.isArray(value))return value.map(englishContent);
 if(!value||typeof value!=='object')return value;
 const copy=Object.fromEntries(Object.entries(value).map(([k,v])=>[k,k==='en'?v:englishContent(v)]));
 for(const [k,v]of Object.entries(value.en||{}))copy[k]=englishOverlay(copy[k],v);
 return copy;
}
function preferredLanguage(c){
 if(c.site?.englishEnabled===false)return 'ru';
 if(c.role==='admin'){try{return localStorage.getItem('drakon-admin-language')==='en'?'en':'ru';}catch{return 'ru';}}
 if(c.site?.englishEnabled===false)return 'ru';
 let saved;try{saved=localStorage.getItem('drakon-lang-'+c.me?.id);}catch{}
 return ['ru','en'].includes(saved)?saved:c.me?.language==='en'?'en':'ru';
}
function projectEnglish(c){
 S.rawContent=structuredClone(c);S.englishEnabled=c.site?.englishEnabled!==false;const language=preferredLanguage(c);EnglishUI.set(language);
 document.body.classList.toggle('is-organiser',c.role==='admin');
 renderLanguageControl(language,c.role,S.englishEnabled);
 const badge=document.getElementById('editingLanguage');if(badge){badge.hidden=c.role!=='admin';badge.textContent=language==='en'?'Editing English content':'Редактируется русская версия';}
 if(language!=='en')return c;
 const copy=englishContent(c);
 copy.participants.people=copy.participants.people.map(p=>({...p,name:p.name_en||englishTransliterate(p.name),bank:p.bank_en||p.bank}));
 return copy;
}
async function switchLanguage(language){
 if(S.englishEnabled===false)return;
 if(isOrg()){
  if(S.daySaving){toast('Дождитесь сохранения дня');renderLanguageControl();return;}
  if((S.dayEdit>=0||S.taskEdit>=0||S.editId)&&!confirm('Сменить язык и закрыть незавершённую форму?')){renderLanguageControl();return;}
  await flushPending();if(S.pending.size){toast('Сначала сохраните отложенные правки');renderLanguageControl();return;}
  const fresh=await apiContent();if(!fresh){renderLanguageControl();return;}S.rawContent=fresh;
  discardDayEdit();cancelTaskEdit();S.editId=null;S.siteEdit='';S.hEdit=false;S.edit=false;
 }
 try{localStorage.setItem(isOrg()?'drakon-admin-language':S.role==='participant'?'drakon-lang-'+S.code:'drakon-guest-language',language);}catch{}
 EnglishUI.set(language);renderLanguageControl();
 if(S.role!=='guest'&&S.rawContent){
  const selected=S.sel;
  // Draw completion can change after the content used for language projection was loaded.
  // Re-project content without rolling back the current participant's draw state.
  const content=isOrg()?S.rawContent:{...S.rawContent,draws:structuredClone(S.draws)};
  hydrate(content);S.sel=selected;closeCeremony();applyBrand();renderTabs();renderDay();renderStatus();renderPeople();renderContacts();
  if(S.current>=0&&DAYS[S.current]){
    const day=DAYS[S.current],task=T(day),parts=dayParts(day);
    $('plTitle').textContent=`${EnglishUI.t('День')} ${S.current+1}. ${task.title}`;
    $('plSub').textContent=`${pad(parts.dd)}.${pad(parts.m)}, ${day.title}`;
    if(navigator.mediaSession?.metadata)navigator.mediaSession.metadata.title=$('plTitle').textContent;
  }
 }else if(S.publicAppearance)applyLoginAppearance(S.publicAppearance);
}
function bindParticipantEnglish(cur){
 const name=$('pname'),latin=$('pnameEn');if(!name||!latin)return;
 let automatic=EnglishUI.get()!=='en'&&(!cur?.name_en||cur.name_en_auto===true);
 latin.dataset.auto=String(automatic);
 name.addEventListener('input',()=>{if(automatic)latin.value=englishTransliterate(name.value);});
 latin.addEventListener('input',()=>{automatic=false;latin.dataset.auto='false';});
}
function participantEnglishFields(){const field=$('pnameEn');return {name_en:field.value.trim()||englishTransliterate($('pname').value.trim()),name_en_auto:!field.value.trim()||field.dataset.auto==='true',bank_en:$('pbankEn').value.trim(),language:$('planguage').value};}

function closeEnglishDialog(){document.getElementById('englishDialog')?.remove();}
function openEnglishDialog(title){
 closeEnglishDialog();const dialog=document.createElement('dialog');dialog.id='englishDialog';dialog.className='english-dialog';dialog.innerHTML=`<h2>${esc(title)}</h2><div id="englishDialogBody"></div><button type="button" class="btn ghost" id="englishDialogClose">Закрыть</button>`;
 document.body.appendChild(dialog);dialog.querySelector('#englishDialogClose').onclick=()=>dialog.remove();dialog.addEventListener('cancel',()=>dialog.remove());dialog.showModal();return dialog.querySelector('#englishDialogBody');
}
async function csvPreview(file){
 if(!isOrg()||!file)return;if(file.size>2*1024*1024){toast('CSV должен быть не больше 2 МБ');return;}
 await flushPending();if(S.pending.size){toast('Сначала сохраните текущие правки');return;}
 const body=openEnglishDialog('Импорт участников CSV');body.textContent='Проверка файла…';
 try{
  const csv=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());
  const send=payload=>fetch('/api/participants/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const response=await send({csv}),plan=await response.json();if(!response.ok)throw Error(plan.error);
  body.innerHTML=`<p>Добавится: ${plan.added}. Обновится: ${plan.updated}. Остальные карточки останутся без изменений.</p><ul>${plan.errors.map(e=>`<li>${esc(e)}</li>`).join('')}</ul><div class="csv-preview">${plan.changes.map(c=>`<p>${c.line}: ${c.action==='add'?'Добавить':'Обновить'} — ${esc(c.name)}${c.house?' · '+esc(c.house):''}</p>`).join('')}</div><button type="button" class="btn" id="csvConfirm" ${plan.errors.length||!plan.changes.length?'disabled':''}>Подтвердить импорт</button><p id="csvResult" role="status"></p>`;
  $('csvConfirm').onclick=async()=>{
   $('csvConfirm').disabled=true;
   try{const r=await send({csv,commit:true,revision:plan.revision}),result=await r.json();if(!r.ok)throw Error(result.error);const c=await apiContent();if(!c)throw Error('Не удалось обновить список');hydrate(c);renderPeople();closeEnglishDialog();toast(`Импорт выполнен: добавлено ${result.added}, обновлено ${result.updated}`);}
   catch(e){$('csvResult').textContent=e.message;}
  };
 }catch(e){body.textContent=e.message;}
}
async function exportParticipantsCSV(){
 await flushPending();if(S.pending.size){toast('Сначала сохраните текущие правки');return;}
 try{const r=await fetch('/api/participants/export');if(!r.ok)throw Error('Не удалось выгрузить участников');const url=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=url;a.download='participants.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){toast(e.message);}
}
const englishFields=new Set(['name','role','note','title','intro','inputLabel','footer','contactNote','text','schedule','items','hint','motto','cardTitle','cardText','cardButton','introButton','pick','result','button','cover','banner']);
function englishAdmin(){return isOrg()&&EnglishUI.get()==='en';}
// Store edits from the English projection under en, never as Russian originals.
function storeLanguageEdits(kind,edited){
 const original=S.rawContent?.[kind];
 if(!englishAdmin()||!original){if(S.rawContent)S.rawContent[kind]=structuredClone(edited);return edited;}
 let merged;
 if(kind==='participants'){
  merged={...original,people:edited.people.map(p=>{
   const base=original.people.find(x=>x.id===p.id);if(!base)throw Error('Добавьте участника в режиме RU');
   return {...base,name_en:p.name,bank_en:p.bank,name_en_auto:false,language:p.language||base.language||'ru',photo:p.photo};
  })};
 }else{
  const merge=(base,value)=>{
   if(Array.isArray(value)){
    if(!Array.isArray(base)||base.length!==value.length)throw Error('Измените общую структуру в режиме RU');
    return value.map((v,i)=>merge(base[i],v));
   }
   if(!value||typeof value!=='object')return value;
   const out=structuredClone(base||{});
   for(const [key,v]of Object.entries(value)){
    if(key==='en')continue;
    if(kind==='site' && key==='peopleSort'){out[key]=structuredClone(v);continue;}
    if(['cover','banner'].includes(key)&&v===englishContent(base||{})[key])continue;
    if(englishFields.has(key)&&(typeof v==='string'||Array.isArray(v))){out.en??={};out.en[key]=structuredClone(v);}
    else out[key]=merge(base?.[key],v);
   }
   return out;
  };
  merged=merge(original,edited);
 }
 S.rawContent[kind]=structuredClone(merged);return merged;
}
function readLanguageDraft(kind,value){
 if(S.rawContent)S.rawContent[kind]=structuredClone(value);
 if(!englishAdmin())return value;
 const projected=englishContent(value);
 if(kind==='participants')projected.people=projected.people.map(p=>({...p,name:p.name_en||englishTransliterate(p.name),bank:p.bank_en||p.bank}));
 return projected;
}
function restrictEnglishStructure(){
 const selectors='[data-act="dday-add"],[data-act="dday-del"],[data-act="hadd"],[data-hdel],[data-act="cadd"],[data-cdel],[data-act="padd"],[data-pdel2],[data-pdel],#ddate,#dimg,#cscroll,[data-hicon],[data-cphoto],#pphoto,#tfileInput,[data-act="tremove"],[data-act="photo-clear"],[data-act="cscroll-clear"]';
 for(const el of document.querySelectorAll(selectors)){
  if(englishAdmin()){el.disabled=true;el.dataset.englishDisabled='1';el.title='Switch to RU to change shared structure or media.';}
  else if(el.dataset.englishDisabled){el.disabled=false;delete el.dataset.englishDisabled;el.removeAttribute('title');}
 }
 for(const el of document.querySelectorAll('#dpos,#dimp,#topen,#toff,.hi[data-f="color"],[name="house-mode"],[data-act="hspread"],[data-secoff],.si,#phouse,.ci[data-f="phone"],.ci[data-f="wechat"],.ci[data-f="telegram"],.pi[data-f="zh"],.pi[data-f="phone"]'))el.disabled=englishAdmin();
 const create=$('pform');
 if(create&&englishAdmin()&&!S.editId){create.hidden=true;}else if(create)create.hidden=false;
}
function collectTranslationFields(root){
 const fields=[];
 function visit(node,path){
  if(!node||typeof node!=='object')return;
  if(Array.isArray(node)){node.forEach((v,i)=>visit(v,[...path,i]));return;}
  for(const [key,value]of Object.entries(node)){
   if(key==='en')continue;
   if(englishFields.has(key)){
    const collect=(v,tail)=>{if(typeof v==='string'&&v.trim()){let translated=node.en?.[key];for(const index of tail)translated=translated?.[index];fields.push({node,key,tail,source:v,value:typeof translated==='string'?translated:'',path:[...path,key,...tail].join(' / ')});}else if(Array.isArray(v))v.forEach((x,i)=>collect(x,[...tail,i]));};
    collect(value,[]);
   }
   if(value&&typeof value==='object')visit(value,[...path,key]);
  }
 }
 visit(root,[]);return fields;
}
async function editEnglishContent(kind='program'){
 if(!isOrg())return;await flushPending();if(S.pending.size){toast('Сначала сохраните текущие правки');return;}
 const c=await apiContent();if(!c)return;
 const doc=structuredClone(c[kind]);
 // Ensure optional public appearance fields are editable even in older seed files.
 if(kind==='site'){doc.login={...DEFAULT_LOGIN,...doc.login};doc.contactNote??='';}
 const fields=collectTranslationFields(doc),body=openEnglishDialog('Английские версии материалов');
 body.innerHTML=`<label>Раздел <select id="translationKind">${[['program','Программа'],['site','Контакты и оформление'],['houses','Команды и жребий'],['tasks','Задания']].map(([id,label])=>`<option value="${id}" ${id===kind?'selected':''}>${label}</option>`).join('')}</select></label><p>Внесите согласованный перевод. Пустое поле — русский оригинал. Смена раздела закроет несохранённые правки.</p><form id="translationForm">${fields.map((f,i)=>`<label for="translation-${i}">${esc(f.path)}</label><p class="translation-source">${esc(f.source)}</p><textarea id="translation-${i}" rows="2">${esc(f.value)}</textarea>`).join('')}<button class="btn" type="submit">Сохранить английскую версию</button><p id="translationResult" role="status"></p></form>`;
 $('translationKind').onchange=e=>{if(confirm('Перейти в другой раздел без сохранения текущих правок?'))editEnglishContent(e.target.value);else e.target.value=kind;};
 $('translationForm').onsubmit=async e=>{
  e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;
  for(const [i,f]of fields.entries()){
   f.node.en??={};const value=$('translation-'+i).value;
   if(!f.tail.length)f.node.en[f.key]=value;
   else{f.node.en[f.key]??=structuredClone(f.node[f.key]);let target=f.node.en[f.key];f.tail.slice(0,-1).forEach(index=>target=target[index]);target[f.tail.at(-1)]=value;}
  }
  try{await apiPut(kind,doc);const updated=await apiContent();if(!updated)throw Error('Не удалось обновить данные');hydrate(updated);renderTabs();renderDay();renderPeople();renderContacts();applyBrand();closeEnglishDialog();toast('Английская версия сохранена');}
  catch(e){$('translationResult').textContent=e.message;button.disabled=false;}
 };
}
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-english]');if(!b||!isOrg())return;
 if(b.dataset.english==='export')exportParticipantsCSV();
 if(b.dataset.english==='translations')editEnglishContent();
});
document.addEventListener('change',e=>{if(e.target.id==='participantsCSV'&&isOrg()){const file=e.target.files[0];e.target.value='';csvPreview(file);}});
