const nativeFetch = window.fetch.bind(window);
window.fetch = (input, options = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url, location.href);
  const headers = new Headers(options.headers || {});
  if (url.origin === location.origin && ["POST", "PUT"].includes((options.method || "GET").toUpperCase())) headers.set("X-Requested-With", "drakon-secure");
  headers.delete("authorization");
  return nativeFetch(input, { ...options, headers, credentials: "same-origin" });
};
/* =====================================================================
   ПУТЬ ДРАКОНА — программа поездки с аудиозаданиями
   Весь контент — в TRIP и DAYS ниже. Остальной код трогать не нужно.
   ===================================================================== */

const TRIP = {
  name: "Путь Дракона",
  group: "Турнир лидеров 2026 · Группа РФ",
  tzOffset: "+08:00",          // Пекин и Хайнань — один пояс, UTC+8
  tzLabel: "по Пекину",
  unlockTime: "05:00",         // во сколько по местному открывается задание дня
  version: "english-20260921-10",               // для подписи внизу; держите в паре с CACHE в sw.js
};

/* Форматирование абзацев в text: "**…" — жирный абзац, "!!…" — красный акцент.
   Аудиозадания здесь НЕ описываются — они в tasks.json и заполняются через админ-панель
   (режим организатора → «Изменить задание» под карточкой дня). */
const DEFAULT_DAYS = [{date:"2000-01-01",title:"",img:"",text:[],schedule:[]}];

const DEFAULT_IMPORTANT = {intro:"",items:[]};

/* Контакты организаторов. phone — в международном формате, wechat — ID (не номер), telegram — имя пользователя, @имя или ссылка t.me.
   Пустое поле не показывается. */
const DEFAULT_CONTACTS = [];

/* Отели — карточка «показать таксисту». Китайские названия ПРОВЕРИТЬ у принимающей стороны. */
const DEFAULT_PLACES = [];

/* ===================================================================== */

// Программа, контакты и оформление живут в program.json и site.json и правятся
// из админки. Константы выше — только исходное наполнение при первом запуске.
let DAYS = DEFAULT_DAYS;
let IMPORTANT = DEFAULT_IMPORTANT;
const DEFAULT_LOGIN = {intro:"Откройте приглашение или войдите как организатор. Для первого входа нужен интернет.",inputLabel:"Персональная ссылка или код",title:"Турнир Лидеров - 2026",banner:"assets/login/default.jpg"};
const DEFAULT_CONTACT_NOTE = "";
const DEFAULT_BRAND = { cover: "", footer: "Турнир Лидеров 2026", sections: { people: true, contacts: true } };

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const LS = { had: "pds-had-all", org: "pds-org", people: "pds-people-draft", tasks: "pds-tasks-draft", houses: "pds-houses-draft", program: "pds-program-draft", site: "pds-site-draft", view: "pds-view", me: "pds-me", drawn: "pds-drawn", token: "pds-token", pending: "pds-pending", content: "pds-content-cache", draws: "pds-draw-pending" };
const MONTHS = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
const WD = ["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"];
const WD_SHORT = ["вс","пн","вт","ср","чт","пт","сб"];

const ICON = {
  play: '<svg class="i-play" viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  pause: '<svg class="i-pause" viewBox="0 0 24 24"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><path d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zm-7-2a2 2 0 0 1 4 0v2h-4zm3 9.7V18h-2v-1.3a2 2 0 1 1 2 0z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.4 14.2-4.3-4.3 1.4-1.4 2.9 2.9 5.9-5.9 1.4 1.4z"/></svg>',
  hourglass: '<svg viewBox="0 0 24 24"><path d="M6 2h12v5l-4 5 4 5v5H6v-5l4-5-4-5zm2 2v2.3L12 11l4-4.7V4z"/></svg>',
  share: '<svg class="share" viewBox="0 0 24 24"><path d="M12 2 7.5 6.5l1.4 1.4L11 5.8V15h2V5.8l2.1 2.1 1.4-1.4zM5 10v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10h-2v10H7V10z"/></svg>',
};

/* ---------- Время ---------- */
// Всё считаем по абсолютному моменту (UTC), а показываем по пекинскому времени.
const OFFSET_MIN = (() => { const m = TRIP.tzOffset.match(/([+-])(\d\d):(\d\d)/); return (m[1] === "-" ? -1 : 1) * (+m[2] * 60 + +m[3]); })();
const now = () => Date.now();
const unlockAt = (d) => Date.parse(T(d).unlock || `${d.date}T${TRIP.unlockTime}:00${TRIP.tzOffset}`);
const localParts = (ms) => { const t = new Date(ms + OFFSET_MIN * 60000); return { y: t.getUTCFullYear(), mo: t.getUTCMonth(), d: t.getUTCDate(), h: t.getUTCHours(), mi: t.getUTCMinutes(), wd: t.getUTCDay() }; };
const pad = (n) => String(n).padStart(2, "0");
const dayParts = (d) => { const [y, m, dd] = d.date.split("-").map(Number); const wd = new Date(Date.UTC(y, m - 1, dd)).getUTCDay(); return { y, m, dd, wd }; };
const tripToday = () => { const p = localParts(now()); return `${p.y}-${pad(p.mo + 1)}-${pad(p.d)}`; };
const isOrg = () => S.role === "admin";
/* Задание дня = запись из tasks.json (или черновик организатора на этом телефоне) */
const T = (d) => Object.assign({ title: "Задание дня", audio: "", hint: "", open: false, off: false }, (S.tasks || {})[d.date] || {});
const isOpen = (d) => isOrg() || T(d).open === true || now() >= unlockAt(d);

function lockText(d) {
  const at = unlockAt(d), p = localParts(at);
  const main = `Откроется ${p.d} ${MONTHS[p.mo]} в ${pad(p.h)}:${pad(p.mi)}`;
  let sub = `${TRIP.tzLabel[0].toUpperCase()}${TRIP.tzLabel.slice(1)}.`;
  const left = at - now();
  if (left > 0 && left < 24 * 3600e3) {
    const mins = Math.ceil(left / 60000), h = Math.floor(mins / 60), m = mins % 60;
    sub += h ? ` Осталось ${h} ч ${m} мин` : ` Осталось ${m} мин`;
  } else {
    // Если телефон ещё живёт по домашнему времени — подскажем, когда это по его часам
    const dev = new Date(at);
    if (-dev.getTimezoneOffset() !== OFFSET_MIN) {
      sub += ` На вашем телефоне: ${dev.getDate()} ${MONTHS[dev.getMonth()]}, ${pad(dev.getHours())}:${pad(dev.getMinutes())}`;
    }
  }
  return { main, sub };
}

/* ---------- IndexedDB: аудио хранится как blob ---------- */
let dbp;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open("put-drakona-secure", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("audio");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function idb(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const tx = d.transaction("audio", mode), st = tx.objectStore("audio");
    const r = fn(st);
    tx.oncomplete = () => res(r && r.result);
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error);
  });
}
const idbGetAll = () => db().then((d) => new Promise((res, rej) => {
  const out = new Map();
  const tx = d.transaction("audio", "readonly"); const c = tx.objectStore("audio").openCursor();
  c.onsuccess = () => { const cur = c.result; if (cur) { out.set(cur.key, cur.value); cur.continue(); } };
  tx.oncomplete = () => res(out); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
}));
const idbPut = (k, v) => idb("readwrite", (s) => s.put(v, k));
const idbDel = (k) => idb("readwrite", (s) => s.delete(k));

/* ---------- Состояние ---------- */
const S = {
  sel: 0,
  tasks: {}, fileTasks: {}, tasksDraft: false, tasksLoaded: false, taskEdit: -1, pendingAudio: null,
  houses: null, fileHouses: null, housesDraft: false, hEdit: false, code: "", pendingIcons: {},
  server: true, token: "", role: "guest", invites: {}, offlineUntil: 0, draws: {}, drawPending: {}, drawSyncing: false,
  site: null, programDraft: false, siteDraft: false, dayEdit: -1, siteEdit: "", pending: new Set(), refreshing: false,
  saved: new Map(),     // url → objectURL (готово к мгновенному воспроизведению)
  busy: false, doneN: 0, fileP: 0, error: "",
  current: -1,          // индекс дня, чья запись в плеере
  installEvt: null,
};
// Всё, что должно оказаться на телефоне: записи, иконки команд, свиток, баннер и фото дней
const tracks = () => [...new Set([
  ...DAYS.map((d) => (T(d).off ? "" : T(d).audio)),
  ...((S.houses && S.houses.houses) || []).map((h) => h.icon),
  (S.houses && S.houses.ceremony && S.houses.ceremony.scrollImg) || "",
  brand().cover,
  S.rawContent?.site?.brand?.cover, S.rawContent?.site?.brand?.en?.cover,
  S.rawContent?.site?.login?.banner, S.rawContent?.site?.login?.en?.banner,
  ...DAYS.map((d) => d.img),
  ...(S.people || []).map(p => p.photo).filter(p => p && !p.startsWith("data:")),
  ...(S.site?.contacts || []).map(p => p.photo).filter(p => p && !p.startsWith("data:")),
].filter(Boolean))];
const imgSrc = (p) => S.saved.get(p) || p || "";

async function loadSaved() {
  try {
    const all = await idbGetAll(), want = new Set(tracks());
    for (const [k, v] of all) {
      if (!want.has(k)) { if (S.tasksLoaded && !S.tasksDraft) idbDel(k); continue; } // старые/переименованные файлы
      if (v && v.blob && v.blob.size) S.saved.set(k, URL.createObjectURL(v.blob));
    }
  } catch (e) { S.error = "Браузер не даёт сохранять записи. Откройте гид в Safari или Chrome, не в режиме инкогнито."; }
}

async function fetchBlob(url, onP) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = /\.webp$/i.test(url) ? "image/webp" : /\.png$/i.test(url) ? "image/png" : /\.jpe?g$/i.test(url) ? "image/jpeg" : /\.m4a$|\.aac$/i.test(url) ? "audio/mp4" : "audio/mpeg";
  const total = +res.headers.get("content-length") || 0;
  if (!res.body || !total) return new Blob([await res.arrayBuffer()], { type });
  const rd = res.body.getReader(), parts = []; let got = 0;
  for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; onP(got / total); }
  return new Blob(parts, { type });
}

async function downloadAll() {
  if (S.busy) return;
  if (!navigator.onLine) { toast("Нет интернета. Подключитесь к Wi-Fi и нажмите ещё раз."); return; }
  S.busy = true; S.error = ""; const list = tracks();
  S.doneN = list.filter((u) => S.saved.has(u)).length; renderStatus();
  for (let i = 0; i < list.length; i++) {
    const url = list[i]; if (S.saved.has(url)) continue;
    S.fileP = 0; renderStatus();
    try {
      const blob = await fetchBlob(url, (p) => { S.fileP = p; paintBar(); });
      await idbPut(url, { blob, at: Date.now() });
      S.saved.set(url, URL.createObjectURL(blob)); S.doneN++;
    } catch (e) {
      S.error = `Загрузка прервалась на записи ${S.doneN + 1} из ${list.length}. Проверьте интернет и нажмите «Докачать» — уже сохранённые записи не пропадут.`;
      break;
    }
  }
  S.busy = false;
  if (tracks().every((u) => S.saved.has(u))) {
    localStorage.setItem(LS.had, "1");
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) {}
  }
  renderStatus(); renderDay();
}

/* ---------- Платформа ---------- */
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); S.installEvt = e; renderStatus(); });

/* ---------- Плашка статуса ---------- */
function paintBar() {
  const b = document.querySelector("#status .bar i"); if (!b) return;
  const n = tracks().length; b.style.width = `${Math.min(100, ((S.doneN + S.fileP) / n) * 100)}%`;
  const t = document.querySelector("#status h2"); if (t && S.busy) t.textContent = `Сохраняю записи: ${Math.min(S.doneN + 1, n)} из ${n}`;
}

function renderStatus() {
  const el = $("status"), n = tracks().length, have = tracks().filter((u) => S.saved.has(u)).length;
  const org = isOrg() ? `<div class="org">Режим организатора: все задания открыты. <button class="linkbtn" data-act="org-off">Выключить</button>${canDraw() ? ` · <button class="linkbtn" data-act="cer-test">Показать жребий заново</button>` : ""}${S.server ? "" : hasDraft() ? `<div class="draft">Есть правки, которых пока нет на сайте. <button class="linkbtn" data-act="pack">Скачать пакет для сайта</button> · <button class="linkbtn" data-act="pack-clear">Правки уже выложены</button></div>` : ""}</div>` : "";
  el.className = "status";

  if (S.busy) {
    el.innerHTML = `<h2></h2><div class="bar"><i></i></div><p>Не закрывайте страницу до конца загрузки.</p>`;
    paintBar(); return;
  }
  if (have === n && n > 0 && !S.error) {
    el.className = "status ok";
    el.innerHTML = `${ICON.check}<h2>Все записи сохранены. Гид работает без интернета.</h2>${org}`;
    return;
  }

  const lost = localStorage.getItem(LS.had) === "1" && have < n;
  let h, p, btn;
  if (lost) {
    el.className = "status bad";
    h = "Часть записей удалена с телефона";
    p = `Сохранено ${have} из ${n}. Подключитесь к интернету и скачайте заново.`;
    btn = "Скачать заново";
  } else if (have === 0) {
    h = "Записи ещё не сохранены";
    p = "Скачайте их заранее, дома по Wi-Fi, — в Китае гид будет работать без интернета.";
    btn = "Скачать всё";
  } else {
    h = `Сохранено ${have} из ${n}`;
    p = "Докачайте остальные, пока есть интернет.";
    btn = "Докачать";
  }
  if (S.error) { p = S.error; if (!lost) el.className = "status bad"; }

  let hint = "";
  if (isIOS && !isStandalone()) {
    hint = `<div class="hint"><b>Сначала добавьте гид на экран «Домой».</b> В Safari нажмите ${ICON.share} «Поделиться» → «На экран „Домой“». Потом откройте гид с иконки и скачайте записи уже там: из обычного Safari они сотрутся через неделю.</div>`;
  }
  const inst = S.installEvt ? `<button class="btn ghost" data-act="install">Установить на телефон</button>` : "";
  el.innerHTML = `<h2>${h}</h2><p>${p}</p>${hint}<div class="row"><button class="btn" data-act="dl">${btn}</button>${inst}</div>${org}`;
}

/* ---------- Вкладки ---------- */
function renderTabs() {
  const today = tripToday();
  $("tabs").innerHTML = DAYS.map((d, i) => {
    const p = dayParts(d);
    return `<button class="tab${d.date === today ? " today" : ""}" role="tab" aria-selected="${i === S.sel}" data-day="${i}">
      <small>День ${i + 1}</small><span>${pad(p.dd)}.${pad(p.m)}</span></button>`;
  }).join("");
  if (isOrg()) $("tabs").insertAdjacentHTML("beforeend", `<button class="tab addday" data-act="dday-add" aria-label="Добавить день"><small>&nbsp;</small><span>+</span></button>`);
  const a = $("tabs").querySelector('[aria-selected="true"]');
  if (a) a.scrollIntoView({ block: "nearest", inline: "center" });
}

/* ---------- День ---------- */
function para(t) {
  if (t.startsWith("**")) return `<p class="strong${para.first ? " lead" : ""}">${esc(t.slice(2))}</p>`;
  if (t.startsWith("!!")) return `<p class="accent">${esc(t.slice(2))}</p>`;
  return `<p>${esc(t)}</p>`;
}

function taskHTML(d, i, justOpened) {
  const t = T(d);
  let card;
  if (t.off) {
    card = ""; // блок скрыт для этого дня
  } else if (!t.audio) {
    card = `<div class="task pending"><div class="lock">${ICON.hourglass}</div><div class="tt"><h3>${esc(t.title)}</h3><p>Запись готовится</p></div></div>`;
  } else if (!isOpen(d)) {
    const l = lockText(d);
    card = `<div class="task locked" data-lock="${i}"><div class="lock">${ICON.lock}</div><div class="tt"><h3>${esc(t.title)}</h3><p>${esc(l.main)}</p>${l.sub ? `<p class="sub">${esc(l.sub)}</p>` : ""}</div></div>`;
  } else {
    const playing = S.current === i && !A.paused;
    const note = t.hint || (S.saved.has(t.audio) ? "Запись открыта. Слушайте, когда будете готовы." : "Запись открыта, но не сохранена на телефон.");
    card = `<div class="task${playing ? " playing" : ""}${justOpened ? " just-opened" : ""}" data-task="${i}">
      <div class="tt"><h3>${esc(t.title)}</h3><p${t.hint ? ' class="custom-hint"' : ""}>${esc(note)}</p></div>
      <button class="go" data-play="${i}" aria-label="${playing ? "Пауза" : "Слушать задание"}">${ICON.play}${ICON.pause}</button></div>`;
  }
  return card + (isOrg() ? taskAdminHTML(d, i, t) + dayAdminHTML(d, i) : "");
}

function renderDay(justOpened) {
  const i = S.sel, d = S.dayEdit === i && S.dayDraft ? S.dayDraft : DAYS[i]; if (!d) { $("day").innerHTML = ""; return; }
  const p = dayParts(d);
  para.first = true;
  const story = (d.text || []).map((t, k) => { const h = para(t); para.first = false; return h; }).join("");
  const sched = (d.schedule || []).length
    ? `<ul class="sched">${d.schedule.map(([tm, what, acc]) => `<li${acc ? ' class="accent"' : ""}><time>${esc(tm)}</time><span>${esc(what)}</span></li>`).join("")}</ul>` : "";
  const imp = d.important
    ? `<section class="panel solo imp"><h2>Важное<i>:</i></h2><p>${esc(IMPORTANT.intro)}</p><ul>${IMPORTANT.items.map(([b, t]) => `<li><b>${esc(b)}</b> — ${esc(t)}</li>`).join("")}</ul></section>` : "";

  $("day").innerHTML = `<article class="day">
    <div class="hero"><img src="${esc(imgSrc(d.img))}" alt="" style="object-position:${esc(d.imgPos || "50% 50%")}"><div class="pill">${esc(d.title)}</div></div>
    <section class="panel first">
      <div class="dhead"><h1>День ${i + 1}</h1><div class="date">${pad(p.dd)}.${pad(p.m)}<i>|</i>${WD[p.wd]}</div></div>
      ${taskHTML(d, i, justOpened)}
      ${sched}
    </section>
    <section class="panel solo story">${story}</section>
    ${imp}
  </article>`;
  if (S.dayEdit === i) bindDayEditor(i);
}

function selectDay(i) {
  S.sel = i; renderTabs(); renderDay();
  const y = $("day").getBoundingClientRect().top + scrollY - $("tabs").offsetHeight;
  if (scrollY > y) scrollTo(0, y);
}

/* ---------- Плеер ---------- */
const A = new Audio(); A.preload = "auto";
const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };
const absUrl = (u) => new URL(u, location.href).href;

function playDay(i) {
  const d = DAYS[i], t = T(d); if (!t.audio || !isOpen(d)) return;
  if (S.current === i && A.src) { A.paused ? A.play() : A.pause(); return; }
  let src = S.saved.get(t.audio);
  if (!src) {
    if (!navigator.onLine) { toast("Эта запись не сохранена на телефон. Подключитесь к интернету и нажмите «Скачать всё»."); return; }
    src = t.audio;   // есть сеть — играем напрямую
  }
  S.current = i;
  A.src = src; A.play().catch(() => toast("Не удалось включить запись. Нажмите ещё раз."));
  const p = dayParts(d);
  $("plThumb").src = imgSrc(d.img);
  $("plTitle").textContent = `${EnglishUI.t("День")} ${i + 1}. ${t.title}`;
  $("plSub").textContent = `${pad(p.dd)}.${pad(p.m)}, ${d.title}`;
  $("player").hidden = false; document.body.classList.add("has-player");
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${EnglishUI.t("День")} ${i + 1}. ${t.title}`, artist: TRIP.name, album: d.title,
      artwork: [{ src: absUrl(imgSrc(d.img)), sizes: "1200x408", type: "image/jpeg" }, { src: absUrl("assets/icon-512.png"), sizes: "512x512", type: "image/png" }],
    });
  }
}

function syncPlaying() {
  const on = !A.paused && !A.ended;
  $("player").classList.toggle("playing", on);
  $("plToggle").setAttribute("aria-label", on ? "Пауза" : "Слушать");
  document.querySelectorAll(".task[data-task]").forEach((el) => el.classList.toggle("playing", on && +el.dataset.task === S.current));
  if ("mediaSession" in navigator) navigator.mediaSession.playbackState = on ? "playing" : "paused";
}
let seeking = false;
A.addEventListener("play", syncPlaying);
A.addEventListener("pause", syncPlaying);
A.addEventListener("ended", syncPlaying);
A.addEventListener("loadedmetadata", () => { $("plDur").textContent = fmt(A.duration); });
A.addEventListener("timeupdate", () => {
  $("plCur").textContent = fmt(A.currentTime);
  if (!seeking && A.duration) $("plRange").value = Math.round((A.currentTime / A.duration) * 1000);
  if ("mediaSession" in navigator && A.duration && navigator.mediaSession.setPositionState) {
    try { navigator.mediaSession.setPositionState({ duration: A.duration, position: A.currentTime, playbackRate: 1 }); } catch (e) {}
  }
});
$("plToggle").onclick = () => { A.paused ? A.play() : A.pause(); };
$("plBack").onclick = () => { A.currentTime = Math.max(0, A.currentTime - 15); };
$("plFwd").onclick = () => { if (A.duration) A.currentTime = Math.min(A.duration - 0.5, A.currentTime + 15); };
$("plRange").addEventListener("input", () => { seeking = true; if (A.duration) $("plCur").textContent = fmt((A.duration * $("plRange").value) / 1000); });
$("plRange").addEventListener("change", () => { if (A.duration) A.currentTime = (A.duration * $("plRange").value) / 1000; seeking = false; });
if ("mediaSession" in navigator) {
  const ms = navigator.mediaSession, set = (a, f) => { try { ms.setActionHandler(a, f); } catch (e) {} };
  set("play", () => A.play()); set("pause", () => A.pause());
  set("seekbackward", () => { A.currentTime = Math.max(0, A.currentTime - 15); });
  set("seekforward", () => { A.currentTime = Math.min(A.duration || 0, A.currentTime + 15); });
  set("seekto", (e) => { A.currentTime = e.seekTime; });
}

/* ---------- Мелочи ---------- */
let toastT;
function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 4200); }

async function sha256(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// Организатор может войти с экрана доступа или удержанием обложки.
(() => {
  let timer; const cover = $("cover");
  cover.addEventListener("pointerdown", (e) => { clearTimeout(timer);if(e.target.closest(".language-control")||e.button!==0)return; timer = setTimeout(() => { if (!isOrg()) void promptOrganiserLogin(); }, 1500); });
  ["pointerup", "pointercancel", "pointerleave"].forEach(event => cover.addEventListener(event, () => clearTimeout(timer)));
})();

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-day],[data-play],[data-act]"); if (!b) return;
  if (b.dataset.day) selectDay(+b.dataset.day);
  else if (b.dataset.play) playDay(+b.dataset.play);
  else if (b.dataset.act === "dl") downloadAll();
  else if (b.dataset.act === "install" && S.installEvt) { S.installEvt.prompt(); S.installEvt = null; renderStatus(); }
  else if (b.dataset.act === "org-off") logoutSecure();
});

// Раз в 20 секунд проверяем, не пора ли открыть задание
let lastOpen = DAYS.map(isOpen);
function tick() {
  if(S.dayEdit>=0||S.taskEdit>=0||S.daySaving)return;
  const open = DAYS.map(isOpen);
  const changed = open.some((o, i) => o !== lastOpen[i]);
  const newlyOpenSel = open[S.sel] && !lastOpen[S.sel];
  lastOpen = open;
  if (changed) { renderTabs(); renderDay(newlyOpenSel); }
  else if (!open[S.sel]) { const l = document.querySelector(".task.locked"); if (l) renderDay(); }
}
setInterval(tick, 20000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) { tick(); refresh(); } });
addEventListener("online", () => { renderStatus(); refresh(); flushPending(); });
addEventListener("offline", renderStatus);

// Перечитываем данные с сервера, чтобы правки организатора доходили без перезагрузки
async function refresh() {
  if (S.role === "guest" || S.refreshing || !navigator.onLine) return;
  if (S.edit || S.hEdit || S.siteEdit || S.dayEdit > -1 || S.taskEdit > -1) return; // не мешаем редактированию
  S.refreshing = true;
  try {
    let c = await apiContent();
    if (c) {
      applyIdentity(c); c=projectEnglish(c);
      const keep = S.pending, before = JSON.stringify([DAYS, S.tasks, S.people, S.houses, S.site, S.draws]);
      S.draws = c.draws || {};
      if (!keep.has("participants")) { S.filePeople = c.participants.people || []; S.people = S.filePeople; }
      if (!keep.has("tasks")) { S.fileTasks = c.tasks.tasks || {}; S.tasks = S.fileTasks; }
      if (!keep.has("houses")) { S.fileHouses = c.houses; S.houses = c.houses; }
      if (!keep.has("program")) applyProgram(c.program);
      if (!keep.has("site")) applySite(c.site);
      if (JSON.stringify([DAYS, S.tasks, S.people, S.houses, S.site, S.draws]) !== before) {
        if (S.sel >= DAYS.length) S.sel = Math.max(0, DAYS.length - 1);
        if (!canDraw() && !$("ceremony").hidden) closeCeremony();
        applyBrand(); renderTabs(); renderDay(); renderHouse(); renderStatus();
        if (S.view === "people") renderPeople(); else if (S.view === "contacts") renderContacts();
      }
    }
  } catch (e) {} finally { S.refreshing = false; }
  if (online()) flushPending();
  syncDraws();
}
setInterval(refresh, 5 * 60e3);


/* =====================================================================
   РАЗДЕЛЫ: Программа / Участники / Контакты
   ===================================================================== */
const VIEWS = ["program", "people", "contacts"];
S.view = VIEWS.includes(localStorage.getItem(LS.view)) ? localStorage.getItem(LS.view) : "program";
S.people = []; S.filePeople = []; S.draft = false; S.edit = false; S.editId = null; S.q = ""; S.photo = "";

function showView(v) {
  if (!sectionOn(v)) v = "program";
  S.view = v; localStorage.setItem(LS.view, v);
  VIEWS.forEach((k) => { $("view-" + k).hidden = k !== v; });
  document.querySelectorAll(".nav button").forEach((b) => b.setAttribute("aria-current", b.dataset.view === v ? "page" : "false"));
  if (v === "people") renderPeople();
  if (v === "contacts") renderContacts();
  scrollTo(0, 0);
}

/* ---------- Участники ---------- */
const PEOPLE_URL = "participants.json";
const AVA_COLORS = ["#FF0A3C", "#C9971E", "#12875A", "#2F6FD6", "#8A4FBF", "#D6672F", "#0F8F9E"];
const initials = (n) => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();
const hue = (n) => AVA_COLORS[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % AVA_COLORS.length];
const avatar = (p, cls = "ava") => p.photo
  ? `<span class="${cls}"><img src="${p.photo}" alt=""></span>`
  : `<span class="${cls}" style="background:${hue(p.name || "?")}">${esc(initials(p.name || "?"))}</span>`;
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);

function readDraft() {
  try { const stored = JSON.parse(localStorage.getItem(LS.people) || "null"); const j=stored?readLanguageDraft("participants",stored):null; if (j && Array.isArray(j.people)) { S.people = j.people; S.draft = true; } } catch (e) {}
}
function saveDraft() {
  pushDebounced("participants", () => JSON.parse(peopleJSON()));
  if (online()) return;
  localStorage.setItem(LS.people, JSON.stringify({ updated: new Date().toISOString().slice(0, 10), people: S.people }));
  S.draft = true;
}
async function loadPeople() {
  readDraft();
  try {
    const r = await fetch(PEOPLE_URL, { cache: "no-store" });
    if (r.ok) { const j = await r.json(); S.filePeople = Array.isArray(j.people) ? j.people : []; if (!S.draft) S.people = S.filePeople; }
  } catch (e) {}
  if (S.view === "people") renderPeople();
}

// Participant ordering is shared; only organisers can change its settings.
function peopleSortSettings() {
  return Object.assign({ mode: "name", selfFirst: false, groupHouses: false, order: [] }, S.site?.peopleSort || {});
}
function manualPeopleOrder(people, order) {
  const rank = new Map(order.map((id, i) => [id, i]));
  return [...people].sort((a, b) => (rank.get(a.id) ?? order.length) - (rank.get(b.id) ?? order.length));
}
function peopleSortMode() {
  const mode = peopleSortSettings().mode;
  if (mode !== "house" || (isOrg() && S.edit)) return mode;
  // Do not expose an unrevealed assignment through list position or headings.
  if (!housesOn() || (houseMode() !== "immediate" && !S.people.every(p => hasDrawn(p.code)))) return "name";
  return mode;
}
function orderedPeople(list, mode = peopleSortMode(), pin = !(isOrg() && S.edit)) {
  const settings = peopleSortSettings();
  const byName = (a, b) => a.name.localeCompare(b.name, EnglishUI.get());
  let result;
  if (mode === "manual") result = manualPeopleOrder(list, settings.order);
  else if (mode === "house") {
    const houses = hList(), rank = p => {
      const i = houses.findIndex(h => h.id === assignOf(p.code));
      return i < 0 ? houses.length : i;
    };
    result = [...list].sort((a, b) => rank(a) - rank(b) || byName(a, b));
  } else result = [...list].sort(byName);
  if (pin && settings.selfFirst && S.code) {
    const i = result.findIndex(p => p.code === S.code);
    if (i > 0) result.unshift(result.splice(i, 1)[0]);
  }
  return result;
}
function updatePeopleSort(patch) {
  if (!isOrg()) return;
  const settings = peopleSortSettings();
  if (patch.mode === "manual") settings.order = manualPeopleOrder(S.people, settings.order).map(p => p.id);
  S.site.peopleSort = Object.assign(settings, patch);
  saveSite(); renderPeople();
}
function movePerson(id, direction) {
  if (!isOrg() || !S.edit || S.q.trim() || peopleSortSettings().mode !== "manual") return;
  const order = manualPeopleOrder(S.people, peopleSortSettings().order).map(p => p.id);
  const i = order.indexOf(id), j = i + direction;
  if (i < 0 || j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]];
  updatePeopleSort({ order });
}

function renderPeople() {
  const el = $("view-people"), org = isOrg();
  const q = S.q.trim().toLowerCase();
  const list = S.people.filter((p) => !q || (p.name + " " + (p.bank || "")).toLowerCase().includes(q));
  const settings = peopleSortSettings(), sortMode = peopleSortMode();
  const sorted = orderedPeople(list, sortMode);
  const ordering = org && S.edit && settings.mode === "manual";
  const rows = (arr) => arr.map((p) => {
    const mine = p.code && p.code === S.code, h = mine ? myHouse() : houseById(assignOf(p.code));
    const showH = h && ((isOrg() && S.edit) || (housesOn() && (houseMode() === "immediate" || hasDrawn(p.code))));
    return `<div class="prow">${avatar(p)}<div class="pmain"><div class="pname">${esc(p.name)}${mine ? ' <span class="you">вы</span>' : ""}</div>${p.bank ? `<div class="pbank">${esc(p.bank)}</div>` : ""}${showH ? `<div class="phouse"><img class="hb" src="${esc(iconSrc(h))}" alt="">${esc(h.name)}</div>` : ""}</div>
    ${ordering ? `<div class="people-move"><button type="button" class="icobtn" data-move-person="${esc(p.id)}" data-direction="-1" aria-label="Поднять участника" ${q || sorted[0] === p ? "disabled" : ""}>↑</button><button type="button" class="icobtn" data-move-person="${esc(p.id)}" data-direction="1" aria-label="Опустить участника" ${q || sorted[sorted.length - 1] === p ? "disabled" : ""}>↓</button></div>` : ""}
    ${S.edit ? `<div class="acts"><button class="icobtn" data-pedit="${esc(p.id)}" aria-label="Изменить"><svg viewBox="0 0 24 24"><path d="M3 17.3V21h3.7L17.8 9.9l-3.7-3.7zm17.7-10.2a1 1 0 0 0 0-1.4l-2.4-2.4a1 1 0 0 0-1.4 0l-1.8 1.8 3.7 3.7z"/></svg></button><button class="icobtn" data-pdel="${esc(p.id)}" aria-label="Удалить"><svg viewBox="0 0 24 24"><path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z"/></svg></button></div>` : ""}</div>`;
  }).join("");
  let orderedBody = `<section class="group">${rows(sorted)}</section>`;
  if (sortMode === "house" && settings.groupHouses) {
    const pinned = settings.selfFirst && !(org && S.edit) ? sorted.find(p => p.code && p.code === S.code) : null;
    const rest = sorted.filter(p => p !== pinned);
    orderedBody = pinned ? `<section class="group">${rows([pinned])}</section>` : "";
    for (const h of [...hList(), null]) {
      const members = rest.filter(p => h ? assignOf(p.code) === h.id : !houseById(assignOf(p.code)));
      if (members.length) orderedBody += `<section class="group"><h2>${esc(h ? h.name : "Без Дома")}</h2>${rows(members)}</section>`;
    }
  }
  const body = list.length
    ? orderedBody
    : `<div class="empty">${S.people.length ? "Никого не нашлось" : "Список участников пока пуст"}</div>`;

  const banks = [...new Set(S.people.map((p) => p.bank).filter(Boolean))].sort();
  const cur = S.editId ? S.people.find((p) => p.id === S.editId) : null;
  const form = S.edit ? `<form class="form" id="pform">
    <div class="photo-pick">${avatar({ name: cur ? cur.name : "?", photo: S.photo })}<div>
      <label class="btn ghost" style="display:inline-block">${S.photo ? "Заменить фото" : "Добавить фото"}<input type="file" accept="image/*" id="pphoto" hidden></label>
      ${S.photo ? ` <button type="button" class="linkbtn" data-act="photo-clear">убрать</button>` : ""}</div></div>
    <label for="pname">ФИО</label><input type="text" id="pname" required autocomplete="off" value="${esc(cur ? cur.name : "")}" placeholder="Фамилия Имя">
    <label for="pnameEn">Имя латиницей (можно исправить)</label><input type="text" id="pnameEn" value="${esc(cur ? cur.name_en || englishTransliterate(cur.name) : '')}">
    <label for="pbankEn">Банк на английском</label><input type="text" id="pbankEn" value="${esc(cur?.bank_en || '')}">
    <label for="planguage">Язык приложения</label><select id="planguage"><option value="ru">Русский</option><option value="en" ${cur?.language==='en'?'selected':''}>English</option></select>
    <label for="pbank">Банк</label><input type="text" id="pbank" list="banks" autocomplete="off" value="${esc(cur ? cur.bank || "" : "")}" placeholder="Название банка"><datalist id="banks">${banks.map((b) => `<option value="${esc(b)}">`).join("")}</datalist>
    ${cur ? `<label>Команда</label><select id="phouse">${houseOptions(assignOf(cur.code))}</select>
    <label>Персональная ссылка</label><div class="linkrow"><code>${esc(linkFor(cur))}</code><button type="button" class="icobtn" data-copy="${esc(linkFor(cur))}" aria-label="Скопировать"><svg viewBox="0 0 24 24"><path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11z"/></svg></button></div>` : ""}
    <div class="row">${cur ? `<button type="button" class="linkbtn" data-invite="rotate" data-person="${esc(cur.id)}">Новая ссылка</button><button type="button" class="linkbtn" data-invite="revoke" data-person="${esc(cur.id)}">Отозвать доступ</button>` : ""}</div>
    <div class="row"><button class="btn" type="submit">${cur ? "Сохранить" : "Добавить"}</button>${cur ? `<button class="btn ghost" type="button" data-act="pcancel">Отмена</button>` : ""}</div></form>` : "";

  if (S.hEdit) { el.innerHTML = housesEditorHTML(); bindHousesEditor(); return; }
  const tools = S.edit ? `<div class="row tools">
      ${S.server ? `<button class="btn ghost" data-act="links">Скачать links.csv</button><button class="btn ghost" data-english="export">Выгрузить участников CSV</button><label class="btn ghost">Импорт CSV<input type="file" accept=".csv,text/csv" id="participantsCSV" hidden></label>` : `<button class="btn ghost" data-act="pack">Скачать пакет для сайта</button>
      <label class="btn ghost">Загрузить из файла<input type="file" accept="application/json,.json" id="pimport" hidden></label>
      ${S.draft ? `<button class="btn ghost" data-act="preset">Отменить правки</button>` : ""}`}
      <button class="btn" data-act="pdone">Готово</button></div>` : "";
  const draft = S.draft && !S.server ? `<div class="draft">Правки пока только на этом телефоне. Чтобы их увидели участники: «Скачать пакет для сайта» → распаковать в папку сайта → закоммитить.</div>` : "";
  const edit = org && !S.edit ? `<div class="row tools"><button class="btn" data-act="pedit-on">Редактировать список</button></div>` : "";

  el.innerHTML = `<div class="sec"><div class="sec-head"><h1>Участники</h1>${isOrg() ? sectionToggle("people") : `<span class="cnt">${S.people.length}</span>`}</div>
    ${draft}${edit}
    ${org && S.edit ? `<div class="form people-sort"><label for="peopleSortMode">Порядок участников</label><select id="peopleSortMode">${[["name", "По ФИО"], ["house", "По Домам, затем по ФИО"], ["manual", "Ручной порядок"]].map(([value, label]) => `<option value="${value}" ${settings.mode === value ? "selected" : ""}>${label}</option>`).join("")}</select><label class="chk"><input type="checkbox" id="peopleSelfFirst" ${settings.selfFirst ? "checked" : ""}> Показывать текущего участника первым</label><label class="chk"><input type="checkbox" id="peopleGroupHouses" ${settings.groupHouses ? "checked" : ""} ${settings.mode !== "house" ? "disabled" : ""}> Показывать команды отдельными блоками</label><p>Блоки доступны при сортировке по Домам.</p>${ordering ? `<p>Меняйте порядок кнопками ↑ ↓. Для перестановки очистите поиск. Новые участники добавляются в конец.</p>` : ""}</div>` : ""}
    ${form}${tools}
    <input class="search" type="search" id="pq" placeholder="Поиск по имени или банку" value="${esc(S.q)}">
    ${body}</div>`;
  const sortControl = $("peopleSortMode"), selfControl = $("peopleSelfFirst");
  if (sortControl) sortControl.onchange = () => updatePeopleSort({ mode: sortControl.value });
  if (selfControl) selfControl.onchange = () => updatePeopleSort({ selfFirst: selfControl.checked });
  el.querySelectorAll("[data-move-person]").forEach(button => {
    button.onclick = () => movePerson(button.dataset.movePerson, Number(button.dataset.direction));
  });
  const groupControl = $("peopleGroupHouses");
  if (groupControl) groupControl.onchange = () => updatePeopleSort({ groupHouses: groupControl.checked });
  const pq = $("pq"); pq.oninput = () => { const pos = pq.selectionStart; S.q = pq.value; renderPeople(); const n = $("pq"); n.focus(); n.setSelectionRange(pos, pos); };
  const ph = $("pphoto"); if (ph) ph.onchange = () => ph.files[0] && shrinkPhoto(ph.files[0]).then((d) => { S.photo = d; renderPeople(); }).catch(() => toast("Не удалось открыть фото"));
  const pi = $("pimport"); if (pi) pi.onchange = () => pi.files[0] && importPeople(pi.files[0]);
  bindParticipantEnglish(cur);
  const f = $("pform"); if (f) f.onsubmit = (e) => {
    e.preventDefault();
    const name = $("pname").value.trim(), bank = $("pbank").value.trim();
    if (!name) { $("pname").focus(); return; }
    if (cur) { Object.assign(cur, { name, bank, photo: S.photo, ...participantEnglishFields() }); if (!cur.code) cur.code = newCode(); const hs = $("phouse"); if (hs) setAssign(cur.code, hs.value); }
    else S.people.push({ id: uid(), name, bank, photo: S.photo, code: newCode(), ...participantEnglishFields() });
    saveDraft(); S.editId = null; S.photo = ""; renderPeople(); toast(cur ? "Сохранено" : `${name} — в списке`);
  };
}

function shrinkPhoto(file, size = 192) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = c.height = size;
      const s = Math.min(img.width, img.height), sx = (img.width - s) / 2, sy = (img.height - s) / 2;
      c.getContext("2d").drawImage(img, sx, sy, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(); };
    img.src = url;
  });
}
const peopleJSON = () => JSON.stringify({ updated: new Date().toISOString().slice(0, 10), people: S.people }, null, 1);
async function importPeople(file) {
  try { const j = JSON.parse(await file.text()); if (!Array.isArray(j.people)) throw 0; S.people = j.people.map((p) => ({ id: p.id || uid(), name: p.name || "", bank: p.bank || "", photo: p.photo || "" })); saveDraft(); renderPeople(); toast(`Загружено: ${S.people.length}`); }
  catch (e) { toast("Это не файл participants.json"); }
}

/* ---------- Контакты ---------- */
function telegramUsername(value) {
  let text = String(value || "").trim();
  if (!text) return "";
  if (text.startsWith("@")) text = text.slice(1);
  else if (/^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\//i.test(text)) {
    try {
      const url = new URL(/^https?:\/\//i.test(text) ? text : "https://" + text);
      if (!['t.me','www.t.me','telegram.me','www.telegram.me'].includes(url.hostname.toLowerCase()) || url.username || url.password || url.port) return "";
      text = decodeURIComponent(url.pathname).replace(/^\//, "").replace(/\/$/, "").replace(/^@/, "");
    } catch { return ""; }
  }
  return /^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(text) ? text : "";
}
function telegramContact(value, icon) {
  const username = telegramUsername(value);
  if (!String(value || "").trim()) return "";
  if (!username) return '<span class="note">Контакт Telegram пока недоступен. Уточните его у организатора.</span>';
  return `<a href="https://t.me/${encodeURIComponent(username)}" target="_blank" rel="noopener noreferrer">${icon}Telegram</a>`;
}
async function copyContactText(value, kind) {
  let copied = false;
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(value); copied = true; } } catch {}
  if (!copied) {
    const field = document.createElement("textarea"), previous = document.activeElement;
    field.value = value; field.readOnly = true; field.style.cssText = "position:fixed;top:0;left:0;opacity:0;font-size:16px";
    document.body.appendChild(field); field.focus(); field.select(); field.setSelectionRange(0, value.length);
    try { copied = document.execCommand("copy"); } catch {}
    field.remove(); previous?.focus?.();
  }
  if (copied) toast(kind === "wechat" ? "ID скопирован. Откройте WeChat → + → Добавить контакты и вставьте ID." : "Скопировано");
  else window.prompt(EnglishUI.t(kind === "wechat" ? "Скопируйте ID вручную. Затем WeChat → + → Добавить контакты:" : "Не удалось скопировать автоматически. Скопируйте текст вручную:"), value);
}

function renderContacts() {
  if (isOrg() && S.siteEdit) { $("view-contacts").innerHTML = siteEditorHTML(); bindSiteEditor(); return; }
  const ic = {
    call: '<svg viewBox="0 0 24 24"><path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25c1.1.37 2.3.57 3.6.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2z"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11z"/></svg>',
  };
  const people = ((S.site && S.site.contacts) || []).map((c) => `<section class="ccard"><div class="who">${avatar({ name: c.name || "?", photo: c.photo })}<div><div class="pname">${esc(c.name)}</div><div class="role">${esc(c.role || "")}</div></div></div>
    <div class="links">${c.phone ? `<a class="call" href="tel:${esc(c.phone.replace(/[^\d+]/g, ""))}">${ic.call}${esc(c.phone)}</a>` : ""}
    ${c.wechat?.trim() ? `<button type="button" data-copy="${esc(c.wechat.trim())}" data-copy-kind="wechat">${ic.copy}WeChat ID: ${esc(c.wechat.trim())}</button>` : ""}
    ${telegramContact(c.telegram, ic.chat)}</div></section>`).join("");
  const places = ((S.site && S.site.places) || []).map((p) => `<section class="ccard"><div class="pname">${esc(p.name)}</div><div class="role">${esc(p.note || "")}</div>
    <div class="zh">${esc(p.zh || "")}</div><div class="links">${p.zh ? `<button data-copy="${esc(p.zh)}">${ic.copy}Скопировать название</button>` : ""}${p.phone ? `<a class="call" href="tel:${esc(p.phone.replace(/[^\d+]/g, ""))}">${ic.call}${esc(p.phone)}</a>` : ""}</div></section>`).join("");
  const orgTools = isOrg() ? `<div class="row tools"><button class="btn ghost" data-act="site-edit">Редактировать контакты</button><button class="btn ghost" data-act="brand-edit">Оформление</button></div>` : "";
  $("view-contacts").innerHTML = `<div class="sec"><div class="sec-head"><h1>Контакты</h1>${isOrg() ? sectionToggle("contacts") : ""}</div>${orgTools}${people}
    ${S.site.contactNote ? `<p class="note contact-note">${esc(S.site.contactNote)}</p>` : ""}
    <div class="sec-head"><h1 class="h2">Отели</h1></div><p class="note">Покажите китайское название таксисту.</p>${places}</div>`;
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-view],[data-copy],[data-pedit],[data-pdel],[data-tedit],[data-act]"); if (!b) return;
  if (b.dataset.view) showView(b.dataset.view);
  else if (b.dataset.tedit) { S.taskEdit = +b.dataset.tedit; S.pendingAudio = null; renderDay(); const f = $("tform"); if (f) f.scrollIntoView({ block: "center" }); }
  else if (b.dataset.copy) { void copyContactText(b.dataset.copy, b.dataset.copyKind); }
  else if (b.dataset.pedit) { const p = S.people.find((x) => x.id === b.dataset.pedit); if (p) { S.editId = p.id; S.photo = p.photo || ""; renderPeople(); $("pname").focus(); } }
  else if (b.dataset.pdel) { const p = S.people.find((x) => x.id === b.dataset.pdel); if (p && confirm(`Удалить: ${p.name}?`)) { S.people = S.people.filter((x) => x !== p); saveDraft(); renderPeople(); } }
  else switch (b.dataset.act) {
    case "pedit-on": S.edit = true; S.editId = null; S.photo = ""; renderPeople(); break;
    case "pdone": S.edit = false; S.editId = null; S.photo = ""; renderPeople(); break;
    case "pcancel": S.editId = null; S.photo = ""; renderPeople(); break;
    case "photo-clear": S.photo = ""; renderPeople(); break;
    case "pack": exportPack(); break;
    case "links": { exportSecureLinks(); break; }
    case "legacy-links": { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + linksCSV()], { type: "text/csv" })); a.download = "links.csv"; document.body.appendChild(a); a.click(); a.remove(); break; }
    case "pack-clear": clearDrafts(); break;
    case "tcancel": cancelTaskEdit(); break;
    case "preset": if (confirm("Убрать все правки на этом телефоне и вернуть список с сайта?")) { localStorage.removeItem(LS.people); S.draft = false; S.people = S.filePeople; S.editId = null; renderPeople(); } break;
  }
});


/* ---------- Аудиозадания: tasks.json + админ-панель ---------- */
const TASKS_URL = "tasks.json";
const tasksJSON = () => JSON.stringify({ updated: new Date().toISOString().slice(0, 10), tasks: S.tasks }, null, 1);
function readTasksDraft() {
  try { const stored = JSON.parse(localStorage.getItem(LS.tasks) || "null"); const j=stored?readLanguageDraft("tasks",stored):null; if (j && j.tasks) { S.tasks = j.tasks; S.tasksDraft = true; } } catch (e) {}
}
function saveTasksDraft() {
  pushDebounced("tasks", () => JSON.parse(tasksJSON()));
  if (online()) return;
  localStorage.setItem(LS.tasks, tasksJSON()); S.tasksDraft = true;
}
async function loadTasks() {
  readTasksDraft();
  try {
    const r = await fetch(TASKS_URL, { cache: "no-store" });
    if (r.ok) { const j = await r.json(); S.fileTasks = j.tasks || {}; S.tasksLoaded = true; if (!S.tasksDraft) S.tasks = S.fileTasks; }
  } catch (e) {}
}
const hasDraft = () => S.draft || S.tasksDraft || S.housesDraft || S.programDraft || S.siteDraft;
const mb = (b) => `${(b / 1048576).toFixed(1).replace(".", ",")} МБ`;
const fileTracks = () => new Set([...Object.values(S.fileTasks).map((t) => t.audio), ...((S.fileHouses && S.fileHouses.houses) || []).map((h) => h.icon), (S.fileHouses && S.fileHouses.ceremony && S.fileHouses.ceremony.scrollImg) || ""].filter(Boolean));

function taskAdminHTML(d, i, t) {
  if (S.taskEdit !== i) {
    const info = t.off ? "блок скрыт" : t.audio ? `${esc(t.file || t.audio.split("/").pop())}${t.dur ? " · " + fmt(t.dur) : ""}${t.size ? " · " + mb(t.size) : ""}${t.open ? " · открыто для теста" : ""}` : "записи нет";
    return `<div class="torg"><button class="linkbtn" data-tedit="${i}">Изменить задание</button><span>${info}</span></div>`;
  }
  const p = S.pendingAudio, cur = p ? p : (t.audio ? { key: t.audio, file: t.file || t.audio.split("/").pop(), dur: t.dur, size: t.size } : null);
  const fileLine = cur ? `<b>${esc(cur.file)}</b>${cur.dur ? " · " + fmt(cur.dur) : ""}${cur.size ? " · " + mb(cur.size) : ""}${cur.size > 15 * 1048576 ? ' <span class="warn">Больше 15 МБ — лучше пережать до 64–96 kbps моно</span>' : ""}` : "Записи нет";
  return `<form class="form tform" id="tform">
    <div class="tfile">${fileLine}</div>
    <div class="row"><label class="btn ghost">${cur ? "Заменить запись" : "Выбрать запись"}<input type="file" id="tfileInput" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,.mp3,.m4a" hidden></label>${cur ? `<button type="button" class="btn ghost" data-act="tremove">Убрать запись</button>` : ""}</div>
    <label for="ttitle">Заголовок</label><input type="text" id="ttitle" value="${esc(t.title)}" autocomplete="off">
    <label for="thint">Подпись после открытия</label><input type="text" id="thint" value="${esc(t.hint || "")}" placeholder="Например: послушайте в автобусе по дороге к стене" autocomplete="off">
    <label class="chk"><input type="checkbox" id="topen"${t.open ? " checked" : ""}> Открыто всегда — для теста, перед поездкой снять</label>
    <label class="chk"><input type="checkbox" id="toff"${t.off ? " checked" : ""}> Не показывать блок в этот день</label>
    <div class="row"><button class="btn" type="submit">Сохранить</button><button class="btn ghost" type="button" data-act="tcancel">Отмена</button></div></form>`;
}

async function pickTaskAudio(file, i) {
  const ext = /\.m4a$|\.aac$|audio\/mp4|audio\/x-m4a|audio\/aac/i.test(file.name + file.type) ? "m4a" : "mp3";
  const key = `assets/audio/d${i + 1}-${Date.now().toString(36)}.${ext}`;
  const blob = new Blob([await file.arrayBuffer()], { type: ext === "m4a" ? "audio/mp4" : "audio/mpeg" });
  const dur = await new Promise((res) => { const a = new Audio(), u = URL.createObjectURL(blob); a.onloadedmetadata = () => { URL.revokeObjectURL(u); res(a.duration); }; a.onerror = () => { URL.revokeObjectURL(u); res(0); }; a.src = u; });
  if (S.pendingAudio) { idbDel(S.pendingAudio.key); S.saved.delete(S.pendingAudio.key); }
  let finalKey = key;
  if (online()) { try { finalKey = await apiUpload("audio", key.split("/").pop(), blob); } catch (e) { toast(e.message); return; } }
  await idbPut(finalKey, { blob, at: Date.now(), draft: !online() });
  S.saved.set(finalKey, URL.createObjectURL(blob));
  S.pendingAudio = { key: finalKey, file: file.name, dur: Math.round(dur), size: blob.size };
  renderDay();
}
function cancelTaskEdit() {
  if (S.pendingAudio) { idbDel(S.pendingAudio.key); S.saved.delete(S.pendingAudio.key); S.pendingAudio = null; }
  S.taskEdit = -1; renderDay();
}
function saveTaskEdit(i) {
  const d = DAYS[i], t = Object.assign({}, T(d));
  t.title = $("ttitle").value.trim() || EnglishUI.t("Задание дня"); t.hint = $("thint").value.trim(); t.open = $("topen").checked; t.off = $("toff").checked;
  if (S.pendingAudio) {
    if (t.audio && t.audio !== S.pendingAudio.key && !fileTracks().has(t.audio)) { idbDel(t.audio); S.saved.delete(t.audio); } // прежний черновик
    Object.assign(t, { audio: S.pendingAudio.key, file: S.pendingAudio.file, dur: S.pendingAudio.dur, size: S.pendingAudio.size });
  } else if (S.taskRemove) {
    if (t.audio && !fileTracks().has(t.audio)) { idbDel(t.audio); S.saved.delete(t.audio); }
    t.audio = ""; delete t.file; delete t.dur; delete t.size;
  }
  if (!t.open) delete t.open;
  if (!t.off) delete t.off;
  S.tasks = Object.assign({}, S.tasks, { [d.date]: t }); saveTasksDraft();
  S.pendingAudio = null; S.taskRemove = false; S.taskEdit = -1;
  if (S.current === i) { A.pause(); A.removeAttribute("src"); S.current = -1; $("player").hidden = true; document.body.classList.remove("has-player"); }
  renderStatus(); renderDay(); toast(online() ? "Сохранено" : "Сохранено на этом телефоне");
}
document.addEventListener("change", (e) => {
  if (e.target.id === "tfileInput" && e.target.files[0]) { S.taskRemove = false; pickTaskAudio(e.target.files[0], S.taskEdit).catch(() => toast("Не удалось открыть файл")); }
});
document.addEventListener("submit", (e) => { if (e.target.id === "tform") { e.preventDefault(); saveTaskEdit(S.taskEdit); } });
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act='tremove']"); if (!b) return;
  if (S.pendingAudio) { idbDel(S.pendingAudio.key); S.saved.delete(S.pendingAudio.key); S.pendingAudio = null; }
  S.taskRemove = true; const el = document.querySelector(".tfile"); if (el) el.textContent = "Записи нет";
  b.remove();
});

/* Пакет для сайта: zip с participants.json, tasks.json и новыми аудио — распаковать в корень сайта */
const CRC = (() => { const t = new Int32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[i] = c; } return (b) => { let c = -1; for (let i = 0; i < b.length; i++) c = t[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }; })();
async function makeZip(files) {
  const enc = new TextEncoder(), parts = [], cd = []; let off = 0;
  const n = new Date(), tm = (n.getHours() << 11) | (n.getMinutes() << 5) | (n.getSeconds() >> 1), dt = ((n.getFullYear() - 1980) << 9) | ((n.getMonth() + 1) << 5) | n.getDate();
  for (const f of files) {
    const name = enc.encode(f.name), data = new Uint8Array(await f.blob.arrayBuffer()), crc = CRC(data);
    const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x800, true); h.setUint16(10, tm, true); h.setUint16(12, dt, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
    parts.push(h.buffer, name, data);
    const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x800, true); c.setUint16(12, tm, true); c.setUint16(14, dt, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    cd.push(c.buffer, name); off += 30 + name.length + data.length;
  }
  const cdLen = cd.reduce((a, b) => a + b.byteLength, 0);
  const e = new DataView(new ArrayBuffer(22)); e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cdLen, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...cd, e.buffer], { type: "application/zip" });
}
async function exportPack() {
  const files = [];
  if (S.draft) files.push({ name: "participants.json", blob: new Blob([peopleJSON()]) });
  if (S.tasksDraft) files.push({ name: "tasks.json", blob: new Blob([tasksJSON()]) });
  if (S.programDraft) files.push({ name: "program.json", blob: new Blob([programJSON()]) });
  if (S.siteDraft) files.push({ name: "site.json", blob: new Blob([siteJSON()]) });
  if (S.housesDraft) files.push({ name: "houses.json", blob: new Blob([housesJSON()]) });
  if (S.tasksDraft || S.housesDraft || S.siteDraft || S.programDraft) {
    const had = fileTracks(), all = await idbGetAll();
    for (const key of tracks()) if (!had.has(key) && all.get(key)) files.push({ name: key, blob: all.get(key).blob });
  }
  if (S.draft || S.housesDraft) files.push({ name: "links.csv", blob: new Blob(["\ufeff" + linksCSV()], { type: "text/csv" }) });
  if (!files.length) { toast("Правок нет — нечего выкладывать"); return; }
  const zip = await makeZip(files);
  const a = document.createElement("a"); a.href = URL.createObjectURL(zip); a.download = `put-drakona-pack-${new Date().toISOString().slice(0, 10)}.zip`; document.body.appendChild(a); a.click(); a.remove();
  toast(`Пакет: ${files.map((f) => f.name.split("/").pop()).join(", ")}. Распакуйте в папку сайта.`);
}
function clearDrafts() {
  if (!confirm("Пакет уже выложен на сайт? Черновики на телефоне будут заменены версией с сайта после обновления.")) return;
  localStorage.removeItem(LS.people); localStorage.removeItem(LS.tasks); localStorage.removeItem(LS.houses);
  localStorage.removeItem(LS.program); localStorage.removeItem(LS.site);
  S.draft = false; S.tasksDraft = false; S.housesDraft = false; S.programDraft = false; S.siteDraft = false; S.people = S.filePeople; S.tasks = S.fileTasks; S.houses = S.fileHouses;
  loadPeople(); loadTasks().then(() => { renderStatus(); renderDay(); }); loadHouses().then(renderHouse);
  renderStatus(); renderDay(); toast("Черновики убраны");
}




/* ---------- Программа и оформление: program.json + site.json ---------- */
const programJSON = () => JSON.stringify({ updated: new Date().toISOString().slice(0, 10), days: DAYS, important: IMPORTANT }, null, 1);
const siteJSON = () => JSON.stringify(Object.assign({ updated: new Date().toISOString().slice(0, 10) }, S.site), null, 1);
const brand = () => (S.site && S.site.brand) || DEFAULT_BRAND;

function applyProgram(j) { if (j && Array.isArray(j.days) && j.days.length) DAYS = j.days; if (j && j.important) IMPORTANT = j.important; }
function applySite(j) {
  S.site = Object.assign({ brand: DEFAULT_BRAND, contacts: DEFAULT_CONTACTS, places: DEFAULT_PLACES }, j || {});
  S.site.brand = Object.assign({}, DEFAULT_BRAND, S.site.brand || {});
  S.site.login = Object.assign({}, DEFAULT_LOGIN, S.site.login || {});
  if (typeof S.site.contactNote !== "string") S.site.contactNote = DEFAULT_CONTACT_NOTE;
  S.site.brand.sections = Object.assign({ people: true, contacts: true }, S.site.brand.sections || {});
}
function readProgramDraft() {
  try { const stored = JSON.parse(localStorage.getItem(LS.program) || "null"); const j=stored?readLanguageDraft("program",stored):null; if (j && j.days) { applyProgram(j); S.programDraft = true; } } catch (e) {}
  try { const stored = JSON.parse(localStorage.getItem(LS.site) || "null"); const j=stored?readLanguageDraft("site",stored):null; if (j) { applySite(j); S.siteDraft = true; } } catch (e) {}
}
function saveProgram() {
  DAYS = [...DAYS].sort((a, b) => a.date.localeCompare(b.date));
  pushDebounced("program", () => JSON.parse(programJSON()));
  if (online()) return;
  localStorage.setItem(LS.program, programJSON()); S.programDraft = true;
}
function saveSite() {
  pushDebounced("site", () => JSON.parse(siteJSON()));
  if (online()) return;
  localStorage.setItem(LS.site, siteJSON()); S.siteDraft = true;
}
async function loadStatic(url, apply) {
  try { const r = await fetch(url, { cache: "no-store" }); if (r.ok) apply(await r.json()); } catch (e) {}
}
const sectionOn = (k) => isOrg() || brand().sections[k] !== false;
const sectionToggle = (k) => {
  const on = brand().sections[k] !== false;
  return `<button class="secoff${on ? "" : " off"}" data-secoff="${k}">${on ? "Отключить раздел" : "Раздел выключен"}</button>`;
};
function applyBrand() {
  const img = document.querySelector("#cover img"); if (img) img.src = S.saved.get(brand().cover) || brand().cover;
  document.querySelectorAll("[data-site-footer]").forEach(f => f.textContent = brand().footer ?? "");
  applyLoginAppearance({intro:S.site.login?.intro ?? DEFAULT_LOGIN.intro,inputLabel:S.site.login?.inputLabel ?? DEFAULT_LOGIN.inputLabel,title:S.site.login?.title ?? DEFAULT_LOGIN.title,footer:brand().footer ?? "",banner:S.site.login?.banner ? (S.saved.get(S.site.login.banner) || S.site.login.banner) : ""});
  // Организатор видит разделы всегда — иначе, выключив «Контакты», он потерял бы доступ к админке
  for (const k of ["people", "contacts"]) {
    const b = document.querySelector(`.nav [data-view="${k}"]`);
    if (b) b.hidden = !sectionOn(k);
  }
  if (!sectionOn(S.view)) showView("program");
}

/* =====================================================================
   СЕРВЕР
   Если по адресу есть /api/content — работаем с сервером: правки
   сохраняются сразу и видны всем. Если нет (например, GitHub Pages) —
   работает прежняя схема с черновиками и «пакетом для сайта».
   ===================================================================== */
let accessGeneration = 0;
async function apiContent() {
  const generation = accessGeneration;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),5000);
  try {
    const r = await fetch("/api/content", { cache: "no-store",signal:controller.signal });
    if (generation !== accessGeneration) return null;
    if (r.status === 401 || r.status === 403) { await clearPrivate(); showAccess("Доступ завершён. Откройте приглашение заново."); return null; }
    if (!r.ok) return null;
    const j = await r.json();
    if (generation !== accessGeneration) return null;
    if (!j?.server) return null;
    if (j.role === "participant") {
      try { localStorage.setItem(LS.content, JSON.stringify(j)); } catch { toast("Недостаточно места для офлайн-копии. Освободите память устройства."); }
    }
    return j;
  } catch { return null; } finally {clearTimeout(timeout);}
}
async function syncDraws() {
  if (S.role !== "participant" || !navigator.onLine || S.drawSyncing || !Object.keys(S.drawPending).length) return;
  S.drawSyncing = true;
  try {
    for (const [code, houseId] of Object.entries(S.drawPending)) {
      const r = await fetch("api/draw", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, houseId }) });
      if (!r.ok) continue;
      S.draws[code] = houseId;
    }
    const c = await apiContent();
    if (c) {
      S.draws = c.draws || {};
      for (const [code, id] of Object.entries(S.drawPending)) if (S.draws[code] === id) delete S.drawPending[code];
      if(S.rawContent)S.rawContent.draws=structuredClone(S.draws);
      localStorage.setItem(LS.draws, JSON.stringify(S.drawPending));
      renderHouse(); if (S.view === "people") renderPeople();
    }
  } catch (e) {} finally { S.drawSyncing = false; }
}

async function apiPut(kind, body) {
  const r = await fetch("api/" + kind, {
    method: "PUT", cache: "no-store",
    headers: { "content-type": "application/json", "x-requested-with": "drakon-secure" },
    body: JSON.stringify(body),
  });
  if (r.status === 401 || r.status === 403) { await clearPrivate(); showAccess("Войдите как организатор"); throw new Error("Нужен вход организатора"); }
  if (!r.ok) throw new Error("Сервер не принял правку");
  const response = await r.json(); if (response.invites) S.invites = response.invites;
  return true;
}
async function apiUpload(dir, name, blob) {
  const b64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1]); fr.onerror = rej; fr.readAsDataURL(blob); });
  const r = await fetch("api/upload", {
    method: "POST", headers: { "content-type": "application/json", "x-requested-with": "drakon-secure" },
    body: JSON.stringify({ dir, name, data: b64 }),
  });
  if (!r.ok) throw new Error("Файл не загрузился");
  return (await r.json()).path;
}
const online = () => S.role === "admin";
const DRAFT_KEY = { participants: LS.people, tasks: LS.tasks, houses: LS.houses, program: LS.program, site: LS.site };

// Правка всегда сначала ложится в локальный черновик и только потом уходит на сервер.
// Если сервер не ответил, черновик остаётся и отправляется повторно при возврате сети.
function stash(kind, body) {
  body=storeLanguageEdits(kind,body);
  localStorage.setItem(DRAFT_KEY[kind], JSON.stringify(body));
  S.pending.add(kind);
  localStorage.setItem(LS.pending, [...S.pending].join(","));
}
function unstash(kind, snapshot) {
  if (localStorage.getItem(DRAFT_KEY[kind]) !== snapshot) return;
  S.pending.delete(kind);
  localStorage.setItem(LS.pending, [...S.pending].join(","));
  localStorage.removeItem(DRAFT_KEY[kind]);
}
const sending = new Map();
function push(kind) {
  if (!online()) return Promise.resolve(false);
  if (sending.has(kind)) return sending.get(kind);
  const job = (async () => {
    while (online() && S.pending.has(kind)) {
      const snapshot = localStorage.getItem(DRAFT_KEY[kind]);
      if (!snapshot) return false;
      try {
        await apiPut(kind, JSON.parse(snapshot));
        unstash(kind, snapshot);
      } catch (e) {
        toast(localStorage.getItem(DRAFT_KEY[kind]) ? e.message + " — правка сохранена на телефоне; повторю после восстановления связи или входа" : "Доступ завершён. Несохранённая правка удалена с устройства. Войдите заново и повторите изменение.");
        return false;
      }
    }
    return true;
  })();
  sending.set(kind, job);
  return job.finally(() => { sending.delete(kind); });
}
// Поля в админке сохраняются на каждый введённый символ — копим и отправляем пачкой
const timers = {};
function pushDebounced(kind, getBody, ms = 700) {
  stash(kind, getBody());
  clearTimeout(timers[kind]);
  timers[kind] = setTimeout(() => push(kind), ms);
}
// Досылаем всё, что не ушло
async function flushPending() {
  if (!online() || !S.pending.size) return;
  for (const kind of [...S.pending]) {
    if (!await push(kind)) return;
  }
  toast("Отложенные правки отправлены на сервер");
}

/* =====================================================================
   ДОМА ДРАКОНА: жребий при первом запуске + админка
   Данные — в houses.json. Дом участника определяется его персональным
   кодом из ссылки вида /?p=k7m3q9 (код лежит в participants.json).
   ===================================================================== */
const HOUSES_URL = "houses.json";
const housesJSON = () => JSON.stringify(S.houses, null, 1);
const HOUSE_FALLBACK = { enabled: false, ceremony: {}, houses: [], assign: {} };

function readHousesDraft() {
  try { const stored = JSON.parse(localStorage.getItem(LS.houses) || "null"); const j=stored?readLanguageDraft("houses",stored):null; if (j && j.houses) { S.houses = j; S.housesDraft = true; } } catch (e) {}
}
function saveHousesDraft() {
  pushDebounced("houses", () => JSON.parse(housesJSON()));
  if (online()) return;
  localStorage.setItem(LS.houses, housesJSON()); S.housesDraft = true;
}
async function loadHouses() {
  try {
    const r = await fetch(HOUSES_URL, { cache: "no-store" });
    if (r.ok) { const j = await r.json(); S.fileHouses = j; if (!S.housesDraft) S.houses = j; }
  } catch (e) {}
  if (!S.houses) S.houses = S.fileHouses || HOUSE_FALLBACK;
}

const hList = () => (S.houses && S.houses.houses) || [];
const houseById = (id) => hList().find((h) => h.id === id) || null;
const assignOf = (code) => (S.houses && S.houses.assign && S.houses.assign[code]) || "";
function setAssign(code, id) {
  if (!code) return;
  S.houses.assign = Object.assign({}, S.houses.assign);
  if (id) S.houses.assign[code] = id; else delete S.houses.assign[code];
  saveHousesDraft();
}
const houseMode = () => S.houses?.mode || (S.houses?.enabled === false ? "off" : "draw");
const housesOn = () => houseMode() !== "off" && hList().length > 0;
const myHouse = () => houseById(assignOf(S.code));
const meRecord = () => S.people.find((p) => p.code && p.code === S.code) || null;
const hasDrawn = (code) => !!assignOf(code) && (S.draws[code] === assignOf(code) || S.drawPending[code] === assignOf(code));
const drawn = () => hasDrawn(S.code);
const newCode = () => Math.random().toString(36).slice(2, 8);
// На сервере — /p/КОД/: только так код переживает добавление на экран «Домой» на iPhone
const linkFor = (p) => S.invites[p.code] ? `${location.origin}/#invite=${S.invites[p.code]}` : "Ссылка ещё не сохранена или отозвана";
const linksCSV = () => ["Имя;Банк;Дом;Ссылка", ...S.people.map((p) => {
  const h = houseById(assignOf(p.code));
  return [p.name, p.bank || "", h ? h.name : "", linkFor(p)].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";");
})].join("\n");
const houseOptions = (sel) => `<option value="">— не назначена —</option>` + hList().map((h) => `<option value="${esc(h.id)}"${h.id === sel ? " selected" : ""}>${esc(h.name)}</option>`).join("");

// Код из ссылки запоминаем на телефоне и убираем из адресной строки
function takeCode() {}

/* ---------- Блок «Ваш дом» в программе ---------- */
const iconSrc = (h) => (h && (S.saved.get(h.icon) || h.icon)) || "";
function renderHouse() {
  const el = $("myhouse"); if (!el) return;
  if (canDraw() && !drawn()) {
    const c = S.houses.ceremony || {};
    el.hidden = false;
    el.innerHTML = `<div class="hinvite"><div class="hglow"></div>
      <div class="htitle">${esc(c.cardTitle || EnglishUI.t("Путешествие начинается прямо сейчас"))}</div>
      <p>${esc(c.cardText || EnglishUI.t("Выберите свой Дом Дракона."))}</p>
      <button class="btn" data-act="cer-open">${esc(c.cardButton || EnglishUI.t("Тянуть жребий"))}</button></div>${houseAdminLink()}`;
    document.documentElement.style.removeProperty("--house");
    return;
  }
  const h = housesOn() && (houseMode() === "immediate" || drawn()) ? myHouse() : null;
  if (!h) { el.hidden = !isOrg(); el.innerHTML = houseAdminLink(); document.documentElement.style.removeProperty("--house"); return; }
  document.documentElement.style.setProperty("--house", h.color);
  el.hidden = false;
  el.innerHTML = `<div class="hcard" style="--hc:${esc(h.color)}">
    <img src="${esc(iconSrc(h))}" alt="">
    <div><div class="hlabel">Ваш дом</div><div class="hname">${esc(h.name)}</div><div class="hmotto">${esc(h.motto || "")}</div></div></div>${houseAdminLink()}`;
}

// Вход в редактор команд — прямо под блоком, а не в глубине раздела участников
const houseAdminLink = () => (isOrg() ? `<div class="torg"><button class="linkbtn" data-act="hedit-on">Команды и жребий</button><span>${housesOn() ? `${hList().length} команд` : "раздел выключен"}</span></div>` : "");

/* ---------- Церемония: приглашение → подводка → свитки → раскрытие ---------- */
const canDraw = () => houseMode() === "draw" && housesOn() && S.code && myHouse();
function maybeCeremony() { renderHouse(); }

function openCeremony() {
  if (!canDraw()) return;
  $("ceremony").hidden = false;
  document.body.classList.add("locked");
  $("ceremony").innerHTML = `<div class="cer" id="cerInner"></div>`;
  cerIntro();
}
function cerIntro() {
  const c = S.houses.ceremony || {};
  $("cerInner").innerHTML = `<div class="cer-stage" id="cerStage">
    <h1>${esc(c.title || EnglishUI.t("Жребий Дракона"))}</h1>
    <p>${esc(c.intro || "")}</p>
    <button class="btn cer-go" data-act="cer-pick">${esc(c.introButton || EnglishUI.t("Я готов"))}</button>
    <button class="linkbtn cer-later" data-act="cer-close">Позже</button></div>`;
}
function cerPick() {
  const c = S.houses.ceremony || {};
  const img = c.scrollImg ? `<img src="${esc(S.saved.get(c.scrollImg) || c.scrollImg)}" alt="">` : `<span class="tie"></span>`;
  const st = $("cerStage"); st.classList.add("away");
  setTimeout(() => {
    $("cerInner").innerHTML = `<div class="cer-stage" id="cerStage">
      <h1 class="pick">${esc(c.pick || EnglishUI.t("Выберите свиток"))}</h1>
      <div class="scrolls${c.scrollImg ? " img" : ""}">${[0, 1, 2, 3, 4].map((i) => `<button class="scroll" data-scroll="${i}" aria-label="Свиток ${i + 1}">${img}</button>`).join("")}</div></div>`;
  }, 480);
}
function revealHouse() {
  if (!canDraw()) { closeCeremony(); return; }
  const code = S.code;
  const h = myHouse(), c = S.houses.ceremony || {};
  const st = $("cerStage");
  st.classList.add("away");
  setTimeout(() => {
    if (!canDraw() || S.code !== code || myHouse()?.id !== h.id || $("ceremony").hidden) return;
    document.documentElement.style.setProperty("--house", h.color);
    $("cerInner").innerHTML = `<div class="cer-stage reveal" style="--hc:${esc(h.color)}">
      <div class="glow"></div>
      <img class="dragon" src="${esc(iconSrc(h))}" alt="">
      <div class="rlabel">${esc(c.result || EnglishUI.t("Ваш дом"))}</div>
      <h1 class="rname">${esc(h.name)}</h1>
      <p class="rmotto">${esc(h.motto || "")}</p>
      <button class="btn" data-act="cer-close">${esc(c.button || EnglishUI.t("В путь"))}</button></div>`;
    S.drawPending[code] = h.id;
    localStorage.setItem(LS.draws, JSON.stringify(S.drawPending));
    syncDraws();
  }, 620);
}
function closeCeremony() {
  $("ceremony").hidden = true; $("ceremony").innerHTML = "";
  document.body.classList.remove("locked");
  renderHouse(); renderPeople();
}

/* ---------- Админка домов ---------- */
function housesEditorHTML() {
  const c = S.houses.ceremony || {};
  const cards = hList().map((h, i) => `<section class="hrow" style="--hc:${esc(h.color)}">
    <img src="${esc(iconSrc(h))}" alt="">
    <div class="hmain">
      <input type="text" class="hi" data-h="${i}" data-f="name" value="${esc(h.name)}" placeholder="Название дома">
      <input type="text" class="hi" data-h="${i}" data-f="motto" value="${esc(h.motto || "")}" placeholder="Девиз">
      <div class="hrow-b"><label class="mini">Цвет <input type="color" class="hi" data-h="${i}" data-f="color" value="${esc(h.color || "#FF0A3C")}"></label>
      <label class="mini btn ghost">Иконка<input type="file" accept="image/*" data-hicon="${i}" hidden></label>
      <button class="linkbtn" data-hdel="${i}">удалить</button></div>
    </div></section>`).join("");
  const counts = hList().map((h) => `${h.name.replace(/^Дом /, "")}: ${S.people.filter((p) => assignOf(p.code) === h.id).length}`).join(" · ");
  const nope = S.people.filter((p) => !assignOf(p.code)).length;
  return `<div class="sec"><div class="sec-head"><h1>Команды</h1><button class="secoff" data-act="hedit-off">Готово</button></div>
    <fieldset class="form"><legend>Как показывать Дома</legend>
      ${[["draw", "Через жребий"], ["immediate", "Сразу, без жребия"], ["off", "Отключить команды"]].map(([value, label]) => `<label class="chk"><input type="radio" name="house-mode" value="${value}"${houseMode() === value ? " checked" : ""}> ${label}</label>`).join("")}
    </fieldset>
    <div class="form">
      <p class="mini">Блок-приглашение в программе</p>
      <label for="ccard">Заголовок</label><input type="text" id="ccard" value="${esc(c.cardTitle || "")}">
      <label for="ccardt">Текст</label><input type="text" id="ccardt" value="${esc(c.cardText || "")}">
      <label for="ccardb">Кнопка</label><input type="text" id="ccardb" value="${esc(c.cardButton || "")}">
      <p class="mini">Экран подводки</p>
      <label for="ctitle">Заголовок</label><input type="text" id="ctitle" value="${esc(c.title || "")}">
      <label for="cintro">Текст</label><input type="text" id="cintro" value="${esc(c.intro || "")}">
      <label for="cintrob">Кнопка</label><input type="text" id="cintrob" value="${esc(c.introButton || "")}">
      <p class="mini">Свитки и раскрытие</p>
      <label for="cpick">Заголовок над свитками</label><input type="text" id="cpick" value="${esc(c.pick || "")}">
      <label for="cres">Подпись над результатом</label><input type="text" id="cres" value="${esc(c.result || "")}">
      <label for="cbtn">Кнопка после раскрытия</label><input type="text" id="cbtn" value="${esc(c.button || "")}">
      <div class="hrow-b" style="margin-top:14px"><label class="mini btn ghost">Картинка свитка<input type="file" accept="image/*" id="cscroll" hidden></label>${c.scrollImg ? `<button type="button" class="linkbtn" data-act="cscroll-clear">убрать</button>` : `<span class="mini">рисуется кодом</span>`}</div>
    </div>
    ${cards}
    <div class="row tools"><button class="btn ghost" data-act="hadd">Добавить команду</button><button class="btn ghost" data-act="hspread">Распределить поровну</button><button class="btn" data-act="hedit-off">Готово</button></div>
    <p class="note">Назначено — ${esc(counts)}${nope ? ` · без команды: ${nope}` : ""}. Команда каждого меняется в его карточке в списке участников. Ссылки для рассылки выгружаются вместе с пакетом для сайта, файлом links.csv.</p></div>`;
}
function bindHousesEditor() {
  document.querySelectorAll('[name="house-mode"]').forEach((input) => {
    input.onchange = () => {
      S.houses.mode = input.value; S.houses.enabled = input.value !== "off";
      saveHousesDraft(); renderHouse(); renderStatus();
    };
  });
  const t = { ccard: "cardTitle", ccardt: "cardText", ccardb: "cardButton", ctitle: "title", cintro: "intro", cintrob: "introButton", cpick: "pick", cres: "result", cbtn: "button" };
  for (const id in t) $(id).oninput = (e) => { S.houses.ceremony = Object.assign({}, S.houses.ceremony, { [t[id]]: e.target.value }); saveHousesDraft(); };
  const cs = $("cscroll"); if (cs) cs.onchange = async () => {
    const f = cs.files[0]; if (!f) return;
    let key = `assets/houses/scroll-${Date.now().toString(36)}.png`;
    const blob = await shrinkIcon(f, 600);
    if (online()) { try { key = await apiUpload("houses", key.split("/").pop(), blob); } catch (e) { toast(e.message); return; } }
    await idbPut(key, { blob, at: Date.now(), draft: !online() });
    S.saved.set(key, URL.createObjectURL(blob));
    S.houses.ceremony = Object.assign({}, S.houses.ceremony, { scrollImg: key });
    saveHousesDraft(); renderPeople(); renderStatus();
  };
  document.querySelectorAll(".hi").forEach((inp) => {
    inp.oninput = () => { const h = hList()[+inp.dataset.h]; if (!h) return; h[inp.dataset.f] = inp.value; saveHousesDraft(); if (inp.dataset.f === "color") inp.closest(".hrow").style.setProperty("--hc", inp.value); };
  });
  document.querySelectorAll("[data-hicon]").forEach((inp) => {
    inp.onchange = async () => {
      const f = inp.files[0], h = hList()[+inp.dataset.hicon]; if (!f || !h) return;
      let key = `assets/houses/${h.id}-${Date.now().toString(36)}.png`;
      const blob = await shrinkIcon(f);
      if (online()) { try { key = await apiUpload("houses", key.split("/").pop(), blob); } catch (e) { toast(e.message); return; } }
      await idbPut(key, { blob, at: Date.now(), draft: !online() });
      S.saved.set(key, URL.createObjectURL(blob));
      h.icon = key; saveHousesDraft(); renderPeople(); renderStatus();
    };
  });
}
function shrinkIcon(file, size = 512) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = c.height = size;
      const s = Math.max(img.width, img.height), x = (size - (img.width / s) * size) / 2, y = (size - (img.height / s) * size) / 2;
      c.getContext("2d").drawImage(img, x, y, (img.width / s) * size, (img.height / s) * size);
      URL.revokeObjectURL(url); c.toBlob((b) => (b ? res(b) : rej()), "image/png");
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(); };
    img.src = url;
  });
}
function spreadHouses() {
  const ids = hList().map((h) => h.id); if (!ids.length) return;
  S.houses.assign = {};
  S.people.forEach((p, i) => { if (p.code) S.houses.assign[p.code] = ids[i % ids.length]; });
  saveHousesDraft(); renderPeople(); toast("Участники распределены поровну");
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-scroll],[data-hdel],[data-act]"); if (!b) return;
  if (b.dataset.scroll !== undefined) { if (!b.closest(".scrolls").classList.contains("done")) { b.closest(".scrolls").classList.add("done"); b.classList.add("picked"); setTimeout(revealHouse, 1000); } return; }
  if (b.dataset.hdel !== undefined) { const h = hList()[+b.dataset.hdel]; if (h && confirm(`Удалить ${h.name}?`)) { S.houses.houses = hList().filter((x) => x !== h); saveHousesDraft(); renderPeople(); } return; }
  switch (b.dataset.act) {
    case "hedit-on": S.hEdit = true; S.edit = true; showView("people"); break;
    case "hedit-off": S.hEdit = false; renderPeople(); renderHouse(); break;
    case "hadd": S.houses.houses = [...hList(), { id: "h" + newCode(), name: "Новая команда", motto: "", color: "#FF0A3C", icon: "" }]; saveHousesDraft(); renderPeople(); break;
    case "hspread": spreadHouses(); break;
    case "cscroll-clear": S.houses.ceremony = Object.assign({}, S.houses.ceremony, { scrollImg: "" }); saveHousesDraft(); renderPeople(); break;
    case "cer-open": openCeremony(); break;
    case "cer-pick": cerPick(); break;
    case "cer-close": closeCeremony(); break;
    case "cer-test": openCeremony(); break;
  }
});


/* =====================================================================
   АДМИНКА: программа дня, контакты, оформление
   ===================================================================== */
const txtToRaw = (arr) => (arr || []).map((t) => t).join("\n\n");
const rawToTxt = (raw) => String(raw).split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean);

function beginDayEdit(i, value = DAYS[i]) {
  discardDayEdit();
  S.dayEdit=i; S.dayOriginal=DAYS[i] || null; S.dayDraft=structuredClone(value); S.dayImportantDraft=structuredClone(IMPORTANT);
}
function discardDayEdit() {
  if(S.dayPreview)URL.revokeObjectURL(S.dayPreview);
  S.dayPreview=null; S.dayImage=null; S.dayImportantDraft=null; S.dayDraft=null; S.dayOriginal=null; S.dayEdit=-1;
}
function importantEditorHTML(){
  const v=S.dayImportantDraft;if(!v)return '';
  return `<fieldset class="important-editor"><legend>${EnglishUI.t('Важное')}</legend><label for="importantIntro">${EnglishUI.t('Вступление')}</label><textarea id="importantIntro">${esc(v.intro||'')}</textarea>${(v.items||[]).map((row,i)=>`<label for="importantTitle${i}">${EnglishUI.t('Пункт')} ${i+1}</label><input id="importantTitle${i}" value="${esc(row[0])}"><textarea id="importantText${i}">${esc(row[1])}</textarea>`).join('')}</fieldset>`;
}
function dayAdminHTML(d, i) {
  if (S.dayEdit !== i) {
    return `<div class="torg"><button class="linkbtn" data-dedit="${i}">Изменить день</button><span>${(d.schedule || []).length} строк расписания</span></div>`;
  }
  const rows = (d.schedule || []).map((r, k) => `<div class="srow">
    <input type="text" class="di" data-f="time" data-k="${k}" value="${esc(r[0])}" placeholder="09:00">
    <input type="text" class="di" data-f="what" data-k="${k}" value="${esc(r[1])}" placeholder="Что происходит">
    <label class="mini acc"><input type="checkbox" class="di" data-f="acc" data-k="${k}"${r[2] ? " checked" : ""}> красным</label>
    <button type="button" class="icobtn" data-srow-del="${k}" aria-label="Удалить строку"><svg viewBox="0 0 24 24"><path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z"/></svg></button>
  </div>`).join("");
  return `<form class="form dform" id="dform">
    <label for="dtitle">Заголовок на плашке</label><input type="text" id="dtitle" value="${esc(d.title || "")}">
    <label for="ddate">Дата</label><input type="date" id="ddate" value="${esc(d.date)}">
    <div class="hrow-b"><label class="mini btn ghost">Фото дня<input type="file" accept="image/*" id="dimg" hidden></label>
      <label class="mini">Сдвиг по вертикали <input type="range" id="dpos" min="0" max="100" value="${(/(\d+)%\s*$/.exec(d.imgPos || "50% 50%") || [0, 50])[1]}"></label></div>
    <label for="dtext">Текст дня (абзацы через пустую строку; ** — жирный, !! — красный)</label>
    <textarea id="dtext" rows="8">${esc(txtToRaw(d.text))}</textarea>
    <label>Расписание</label>
    <div class="sched-edit">${rows || `<p class="mini">Пока пусто</p>`}</div>
    <div class="row"><button type="button" class="btn ghost" data-act="srow-add">Добавить время</button></div>
    <label class="chk"><input type="checkbox" id="dimp"${d.important ? " checked" : ""}> Показывать блок «Важное»</label>
    ${d.important ? importantEditorHTML() : ""}
    <div class="row"><button class="btn" type="submit">Сохранить</button><button type="button" class="btn ghost" data-act="dcancel">Отмена</button>
      <button type="button" class="linkbtn" data-act="dday-del">удалить день</button></div></form>`;
}

// Перед любой перерисовкой формы забираем то, что человек уже набрал
function syncDayForm() {
  const d=S.dayDraft; if(!d||!$("dform"))return false;
  const newDate=$("ddate").value||d.date;
  if(DAYS.some(x=>x!==S.dayOriginal&&x.date===newDate)||(newDate!==S.dayOriginal?.date&&Object.prototype.hasOwnProperty.call(S.tasks||{},newDate))){
    toast("На эту дату уже есть день или задание. Выберите свободную дату.");return false;
  }
  d.title=$("dtitle").value.trim();d.date=newDate;
  d.text=rawToTxt($("dtext").value);d.important=$("dimp").checked||undefined;
  if($('importantIntro')&&S.dayImportantDraft){S.dayImportantDraft.intro=$('importantIntro').value;S.dayImportantDraft.items=S.dayImportantDraft.items.map((row,i)=>[$('importantTitle'+i).value,$('importantText'+i).value,...row.slice(2)]);}
  return true;
}
function bindDayEditor(i) {
  const f=$("dform"),d=S.dayDraft;if(!f||!d)return;
  document.querySelectorAll(".di").forEach(inp=>{inp.oninput=inp.onchange=()=>{
    const row=d.schedule[+inp.dataset.k];if(!row)return;
    if(inp.dataset.f==='time')row[0]=inp.value.replace(/\|/g,"\n");
    else if(inp.dataset.f==='what')row[1]=inp.value;else row[2]=inp.checked||undefined;
  };});
  const pos=$("dpos");if(pos)pos.oninput=()=>{d.imgPos=`50% ${pos.value}%`;const im=document.querySelector('.hero img');if(im)im.style.objectPosition=d.imgPos;};
  const im=$("dimg");if(im)im.onchange=async()=>{
    const file=im.files[0];if(!file)return;
    try {
      const blob=await shrinkWide(file);if(S.dayDraft!==d)return;
      if(S.dayPreview)URL.revokeObjectURL(S.dayPreview);
      S.dayImage=blob;S.dayPreview=URL.createObjectURL(blob);d.img=S.dayPreview;
      if(syncDayForm())renderDay();
    }catch{toast("Не удалось открыть фото");}
  };
  f.onsubmit=async e=>{
    e.preventDefault();if(S.daySaving||!syncDayForm())return;
    S.daySaving=true;
    try {
      const saved=structuredClone(d),original=S.dayOriginal;
      if(S.dayImage)saved.img=await apiUpload('img','day.jpg',S.dayImage);
      if(S.dayDraft!==d||!isOrg())return;
      if(original&&saved.date!==original.date&&S.tasks[original.date]){
        S.tasks={...S.tasks,[saved.date]:S.tasks[original.date]};delete S.tasks[original.date];saveTasksDraft();
      }
      if(original)DAYS=DAYS.map(x=>x===original?saved:x);else DAYS=[...DAYS,saved];
      if(S.dayImportantDraft)IMPORTANT=S.dayImportantDraft;discardDayEdit();saveProgram();S.sel=DAYS.indexOf(saved);
      renderTabs();renderDay();renderStatus();toast("День сохранён");
    }catch(e){toast(e.message||"Не удалось сохранить день");}finally{S.daySaving=false;}
  };
}

function shrinkWide(file, w = 1200) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = Math.min(w, img.width); c.height = Math.round((c.width / img.width) * img.height);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); c.toBlob((b) => (b ? res(b) : rej()), "image/jpeg", 0.8);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(); };
    img.src = url;
  });
}

/* ---------- Контакты и оформление ---------- */
function siteEditorHTML() {
  if (S.siteEdit === "brand") {
    const b = brand();
    return `<div class="sec"><div class="sec-head"><h1>Оформление</h1></div>
      <div class="form">
        <img class="prev" src="${esc(imgSrc(b.cover))}" alt="">
        <div class="row" style="margin-top:12px"><label class="btn ghost">Заменить баннер<input type="file" accept="image/jpeg,image/png,image/webp" id="bcover" hidden></label>${englishAdmin()?'<button type="button" class="linkbtn" id="resetEnglishCover">Использовать русский баннер</button>':''}</div>
        <label class="chk"><input type="checkbox" id="englishEnabled" ${S.site.englishEnabled!==false?'checked':''}> Поддержка английского языка</label>
        <p class="mini">При отключении участники видят только русский. Переводы и выбранные языки сохраняются.</p>
        <h2>Иконка приложения</h2>
        <img id="appIconPreview" src="/assets/icon-512.png" alt="Иконка приложения" width="80" height="80">
        <label class="btn ghost">Заменить иконку приложения<input type="file" id="appIconFile" accept="image/png" hidden></label>
        <p class="note">PNG, 1024×1024 px, до 5 МБ. Иконка общая для RU и EN и видна до входа. У уже установленного приложения она может обновиться не сразу.</p>
        <h2>Страница входа</h2>
        <label for="loginTitle">Название на странице входа</label><input type="text" id="loginTitle" maxlength="160" value="${esc(S.site.login.title)}">
        <label for="loginIntro">Текст над формой входа</label><textarea id="loginIntro" rows="4" maxlength="2000">${esc(S.site.login.intro)}</textarea>
        <label for="loginInputLabel">Подпись поля над кнопкой входа</label><input type="text" id="loginInputLabel" maxlength="160" value="${esc(S.site.login.inputLabel)}">
        ${S.site.login.banner ? `<img class="prev" src="${esc(imgSrc(S.site.login.banner))}" alt="Баннер входа">` : ""}
        <div class="row"><label class="btn ghost">Заменить баннер входа<input type="file" accept="image/jpeg,image/png,image/webp" id="loginBannerFile" hidden></label><button type="button" class="linkbtn" id="removeLoginBanner">Убрать баннер входа</button></div>
        <p class="note">Баннер входа: 1400×500 px. Название, этот баннер и подпись внизу видны всем до входа.</p>
        <label for="bfoot">Подпись внизу всех страниц, включая вход</label><input type="text" maxlength="240" id="bfoot" value="${esc(b.footer || "")}">
      </div>
      <p class="note">Раздел «Команды» включается отдельно, кнопкой «Команды и жребий» под блоком жребия в «Программе». В режиме организатора все разделы видны всегда, даже выключенные.</p>
      <div class="row tools"><button class="btn" data-act="site-off">Готово</button></div>
      <p class="note">Главный баннер: 1400×500 px, JPG, PNG или WebP. В этом размере изображение показывается целиком. Изображения других пропорций обрезаются по центру.</p></div>`;
  }
  const cs = (S.site.contacts || []).map((c, i) => `<section class="hrow">
    <img src="${esc(imgSrc(c.photo) || "assets/favicon.png")}" alt="" class="ava-sq">
    <div class="hmain">
      <input type="text" class="ci" data-i="${i}" data-f="name" value="${esc(c.name || "")}" placeholder="Имя Фамилия">
      <input type="text" class="ci" data-i="${i}" data-f="role" value="${esc(c.role || "")}" placeholder="Роль">
      <input type="text" class="ci" data-i="${i}" data-f="phone" value="${esc(c.phone || "")}" placeholder="+7 900 000-00-00">
      <input type="text" class="ci" data-i="${i}" data-f="wechat" value="${esc(c.wechat || "")}" placeholder="WeChat ID из профиля организатора">
      <input type="text" class="ci" data-i="${i}" data-f="telegram" value="${esc(c.telegram || "")}" placeholder="Telegram: @username или https://t.me/username">
      <div class="hrow-b"><label class="mini btn ghost">Фото<input type="file" accept="image/*" data-cphoto="${i}" hidden></label>
        <button class="linkbtn" data-cdel="${i}">удалить</button></div>
    </div></section>`).join("");
  const ps = (S.site.places || []).map((p, i) => `<section class="hrow"><div class="hmain">
      <input type="text" class="pi" data-i="${i}" data-f="name" value="${esc(p.name || "")}" placeholder="Название отеля">
      <input type="text" class="pi" data-i="${i}" data-f="note" value="${esc(p.note || "")}" placeholder="Город и даты">
      <input type="text" class="pi" data-i="${i}" data-f="zh" value="${esc(p.zh || "")}" placeholder="Название по-китайски">
      <input type="text" class="pi" data-i="${i}" data-f="phone" value="${esc(p.phone || "")}" placeholder="Телефон">
      <div class="hrow-b"><button class="linkbtn" data-pdel2="${i}">удалить</button></div>
    </div></section>`).join("");
  return `<div class="sec"><div class="sec-head"><h1>Контакты</h1></div><div class="form"><label for="contactNote">Текстовый блок в разделе контактов</label><textarea id="contactNote" rows="6" maxlength="5000">${esc(S.site.contactNote ?? DEFAULT_CONTACT_NOTE)}</textarea></div>${cs}
    <div class="row tools"><button class="btn ghost" data-act="cadd">Добавить контакт</button></div>
    <div class="sec-head"><h1 class="h2">Отели</h1></div>${ps}
    <div class="row tools"><button class="btn ghost" data-act="padd">Добавить отель</button><button class="btn" data-act="site-off">Готово</button></div></div>`;
}

function saveUploadedBanner(section,field,key,language,generation){
  if(generation!==accessGeneration||!isOrg())return false;
  const raw=S.rawContent.site;
  if(language==='en'){raw[section].en??={};raw[section].en[field]=key;}else raw[section][field]=key;
  S.site=EnglishUI.get()==='en'?englishContent(structuredClone(raw)):structuredClone(raw);
  saveSite();applyBrand();renderContacts();renderStatus();return true;
}
function bindSiteEditor() {
  if(typeof refreshAppIcons==='function')void refreshAppIcons();
  const resetCover=$('resetEnglishCover');if(resetCover)resetCover.onclick=()=>{S.site.brand.cover='';saveSite();S.site.brand.cover=S.rawContent.site.brand.cover||'';applyBrand();renderContacts();renderStatus();};
  const englishToggle=$('englishEnabled');if(englishToggle)englishToggle.onchange=async()=>{
    englishToggle.disabled=true;S.site.englishEnabled=englishToggle.checked;saveSite();
    await flushPending();
    if(S.pending.has('site')){englishToggle.disabled=false;toast('Не удалось сохранить настройку языка. Проверьте соединение.');return;}
    hydrate({...S.rawContent,draws:structuredClone(S.draws)});applyBrand();renderTabs();renderDay();renderStatus();renderPeople();renderContacts();
  };
  for (const [id,key] of [["loginIntro","intro"],["loginInputLabel","inputLabel"]]) {
    const field = $(id); if (field) field.oninput = () => { S.site.login[key] = field.value; saveSite(); applyBrand(); };
  }
  const title = $("loginTitle"); if (title) title.oninput = () => { S.site.login.title = title.value; saveSite(); applyBrand(); };
  const note = $("contactNote"); if (note) note.oninput = () => { S.site.contactNote = note.value; saveSite(); };
  const remove = $("removeLoginBanner"); if (remove) remove.onclick = () => { S.site.login.banner = ""; saveSite(); if(englishAdmin())S.site.login.banner=S.rawContent.site.login.banner||""; applyBrand(); renderContacts(); };
  const loginFile = $("loginBannerFile"); if (loginFile) loginFile.onchange = async () => {
    const file = loginFile.files[0]; if (!file) return;
    const language=EnglishUI.get(),generation=accessGeneration;
    try {
      const blob = await shrinkWide(file, 1400);
      const key = await apiUpload("login", "login-banner.jpg", blob);
      if(generation!==accessGeneration||!isOrg())return;
      S.saved.set(key, URL.createObjectURL(blob));
      if(saveUploadedBanner("login","banner",key,language,generation))toast("Баннер входа обновлён");
    } catch (e) { toast(e?.message || "Не удалось загрузить баннер входа"); }
  };
  const cov = $("bcover"); if (cov) cov.onchange = async () => {
    const f = cov.files[0]; if (!f) return;
    const language=EnglishUI.get(),generation=accessGeneration;
    const blob = await shrinkWide(f, 1400);
    let key = `assets/img/cover-${Date.now().toString(36)}.jpg`;
    if (online()) { try { key = await apiUpload("img", key.split("/").pop(), blob); } catch (e) { toast(e.message); return; } }
    await idbPut(key, { blob, at: Date.now(), draft: !online() });
    S.saved.set(key, URL.createObjectURL(blob));
    saveUploadedBanner("brand","cover",key,language,generation);
  };
  const bf = $("bfoot"); if (bf) bf.oninput = () => { S.site.brand.footer = bf.value; saveSite(); applyBrand(); };
  document.querySelectorAll(".si").forEach((inp) => { inp.onchange = () => { S.site.brand.sections[inp.dataset.k] = inp.checked; saveSite(); applyBrand(); }; });
  document.querySelectorAll(".ci").forEach((inp) => { inp.oninput = () => { S.site.contacts[+inp.dataset.i][inp.dataset.f] = inp.value; saveSite(); }; });
  document.querySelectorAll(".pi").forEach((inp) => { inp.oninput = () => { S.site.places[+inp.dataset.i][inp.dataset.f] = inp.value; saveSite(); }; });
  document.querySelectorAll("[data-cphoto]").forEach((inp) => {
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      const data = await shrinkPhoto(f);
      S.site.contacts[+inp.dataset.cphoto].photo = data; saveSite(); renderContacts();
    };
  });
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-dedit],[data-srow-del],[data-cdel],[data-pdel2],[data-secoff],[data-act]"); if (!b) return;
  if (b.dataset.secoff) {
    const k = b.dataset.secoff, on = brand().sections[k] !== false;
    S.site.brand.sections[k] = !on; saveSite(); applyBrand();
    if (k === "people") renderPeople(); else renderContacts();
    toast(on ? "Раздел выключен — участники его не увидят" : "Раздел включён");
    return;
  }
  if (b.dataset.dedit !== undefined) { beginDayEdit(+b.dataset.dedit); renderDay(); const f = $("dform"); if (f) f.scrollIntoView({ block: "center" }); return; }
  if (b.dataset.srowDel !== undefined) { if (syncDayForm() === false) return; S.dayDraft.schedule.splice(+b.dataset.srowDel, 1); renderDay(); return; }
  if (b.dataset.cdel !== undefined) { if (confirm("Удалить контакт?")) { S.site.contacts.splice(+b.dataset.cdel, 1); saveSite(); renderContacts(); } return; }
  if (b.dataset.pdel2 !== undefined) { if (confirm("Удалить отель?")) { S.site.places.splice(+b.dataset.pdel2, 1); saveSite(); renderContacts(); } return; }
  switch (b.dataset.act) {
    case "srow-add": { if (syncDayForm() === false) return; const d = S.dayDraft; d.schedule = d.schedule || []; d.schedule.push(["", ""]); renderDay(); const rows = document.querySelectorAll(".srow input[data-f=time]"); if (rows.length) rows[rows.length - 1].focus(); break; }
    case "dcancel": discardDayEdit(); S.sel=Math.min(S.sel,DAYS.length-1); renderTabs(); renderDay(); break;
    case "dday-del": {
      const d = S.dayOriginal;
      if(!d){discardDayEdit();S.sel=Math.max(0,DAYS.length-1);renderDay();break;}
      if(DAYS.length===1){toast("Нельзя удалить последний день программы");break;}
      if (!confirm(`Удалить день «${d.title || d.date}» целиком?`)) break;
      DAYS = DAYS.filter((x) => x !== d); discardDayEdit(); S.sel = Math.max(0, Math.min(S.sel, DAYS.length - 1));
      saveProgram(); renderTabs(); renderDay(); break;
    }
    case "dday-add": {
      const last = DAYS[DAYS.length - 1];
      const next = last ? new Date(Date.parse(last.date + "T00:00:00Z") + 864e5).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
      beginDayEdit(DAYS.length,{ date: next, title: "Новый день", img: last ? last.img : "", imgPos: "50% 50%", text: [], schedule: [] });
      S.sel = DAYS.length; renderTabs(); renderDay(); break;
    }
    case "site-edit": S.siteEdit = "contacts"; renderContacts(); break;
    case "brand-edit": S.siteEdit = "brand"; renderContacts(); break;
    case "site-off": S.siteEdit = ""; renderContacts(); break;
    case "cadd": S.site.contacts = [...(S.site.contacts || []), { name: "", role: "", phone: "", wechat: "", telegram: "" }]; saveSite(); renderContacts(); break;
    case "padd": S.site.places = [...(S.site.places || []), { name: "", note: "", zh: "", phone: "" }]; saveSite(); renderContacts(); break;
  }
});

/* ---------- Защищённый запуск ---------- */
function applyIdentity(c) {
  S.server = true; S.role = c.role; S.token = c.role === "admin" ? "cookie" : "";
  S.code = c.me?.code || ""; S.invites = c.invites || {}; S.offlineUntil = c.offlineUntil || 0;
}
function hydrate(c) {
  applyIdentity(c); c=projectEnglish(c); S.draws = c.draws || {};
  S.people = S.filePeople = c.participants.people || [];
  S.tasks = S.fileTasks = c.tasks.tasks || {}; S.houses = S.fileHouses = c.houses;
  applyProgram(c.program); applySite(c.site); S.tasksLoaded = true;
}
function applyLoginAppearance(value) {
  S.publicAppearance=structuredClone(value);
  if(S.role==='guest'){
    S.englishEnabled=value.englishEnabled!==false;
    let preferred='ru';try{preferred=localStorage.getItem('drakon-guest-language')||'ru';}catch{}
    EnglishUI.set(S.englishEnabled?preferred:'ru');
    renderLanguageControl();
  }
  if(EnglishUI.get()==='en'){
    const en=value.en||{};value={...value};
    for(const key of ['title','intro','inputLabel','footer','banner'])if(en[key]?.trim())value[key]=en[key];
    if(!en.intro&&value.intro===DEFAULT_LOGIN.intro)value.intro=EnglishUI.t(value.intro);
    if(!en.inputLabel&&value.inputLabel===DEFAULT_LOGIN.inputLabel)value.inputLabel=EnglishUI.t(value.inputLabel);
  }
  $("accessIntro").textContent = value.intro ?? DEFAULT_LOGIN.intro;
  $("inviteLabel").textContent = value.inputLabel ?? DEFAULT_LOGIN.inputLabel;
  $("accessTitle").textContent = value.title ?? DEFAULT_LOGIN.title;
  document.title = value.title || DEFAULT_LOGIN.title;
  document.querySelectorAll("[data-site-footer]").forEach(f => f.textContent = value.footer ?? "");
  const img = $("accessBanner");
  img.onerror = () => { img.hidden = true; };
  img.onload = () => { img.hidden = false; };
  if (value.banner) { img.hidden = false; if (img.getAttribute("src") !== value.banner) img.src = value.banner; }
  else { img.hidden = true; img.removeAttribute("src"); }
}
async function loadLoginAppearance() {
  try { const r = await fetch("/api/login-appearance", {cache:"no-store"}); if (r.ok) { const value = await r.json(); if (S.role === "guest") applyLoginAppearance(value); } } catch {}
}
function showAccess(message = "") {
  document.body.classList.add("access-locked"); $("accessGate").hidden = false;
  $("accessMessage").textContent = message;
  void loadLoginAppearance();
  A.pause(); $("ceremony").hidden = true; document.body.classList.remove("locked");
}
async function clearPrivate() {
  accessGeneration++; closeEnglishDialog(); S.rawContent=null;document.body.classList.remove("is-organiser");$("editingLanguage").hidden=true;
  S.role = "guest"; S.token = ""; S.code = ""; S.invites = {}; S.people = []; S.draws = {}; S.drawPending = {};
  discardDayEdit();
  S.pending.clear(); S.edit = S.hEdit = false; S.siteEdit = ""; S.dayEdit = S.taskEdit = -1;
  for (const timer of Object.values(timers)) clearTimeout(timer);
  A.pause(); A.removeAttribute("src");
  for (const url of S.saved.values()) URL.revokeObjectURL(url); S.saved.clear();
  for (const key of Object.keys(localStorage)) if (key.startsWith("pds-")) localStorage.removeItem(key);
  try { const d = await db(); await new Promise((resolve, reject) => { const tx=d.transaction("audio","readwrite");tx.objectStore("audio").clear();tx.oncomplete=resolve;tx.onerror=reject; }); } catch {}
  if ("caches" in window) for (const key of await caches.keys()) if (key.startsWith("drakon-private-")) await caches.delete(key);
}
async function logoutSecure() {
  await clearPrivate();localStorage.setItem("pds-logout-pending","1");showAccess("Данные удалены с устройства");
  try { const r=await fetch("/api/logout",{method:"POST",headers:{"content-type":"application/json"},body:"{}"});if(r.ok)localStorage.removeItem("pds-logout-pending"); } catch {}
  location.reload();
}
async function bootSecure() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(()=>{});
  const token = new URLSearchParams(location.hash.slice(1)).get("invite");
  if (location.hash) history.replaceState(null,"","/");
  if (localStorage.getItem("pds-logout-pending")) {
    try { const r=await fetch("/api/logout",{method:"POST",headers:{"content-type":"application/json"},body:"{}"});if(!r.ok)throw Error();localStorage.removeItem("pds-logout-pending"); } catch {showAccess("Для завершения выхода подключитесь к интернету");return;}
  }
  if (token) {
    await clearPrivate();
    try { const r=await fetch("/api/enter",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token})});if(!r.ok){showAccess((await r.json()).error);return;} }
    catch {showAccess("Первый вход по приглашению требует интернета. Откройте ссылку после подключения.");return;}
  }
  let c = await apiContent();
  if (!c) {
    try {c=JSON.parse(localStorage.getItem(LS.content)||"null");}catch{}
    if (!c || c.role !== "participant" || c.offlineUntil <= Date.now()) { await clearPrivate();showAccess();return; }
  }
  hydrate(c);
  try {S.drawPending=JSON.parse(localStorage.getItem(LS.draws)||"{}");}catch{}
  if (isOrg()) {
    S.pending=new Set((localStorage.getItem(LS.pending)||"").split(",").filter(Boolean));
    readDraft();readTasksDraft();readHousesDraft();readProgramDraft();flushPending();
  }
  const today=tripToday(),i=DAYS.findIndex(d=>d.date===today);S.sel=i>=0?i:0;
  $("ver").textContent="Закрытая версия 1";applyBrand();
  await Promise.race([loadSaved(),new Promise(r=>setTimeout(r,4000))]);
  renderTabs();renderStatus();renderDay();renderHouse();renderPeople();showView(S.view);
  $("accessGate").hidden=true;document.body.classList.remove("access-locked");syncDraws();
}
async function exportSecureLinks() {
  await flushPending();
  const r=await fetch("/api/invitations",{cache:"no-store"});if(!r.ok){toast("Войдите как организатор");return;}
  S.invites=(await r.json()).invites;
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+linksCSV()],{type:"text/csv"}));a.download="links.csv";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
document.addEventListener("click",async e=>{
  const b=e.target.closest("[data-invite]");if(!b||!isOrg())return;
  if(!confirm(b.dataset.invite==="revoke"?"Отозвать ссылку и доступ на устройствах участника?":"Выдать новую ссылку? Старая ссылка и прежние сессии перестанут работать."))return;
  try {await flushPending();const r=await fetch("/api/invitations",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:b.dataset.person,action:b.dataset.invite})});if(!r.ok)throw Error();S.invites=(await r.json()).invites;renderPeople();toast("Доступ обновлён");}catch{toast("Не удалось изменить доступ. Проверьте соединение.");}
});
let organiserLoginPending=false;
async function promptOrganiserLogin(){
  if(organiserLoginPending||isOrg())return;
  const password=window.prompt(EnglishUI.t("Пароль организатора"));
  if(password===null||password==='')return;
  organiserLoginPending=true;
  const view=S.view,day=DAYS[S.sel]?.date,scroll=window.scrollY;
  try{
    const r=await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password})});
    if(!r.ok){toast(EnglishUI.t((await r.json()).error||'Неверный пароль'));return;}
    await clearPrivate();await bootSecure();
    const selected=DAYS.findIndex(d=>d.date===day);if(selected>=0)S.sel=selected;
    renderTabs();renderDay();showView(view);window.scrollTo(0,scroll);
  }catch{toast(EnglishUI.t('Не удалось подключиться к серверу'));}
  finally{organiserLoginPending=false;}
}
$("adminForm").onsubmit=async e=>{
  e.preventDefault();const password=$("adminPassword").value;$("adminPassword").value="";
  try{const r=await fetch("/api/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({password})});if(!r.ok){$("accessMessage").textContent=(await r.json()).error;return;}await clearPrivate();await bootSecure();}catch{$("accessMessage").textContent="Не удалось подключиться к серверу";}
};
$("inviteForm").onsubmit=async e=>{
  e.preventDefault();const input=$("inviteInput").value.trim();let token=input;
  try{token=new URLSearchParams(new URL(input).hash.slice(1)).get("invite")||input;}catch{}
  if(!/^(?:[A-Za-z0-9]{12}|[a-f0-9]{64})$/.test(token)){$("accessMessage").textContent="Вставьте полную персональную ссылку";return;}
  location.hash="invite="+token;location.reload();
};
$("forgetDevice").onclick=logoutSecure;
setInterval(()=>{if(S.role==="participant"&&S.offlineUntil<=Date.now())clearPrivate().then(()=>showAccess("Подключитесь к интернету для обновления доступа"));},30000);
addEventListener("hashchange",()=>{if(location.hash.startsWith("#invite="))location.reload();});
$('languageControl').onclick=e=>{const link=e.target.closest('[data-language]');if(link){e.preventDefault();e.stopPropagation();switchLanguage(link.dataset.language);}};
try{EnglishUI.set(localStorage.getItem('drakon-guest-language')||'ru');}catch{}
renderLanguageControl();EnglishUI.start();
void loadLoginAppearance();
bootSecure().catch(()=>showAccess("Не удалось открыть приложение. Проверьте соединение и повторите вход."));

