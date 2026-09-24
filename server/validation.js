export function validate(kind, b, translated = false) {
  if (!b || typeof b !== "object" || Array.isArray(b)) return "Ожидался объект";
  if (kind === "participants" && !Array.isArray(b.people)) return "Нет списка people";
  if (kind === "tasks" && (!b.tasks || typeof b.tasks !== "object")) return "Нет объекта tasks";
  if (kind === "houses" && !Array.isArray(b.houses)) return "Нет списка houses";
  if (kind === "program") {
    if (!Array.isArray(b.days) || !b.days.length) return "Нет списка days";
    if (!b.days.every((d) => d && /^\d{4}-\d{2}-\d{2}$/.test(d.date))) return "У дня нет корректной даты";
  }
  if (kind === "site" && !Array.isArray(b.contacts)) return "Нет списка contacts";
  const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const strings = (v, keys) => object(v) && keys.every((k) => v[k] === undefined || typeof v[k] === "string");
  if (kind === "participants" && !b.people.every((p) => strings(p, ["id", "name", "name_en", "bank", "bank_en", "language", "photo", "code"]) && typeof p.name === "string")) return "Некорректный участник";
  if (kind === "tasks" && (!object(b.tasks) || !Object.values(b.tasks).every((t) => strings(t, ["title", "audio", "hint", "unlock", "file"]) && ["open", "off"].every((k) => t[k] === undefined || typeof t[k] === "boolean")))) return "Некорректное задание";
  if (kind === "houses") {
    if (b.mode !== undefined && !["draw", "immediate", "off"].includes(b.mode)) return "Неизвестный режим команд";
    if (!b.houses.every((h) => strings(h, ["id", "name", "motto", "color", "icon"]) && typeof h.id === "string" && typeof h.name === "string")) return "Некорректная команда";
    if (b.assign !== undefined && (!object(b.assign) || !Object.values(b.assign).every((v) => typeof v === "string"))) return "Некорректное распределение";
    if (b.ceremony !== undefined && (!object(b.ceremony) || !Object.entries(b.ceremony).filter(([k])=>k!=='en').every(([,v]) => typeof v === "string"))) return "Некорректная церемония";
  }
  if (kind === "program") {
    if (new Set(b.days.map((d) => d.date)).size !== b.days.length) return "Даты дней повторяются";
    if (!b.days.every((d) => strings(d, ["date", "title", "img", "imgPos"]) && Number.isFinite(Date.parse(d.date)) && new Date(d.date).toISOString().slice(0, 10) === d.date && (d.text === undefined || Array.isArray(d.text) && d.text.every((t) => typeof t === "string")) && (d.schedule === undefined || Array.isArray(d.schedule) && d.schedule.every((r) => Array.isArray(r) && typeof r[0] === "string" && typeof r[1] === "string")))) return "Некорректный день";
    if (b.important !== undefined && (!strings(b.important, ["intro"]) || !Array.isArray(b.important.items) || !b.important.items.every((r) => Array.isArray(r) && typeof r[0] === "string" && typeof r[1] === "string"))) return "Некорректный блок важного";
  }
  if (kind === "site") {
    if (b.peopleSort !== undefined) {
      const s = b.peopleSort;
      if (!object(s) || !["name", "house", "manual"].includes(s.mode) || typeof s.selfFirst !== "boolean" || (s.groupHouses !== undefined && typeof s.groupHouses !== "boolean") || !Array.isArray(s.order) || s.order.length > 10000 || !s.order.every(id => typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id)) || new Set(s.order).size !== s.order.length) return "Некорректная сортировка участников";
    }
    if(b.englishEnabled!==undefined&&typeof b.englishEnabled!=='boolean')return 'Некорректная настройка языка';
    if (b.contactNote !== undefined && (typeof b.contactNote !== "string" || b.contactNote.length > 5000)) return "Некорректный текст контактов";
    if (b.login !== undefined && (!strings(b.login,["title","banner","intro","inputLabel"]) || (b.login.title||"").length > 160 || (b.login.intro||"").length > 2000 || (b.login.inputLabel||"").length > 160 || b.login.banner && !/^assets\/login\/[A-Za-z0-9._-]+\.(png|jpe?g|webp)$/i.test(b.login.banner))) return "Некорректное оформление входа";
    if (typeof b.brand?.footer === "string" && b.brand.footer.length > 240) return "Слишком длинная подпись";
    if (!b.contacts.every((c) => strings(c, ["name", "role", "phone", "wechat", "telegram", "photo"]))) return "Некорректный контакт";
    if (b.places !== undefined && (!Array.isArray(b.places) || !b.places.every((p) => strings(p, ["name", "note", "zh", "phone"])))) return "Некорректный отель";
    if (b.brand !== undefined && (!strings(b.brand, ["cover", "footer"]) || b.brand.sections !== undefined && (!object(b.brand.sections) || !Object.values(b.brand.sections).every((v) => typeof v === "boolean")))) return "Некорректное оформление";
  }
  if (kind === "participants") {
    if(!b.people.every(p=>(p.language===undefined||['ru','en'].includes(p.language))&&(p.name_en_auto===undefined||typeof p.name_en_auto==='boolean')))return 'Некорректный язык участника';
    const valid = key => typeof key === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(key) && !["__proto__", "constructor", "prototype"].includes(key);
    if (!b.people.every(p => valid(p.id) && valid(p.code))) return "Некорректный идентификатор";
    if (new Set(b.people.map(p => p.id)).size !== b.people.length || new Set(b.people.map(p => p.code)).size !== b.people.length) return "Идентификаторы повторяются";
  }
  if(!translated) {
    const allowed=new Set(['name','role','note','title','intro','inputLabel','footer','contactNote','text','schedule','items','hint','motto','cardTitle','cardText','cardButton','introButton','pick','result','button','cover','banner']);
    const textValue=v=>typeof v==='string'&&v.length<=20000||Array.isArray(v)&&v.every(x=>textValue(x)||typeof x==='boolean'||x===null);
    let bad=false;
    const overlay=v=>{
      if(Array.isArray(v))return v.map(overlay);
      if(!v||typeof v!=='object')return v;
      const out=Object.fromEntries(Object.entries(v).filter(([k])=>k!=='en').map(([k,x])=>[k,overlay(x)]));
      if(v.en!==undefined){
        if(!v.en||typeof v.en!=='object'||Array.isArray(v.en)){bad=true;return out;}
        for(const [k,x]of Object.entries(v.en)){if(!allowed.has(k)||!textValue(x)){bad=true;continue;}if(x!=='' )out[k]=x;}
      }
      return out;
    };
    const english=overlay(b);if(bad)return 'Некорректный английский перевод';
    const error=validate(kind,english,true);if(error)return error;
  }
  // Uploaded or external active content must not become a same-origin script.
  const check = v => {
    if (Array.isArray(v)) return v.every(check);
    if (!v || typeof v !== "object") return true;
    return Object.entries(v).every(([k,x]) => {
      if (["photo","img","cover","icon","scrollImg","audio"].includes(k) && x) return typeof x === "string" && (/^assets\/(audio|houses|people|img)\/[A-Za-z0-9._-]+\.(png|jpe?g|webp|mp3|m4a)$/i.test(x) || k === "photo" && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(x));
      if (k === "imgPos" && x) return typeof x === "string" && /^\d{1,3}% \d{1,3}%$/.test(x);
      return check(x);
    });
  };
  if (!check(b)) return "Недопустимый формат ресурса";
  return null;
}

