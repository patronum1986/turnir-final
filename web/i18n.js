/* Interface translations only. Event content is translated through explicit en fields. */
const EnglishUI = (() => {
 let language='ru';
 const dictionary={
 'Порядок участников':'Participant order','По ФИО':'By name','По Домам, затем по ФИО':'By House, then name','Ручной порядок':'Manual order','Показывать текущего участника первым':'Show the current participant first','Без Дома':'No House','Поднять участника':'Move participant up','Опустить участника':'Move participant down','Меняйте порядок кнопками ↑ ↓. Для перестановки очистите поиск. Новые участники добавляются в конец.':'Use ↑ ↓ to reorder. Clear the search before reordering. New participants are added at the end.',

 'Программа':'Programme','Участники':'Participants','Контакты':'Contacts','Отели':'Hotels','вы':'you','День':'Day',
 'Войти по приглашению':'Sign in with invitation','Вход организатора':'Organiser sign-in','Пароль организатора':'Organiser password','Войти':'Sign in',
 'Персональная ссылка или код':'Personal invitation link or code','Откройте приглашение или войдите как организатор. Для первого входа нужен интернет.':'Open your invitation or sign in as an organiser. Internet access is required for your first sign-in.',
 'Выйти и удалить данные с устройства':'Sign out and remove data from this device','Закрытая версия 1':'Private version 1',
 'Поиск по имени или банку':'Search by name or bank','Никого не нашлось':'No matches found','Список участников пока пуст':'The participant list is empty',
 'Запись готовится':'Recording coming soon','Задание дня':'Daily task','Пауза':'Pause','Слушать':'Play','Перемотка':'Seek','Назад на 15 секунд':'Back 15 seconds','Вперёд на 15 секунд':'Forward 15 seconds','Дни поездки':'Trip days','Разделы':'Sections',
 'Не закрывайте страницу до конца загрузки.':'Keep this page open until the download is complete.',
 'Все записи сохранены. Гид работает без интернета.':'All files are saved. The guide is available offline.',
 'Часть записей удалена с телефона':'Some files have been removed from this device','Записи ещё не сохранены':'Files have not been saved yet',
 'Скачайте их заранее, дома по Wi-Fi, — в Китае гид будет работать без интернета.':'Download them over Wi-Fi before your trip to use the guide offline in China.',
 'Скачать заново':'Download again','Скачать всё':'Download all','Докачать':'Resume download','Докачайте остальные, пока есть интернет.':'Download the remaining files while you have internet access.',
 'Установить на телефон':'Install on your phone','Сначала добавьте гид на экран «Домой».':'First, add the guide to your Home Screen.',
 '«Поделиться» → «На экран „Домой“». Потом откройте гид с иконки и скачайте записи уже там: из обычного Safari они сотрутся через неделю.':'Share → Add to Home Screen. Then open the installed guide and download the files there. Safari may remove stored website data.',
 'В Safari нажмите':'In Safari, tap',
 'Запись открыта. Слушайте, когда будете готовы.':'The recording is available. Listen when you are ready.',
 'Запись открыта, но не сохранена на телефон.':'The recording is available but has not been saved to this device.',
 'Ваш дом':'Your house','Путешествие начинается прямо сейчас':'Your journey starts now','Выберите свой Дом Дракона.':'Discover your Dragon House.','Тянуть жребий':'Draw your lot','Жребий Дракона':'Dragon draw','Я готов':'I am ready','Позже':'Later','Выберите свиток':'Choose a scroll','В путь':'Let’s go',
 'Вступление':'Introduction','Пункт':'Item','Важное':'Important','Скопировать название':'Copy name','Покажите китайское название таксисту.':'Show the Chinese name to your taxi driver.',
 'Скопировано':'Copied','ID скопирован. Откройте WeChat → + → Добавить контакты и вставьте ID.':'ID copied. Open WeChat → + → Add Contacts and paste the ID.',
 'Контакт Telegram пока недоступен. Уточните его у организатора.':'This Telegram contact is unavailable. Please check with the organiser.',
 'Нет интернета. Подключитесь к Wi-Fi и нажмите ещё раз.':'No internet connection. Connect to Wi-Fi and try again.',
 'Браузер не даёт сохранять записи. Откройте гид в Safari или Chrome, не в режиме инкогнито.':'Your browser cannot save files. Open the guide in Safari or Chrome outside private browsing mode.',
 'Эта запись не сохранена на телефон. Подключитесь к интернету и нажмите «Скачать всё».':'This recording is not saved on your device. Connect to the internet and select Download all.',
 'Не удалось включить запись. Нажмите ещё раз.':'Unable to play the recording. Please try again.',
 'Недостаточно места для офлайн-копии. Освободите память устройства.':'Not enough storage for the offline copy. Free up space on your device.',
 'Доступ завершён. Откройте приглашение заново.':'Your access has ended. Open your invitation again.',
 'Данные удалены с устройства':'Data removed from this device','Для завершения выхода подключитесь к интернету':'Connect to the internet to finish signing out',
 'Первый вход по приглашению требует интернета. Откройте ссылку после подключения.':'Your first invitation sign-in requires internet access. Open the link again when connected.',
 'Подключитесь к интернету для обновления доступа':'Connect to the internet to renew your access',
 'Не удалось открыть приложение. Проверьте соединение и повторите вход.':'Unable to open the app. Check your connection and sign in again.',
 'Не удалось подключиться к серверу':'Unable to connect to the server','Вставьте полную персональную ссылку':'Enter your personal invitation link or code',
 'Приглашение недействительно':'This invitation is invalid','Неверный пароль':'Incorrect password','Запрос отклонён':'Request rejected','Ошибка сервера':'Server error',
 'Скопируйте ID вручную. Затем WeChat → + → Добавить контакты:':'Copy the ID manually. Then open WeChat → + → Add Contacts:',
 'Не удалось скопировать автоматически. Скопируйте текст вручную:':'Automatic copying failed. Copy the text manually:',
 };
 Object.assign(dictionary,{"ФИО": "Name", "Банк": "Bank", "Фамилия Имя": "Full name", "Название банка": "Bank name", "Команда": "House", "Персональная ссылка": "Personal invitation link", "Язык приложения": "App language", "Поддержка английского языка": "English language support", "При отключении участники видят только русский. Переводы и выбранные языки сохраняются.": "When disabled, participants see only Russian. Translations and language preferences are retained.", "Страница входа": "Sign-in page", "Название на странице входа": "Sign-in page title", "Текст над формой входа": "Text above the sign-in form", "Подпись поля над кнопкой входа": "Label above the sign-in button", "Подпись внизу сайта": "Footer text", "Заголовок на плашке": "Day title", "Дата": "Date", "Фото дня": "Day image", "Сдвиг по вертикали": "Vertical image position", "Текст дня (абзацы через пустую строку; ** — жирный, !! — красный)": "Day text (separate paragraphs with a blank line; ** for bold, !! for red emphasis)", "Расписание": "Schedule", "Показывать блок «Важное»": "Show the Important section", "Что происходит": "Activity", "красным": "red emphasis", "Название": "Title", "Подсказка": "Hint", "Текст": "Text", "Заголовок": "Title", "Имя": "Name", "Роль": "Role", "Телефон": "Phone", "Описание": "Description", "Город": "City", "Название отеля": "Hotel name", "По-китайски": "Chinese name", "Примечание": "Note", "Команды": "Houses", "Название дома": "House name", "Девиз": "Motto", "Цвет": "Colour", "Как показывать Дома": "House visibility", "Через жребий": "Through the draw", "Сразу, без жребия": "Immediately, without a draw", "Отключить команды": "Disable houses", "Заголовок карточки": "Card title", "Текст карточки": "Card text", "Кнопка": "Button label", "Заголовок над свитками": "Title above the scrolls", "Подпись над результатом": "Result label", "Кнопка после раскрытия": "Button after the reveal", "Свитки и раскрытие": "Scrolls and reveal", "Оформление": "Appearance"});
 Object.assign(dictionary,{
 'Режим организатора: все задания открыты.':'Organiser mode: all tasks are available.',
 'Подпись после открытия':'Text when available','Например: послушайте в автобусе по дороге к стене':'For example: listen on the bus on the way to the Great Wall',
 'Открыто всегда — для теста, перед поездкой снять':'Always available for testing — disable before the trip','Не показывать блок в этот день':'Hide this section on this day',
 'блок скрыт':'section hidden','записи нет':'no recording','Записи нет':'No recording',
 'Блок-приглашение в программе':'Draw invitation in the programme','Экран подводки':'Introduction screen','рисуется кодом':'built-in illustration',
 'Подпись внизу всех страниц, включая вход':'Footer on all pages, including sign-in','Текстовый блок в разделе контактов':'Text in the Contacts section',
 'Имя Фамилия':'Full name','Город и даты':'City and dates','Название по-китайски':'Chinese name','WeChat ID из профиля организатора':'WeChat ID from the organiser’s profile','Telegram: @username или https://t.me/username':'Telegram: @username or https://t.me/username',
 'Баннер входа: 1400×500 px. Название, этот баннер и подпись внизу видны всем до входа.':'Sign-in banner: 1400×500 px. The title, banner and footer are visible to everyone before sign-in.',
 'Главный баннер: 1400×500 px, JPG, PNG или WebP. В этом размере изображение показывается целиком. Изображения других пропорций обрезаются по центру.':'Main banner: 1400×500 px, JPG, PNG or WebP. Images of this size are shown in full. Other aspect ratios are cropped around the centre.',
 'Раздел «Команды» включается отдельно, кнопкой «Команды и жребий» под блоком жребия в «Программе». В режиме организатора все разделы видны всегда, даже выключенные.':'Enable houses separately using «Команды и жребий» in Programme. Organisers can see all sections, including disabled ones.',
 'Больше 15 МБ — лучше пережать до 64–96 kbps моно':'Over 15 MB — consider compressing to 64–96 kbps mono'
 });
 Object.assign(dictionary,{'Иконка приложения':'App icon','PNG, 1024×1024 px, до 5 МБ. Иконка общая для RU и EN и видна до входа. У уже установленного приложения она может обновиться не сразу.':'PNG, 1024×1024 px, up to 5 MB. The icon is shared by RU and EN and visible before sign-in. Installed apps may take time to update it.'});
 const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
 const ruMonths=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
 const days={'воскресенье':'Sunday','понедельник':'Monday','вторник':'Tuesday','среда':'Wednesday','четверг':'Thursday','пятница':'Friday','суббота':'Saturday'};
 function t(text){
  if(language!=='en')return text;
  const s=String(text),v=s.trim();if(dictionary[v])return s.replace(v,dictionary[v]);if(days[v])return s.replace(v,days[v]);
  if(/^День \d+\.?$/.test(v))return s.replace('День','Day');
  if(/^Свиток \d+$/.test(v))return s.replace('Свиток','Scroll');
  let m;
  if((m=/^(\d+) команд$/.exec(v)))return `${m[1]} houses`;
  if((m=/^(\d+) строк расписания$/.exec(v)))return `${m[1]} schedule entries`;
  if(v.includes(' МБ')||v.includes('открыто для теста')||v.includes('(тестовая)'))return s.replace(' МБ',' MB').replace('открыто для теста','available for testing').replace('(тестовая)','(test)');
  if(v.startsWith('Назначено — '))return s.replace('Назначено — ','Assigned — ').replace('без команды:','unassigned:').replace('Команда каждого меняется в его карточке в списке участников. Ссылки для рассылки выгружаются вместе с пакетом для сайта, файлом links.csv.','Change each participant’s house in their participant card. Export invitation links using links.csv.');
  if((m=/^Сохранено (\d+) из (\d+)(.*)$/.exec(v)))return `Saved ${m[1]} of ${m[2]}`+(m[3]?'. Connect to the internet and download again.':'');
  if((m=/^Сохраняю записи: (\d+) из (\d+)$/.exec(v)))return `Saving files: ${m[1]} of ${m[2]}`;
  if((m=/^Загрузка прервалась на записи (\d+) из (\d+)\./.exec(v)))return `Download stopped at file ${m[1]} of ${m[2]}. Check your connection and select Resume download. Saved files will be kept.`;
  if(/^Откроется |^По Пекину\.|^На вашем телефоне:/.test(v)){
   let result=s.replace('Откроется','Available on').replace('По Пекину.','Beijing time.').replace('На вашем телефоне:','On your device:').replace('Осталось','Remaining:').replace(/ в /g,' at ').replace(/ ч /g,' h ').replace(/ мин/g,' min');
   ruMonths.forEach((month,i)=>result=result.replace(month,months[i]));return result;
  }
  return s;
 }
 const original=new WeakMap(),attrs=new WeakMap();let observer;
 // Data supplied by organisers is never translated by the interface dictionary.
 const excluded='[data-content],.story,.sched,.pill,.imp p,.imp ul,.pname,.pbank,.role,.zh,.contact-note,.hname,.hmotto,.rname,.rmotto,.htitle,.hinvite p,.cer-stage h1,.cer-stage p,.task h3,.tt .custom-hint,[data-site-footer],#accessTitle,#accessIntro,#inviteLabel,#plTitle,#plSub';
 function apply(){
  observer?.disconnect();document.documentElement.lang=language;
  if(typeof restrictEnglishStructure==='function')restrictEnglishStructure();
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
  while(node=walker.nextNode()){
   if(!node.parentElement||node.parentElement.closest('script,style,textarea,option,input,'+excluded))continue;
   const record=original.get(node);const source=record&&node.nodeValue===record.output?record.source:node.nodeValue;
   const control=node.parentElement.closest('button,input[type="submit"],label.btn');
   const adminControl=document.body.classList.contains('is-organiser')&&control&&(control.closest('.form,.tools,.torg,.org,.acts,.hrow,#englishDialog')||control.matches('[data-secoff],[data-act="hedit-off"],[data-act="org-off"]'));
   const output=adminControl?source:t(source);original.set(node,{source,output});if(node.nodeValue!==output)node.nodeValue=output;
  }
  for(const el of document.querySelectorAll('[placeholder],[aria-label]'))for(const key of ['placeholder','aria-label'])if(el.hasAttribute(key)){
   const records=attrs.get(el)||{},record=records[key],value=el.getAttribute(key),source=record&&record.output===value?record.source:value,output=t(source);
   records[key]={source,output};attrs.set(el,records);if(value!==output)el.setAttribute(key,output);
  }
  observer?.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label']});
 }
 return {t,set(value){language=value==='en'?'en':'ru';apply();},get:()=>language,start(){observer=new MutationObserver(apply);apply();}};
})();
