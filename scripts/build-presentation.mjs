import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = process.env.ARTIFACT_RUNTIME;
if (!runtime) throw new Error('Set ARTIFACT_RUNTIME to the bundled dependencies directory');
const skill = process.env.PRESENTATION_SKILL;
const { Presentation, PresentationFile } = await import(pathToFileURL(path.join(runtime, 'node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs')).href);
const { finalizePresentation } = await import(pathToFileURL(path.join(skill, 'container_tools/artifact_tool_utils.mjs')).href);
const output = path.join(root, 'output/presentation');
const build = path.join(root, 'tmp/presentation');
await fs.mkdir(output, { recursive: true }); await fs.mkdir(build, { recursive: true });
const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const ink = '#163C32', soft = '#F5F8F2', accent = '#557E42';
function text(slide, value, x, y, w, h, size=30, bold=false, color=ink) {
  const box = slide.shapes.add({ geometry: 'textbox', position: { left:x, top:y, width:w, height:h }, fill:'none', line:{fill:'none',width:0} });
  box.text = value;
  box.text.style = { fontFamily:'Arial', fontSize:size, bold, color };
  return box;
}
function slide(title, notes='') {
  const s = presentation.slides.add(); s.background.fill=soft;
  if (title) text(s,title,64,48,1152,90,46,true);
  s.speakerNotes.text = notes + '\nДжерела: локальний код CookBook-AI; docs/practical-work.md; docs/evidence/browser-smoke.json; методичні вказівки Пр роб.pdf, робота №13.';
  return s;
}
async function picture(s,file,x,y,w,h) {
  const bytes=await fs.readFile(path.join(root,'docs/evidence',file));
  s.images.add({blob:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),contentType:'image/png',alt:'Скріншот CookBook AI: '+file,fit:'contain',position:{left:x,top:y,width:w,height:h}});
}
let s=slide('', 'Вступ, 20 секунд. Перед захистом додати справжні ПІБ та ролі команди: вони не були надані. Зовнішній ШІ у поточному MVP не підключено.');
text(s,'CookBook AI',64,170,1150,100,78,true);
text(s,'Страви з продуктів, які вже є вдома',68,292,1120,90,38);
text(s,'Навчальний MVP · Проєктний практикум',68,510,1120,48,24,false,accent);
text(s,'10 листопада 2026',68,562,1120,42,22);

s=slide('Проблема та користувачі','40 секунд. Користувачі: студенти, люди, які готують удома та хочуть використати наявні продукти. Не заявляти виміряне скорочення харчових відходів: таких досліджень немає.');
text(s,'Що приготувати з того, що є?',64,170,500,105,36,true);
text(s,'Для студентів і домашніх кухарів, яким потрібні прості ідеї без зайвих покупок.',64,300,500,150,29);
text(s,'Продукти → відповідні рецепти → інструкція',64,520,510,100,27,false,accent);
await picture(s,'register.png',600,160,616,440);

s=slide('Архітектура застосунку','50 секунд. SPA надсилає запити через proxy на /api/v1. NestJS валідує DTO, JWT guard перевіряє приватні маршрути, Prisma працює з SQLite. У production потрібен постійний диск або міграція на серверну СУБД.');
const nodes=[['React + Vite',64],['NestJS API',464],['Prisma + SQLite',864]];
for (const [label,x] of nodes) {
  s.shapes.add({geometry:'rect',position:{left:x,top:200,width:350,height:110},fill:'#E4EDDF',line:{fill:'#92B187',width:1}});
  text(s,label,x+18,226,314,60,31,true);
}
text(s,'→',424,226,40,60,35); text(s,'→',824,226,40,60,35);
text(s,'/api/v1 · JSON · Bearer JWT',64,365,1120,52,30,false,accent);
text(s,'Паролі: Argon2. Токени: 2 години. Дані: 8 таблиць.',64,455,1120,65,29);
text(s,'Локальна версія перевірена. Хмарний хостинг ще не налаштовано.',64,565,1120,72,25);

s=slide('Обсяг MVP','50 секунд. Перелічити готовий функціонал і окремо Post-MVP. Таблиці обраного та покупок існують, але відповідний UI/API не реалізовано. Статистику спринтів і тікетів команда має додати за реальною дошкою.');
text(s,'Реалізовано',64,170,540,60,34,true);
text(s,'Реєстрація та вхід\nХолодильник користувача\nПідбір від 70% інгредієнтів\nКаталог і сторінка рецепта\nКБЖУ на порцію',64,255,545,330,29);
text(s,'Post-MVP',690,170,525,60,34,true);
text(s,'Генерація через зовнішній ШІ\nКерування рецептами\nРедагування профілю\nОбране та список покупок\nПідбір з урахуванням ваги',690,255,525,330,29);

s=slide('Жива демонстрація','5 хвилин. Перейти у браузер: зареєструвати нового користувача; показати email; додати яйце, помідор, олію; відкрити омлет; видалити інгредієнт; вийти й повторно увійти. Редагування профілю не реалізовано, показувати лише дані профілю.');
text(s,'1. Реєстрація\n2. Продукти у холодильнику\n3. Рекомендація\n4. Рецепт і КБЖУ\n5. Вихід та повторний вхід',64,195,490,370,30);
await picture(s,'recipe.png',580,160,636,470);

s=slide('Якість і виправлення','2 хвилини. 6 unit-тестів, 11 HTTP-сценаріїв, 12 браузерних сценаріїв. Node runner показує 18 записів, оскільки враховує контейнер HTTP-підтестів. Coverage 100% тільки для модуля match, не всього застосунку.');
text(s,'100%',64,165,390,150,96,true,accent);
text(s,'покриття модуля підбору\nLines · Branches · Functions',64,325,500,120,29);
text(s,'6 unit-тестів\n11 HTTP-сценаріїв\n12 браузерних сценаріїв',690,185,520,200,34,true);
text(s,'Виправлено запуск Prisma, валідацію імені, поріг рекомендацій та повідомлення про мережеву помилку.',64,520,1150,110,29);

s=slide('Підготовка до публічного релізу','Не видавати ці кроки за завершені. Репозиторій наданий користувачем; локальна папка не містила .git. Потрібні справжні PR, зовнішній review, релізний тег, хостинг та повторна перевірка. Ретроспективу заповнює команда після захисту.');
text(s,'Готові локально',64,170,1120,50,32,true);
text(s,'Код, тести, README, ER-схема, звіт і сценарій демо.',64,245,1120,80,30);
text(s,'Залишилося',64,370,1120,50,32,true);
text(s,'Командне рев’ю → публікація → хмарний smoke → захист',64,450,1120,110,31);
text(s,'github.com/SemiTail/CookBook-AI',64,610,1120,40,24,false,accent);

for (const [i,s] of presentation.slides.items.entries()) {
  const png=await presentation.export({slide:s,format:'png',scale:1});
  await fs.writeFile(path.join(build,`slide-${i+1}.png`),new Uint8Array(await png.arrayBuffer()));
}
const candidatePath=path.join(build,'candidate.pptx');
await (await PresentationFile.exportPptx(presentation)).save(candidatePath);
await finalizePresentation({workspaceDir:root,candidatePath,finalPath:path.join(output,'cookbook-ai.pptx'),pythonExecutable:path.join(runtime,'python/python.exe'),integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit'],fontPolicy:{basis:'design',families:['Arial']},verifyArtifactToolImport:true,receiptPath:path.join(build,'validation.json')});
// The bundled PDF exporter currently fails to resolve #standard-fonts/Helvetica.
// Export the inspected renders using export-slides-pdf.py; PPTX stays editable.
console.log('Created 7-slide editable PPTX. Run export-slides-pdf.py for the PDF handout.');
