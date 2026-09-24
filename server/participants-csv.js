import {randomBytes,createHash} from 'node:crypto';
export const revision = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function transliterate(value) {
 const letters={а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',і:'i',ї:'yi',є:'ye',ґ:'g',ў:'u',ә:'a',ғ:'gh',қ:'q',ң:'ng',ө:'o',ұ:'u',ү:'u',һ:'h',ҷ:'j',ӣ:'i',ӯ:'u',ҳ:'h',җ:'zh'};
 return String(value).replace(/\p{Script=Cyrillic}+/gu,word=>{const upper=word===word.toUpperCase();return [...word].map(c=>{const out=letters[c.toLowerCase()]??c;return upper?out.toUpperCase():c===c.toUpperCase()?out.charAt(0).toUpperCase()+out.slice(1):out;}).join('');});
}
const columns=['id','name','name_en','bank','bank_en','language','house'];
export function parseCSV(text) {
 if(typeof text!=='string'||text.length>2*1024*1024)throw Error('CSV должен быть текстом UTF-8 размером до 2 МБ');
 text=text.replace(/^\uFEFF/,'');
 const head=text.split(/\r?\n/,1)[0],delimiter=head.includes(';')?';':',';
 const rows=[];let row=[],field='',quoted=false,closed=false;
 const endField=()=>{row.push(field);field='';closed=false;};
 const endRow=()=>{endField();if(row.some(x=>x.trim()))rows.push(row);row=[];};
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
  if(c==='"'){if(field||closed)throw Error('Некорректные кавычки CSV');quoted=true;}
  else if(c===delimiter)endField();
  else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;endRow();}
  else{if(closed)throw Error('Лишние символы после кавычек CSV');field+=c;}
 }
 if(quoted)throw Error('Незакрытые кавычки CSV');if(field||row.length||closed)endRow();
 if(!rows.length)throw Error('CSV пуст');
 const names=rows.shift().map(x=>x.trim().toLowerCase());
 if(new Set(names).size!==names.length||names.some(x=>!columns.includes(x))||!names.includes('name'))throw Error('Колонки: id,name,name_en,bank,bank_en,language,house. Обязательна name');
 if(rows.length>2000)throw Error('Не более 2000 строк за один импорт');
 return rows.map((row,i)=>{if(row.length!==names.length)throw Error(`Строка ${i+2}: число ячеек не совпадает с заголовком`);return Object.fromEntries(names.map((n,k)=>[n,row[k].trim().replace(/^'(?=[=+@-])/,'')]));});
}
export function planImport(current,text,houses={houses:[],assign:{}}) {
 const rows=parseCSV(text),people=structuredClone(current.people),errors=[],changes=[],seen=new Set();
 const assigned=structuredClone(houses.assign||{});
 const normalize=s=>String(s||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('ru');
 for(const [i,row] of rows.entries()){
  const line=i+2,id=row.id||'';
  if(id&&seen.has(id)){errors.push(`Строка ${line}: ID повторяется`);continue;}if(id)seen.add(id);
  if(row.language&&!['ru','en'].includes(row.language)){errors.push(`Строка ${line}: язык должен быть ru или en`);continue;}
  let house=null;
  if(row.house){
   const matches=(houses.houses||[]).filter(h=>[h.name,h.en?.name].filter(Boolean).some(n=>normalize(n)===normalize(row.house)));
   if(matches.length!==1){errors.push(`Строка ${line}: ${matches.length?'название дома неоднозначно':'неизвестный дом'} «${row.house}». Скопируйте название из раздела «Команды»`);continue;}
   house=matches[0];
  }
  let person=id?people.find(p=>p.id===id):null;
  if(id&&!person){errors.push(`Строка ${line}: ID не найден. Проверьте идентификатор`);continue;}
  if(!person){
   if(!row.name){errors.push(`Строка ${line}: для нового участника нужно имя`);continue;}
   if(people.some(p=>normalize(p.name)===normalize(row.name)&&normalize(p.bank)===normalize(row.bank))){errors.push(`Строка ${line}: возможный дубль имени и банка. Укажите ID существующего участника либо уточните имя/банк`);continue;}
   person={id:'p_'+randomBytes(12).toString('hex'),code:'p_'+randomBytes(12).toString('hex'),name:'',bank:'',photo:'',language:'ru'};people.push(person);
  }
  const created=!id;
  for(const k of ['name','bank','bank_en','language'])if(row[k])person[k]=row[k];
  if(row.name_en){person.name_en=row.name_en;person.name_en_auto=false;}
  else if(!person.name_en||person.name_en_auto){person.name_en=transliterate(person.name);person.name_en_auto=true;}
  if(house)assigned[person.code]=house.id;
  const selected=(houses.houses||[]).find(h=>h.id===assigned[person.code]);
  changes.push({line,action:created?'add':'update',id:person.id,name:person.name,house:selected?.name||''});
 }
 return {document:{...current,people,updated:new Date().toISOString().slice(0,10)},houses:{...houses,assign:assigned},preview:{revision:revision({participants:current,houses}),added:changes.filter(x=>x.action==='add').length,updated:changes.filter(x=>x.action==='update').length,errors,changes}};
}
export function exportCSV(people,houses={houses:[],assign:{}}){const cell=value=>'"'+(/^[=+@-]/.test(String(value||''))?"'":'')+String(value||'').replace(/"/g,'""')+'"';return '\uFEFF'+[columns,...people.map(p=>columns.map(k=>k==='house'?(houses.houses||[]).find(h=>h.id===houses.assign?.[p.code])?.name||'':k==='language'?p.language||'ru':p[k]||''))].map(row=>row.map(cell).join(';')).join('\r\n');}
