import json,re,sqlite3,uuid,datetime,unicodedata
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def norm(s):return ' '.join(sorted(re.findall(r'\w+',unicodedata.normalize('NFKC',s).lower().replace('ґ','г'))))
ALIASES={}
for line in '''абрикоси=Абрикос
артишоки=Артишок
банани=Банан
волоські горіхи=Волоський горіх
бамія=Окра
гхі=Масло гхі
кацуобусі=Рибні пластівці кацуобусі
водорості комбу=Комбу
місо=Місо-паста
кочуджан=Паста кочуджан
тахіні=Кунжутна паста тахіні
ткемалі=Соус ткемалі
фета=Сир фета
гауда=Сир гауда
брі=Сир брі
камамбер=Сир камамбер
чеддер=Сир чедер
емменталь=Сир ементаль
кедрові горіхи=Кедровий горіх
горіх пекан=Пекан
кукурудза=Кукурудза свіжа
лимони=Лимон
яблука=Яблуко
сливи=Слива
халапеньйо=Перець халапеньйо
чорний кмин=Кмин чорний
насіння калінджі=Кмин чорний
курага=Курага
морські водорості=Харчові водорості
рибний соус=Соус рибний
соєвий соус шою=Соєвий соус
рисовий оцет=Оцет рисовий
соус чимічурі=Соус чимічурі
чимічурі=Соус чимічурі
хлібний плід=Хлібний плід
хлібне дерево=Хлібний плід
юка=Маніок
кочугару=Перець кочугару
твенджан=Соєва паста твенджан
рас-ель-ханут=Суміш спецій рас-ель-ханут
плоди баобаба=Баобаб
марула=Плоди марули
пірі-пірі=Перець пірі-пірі
таро дашин=Таро
батат каукау=Батат
батат кумара=Батат
єрба-мате=Мате
лимонний крем lemon curd=Лимонний крем lemon curd
''' .strip().splitlines():
 a,b=line.split('=');ALIASES[norm(a)]=b
for a,b in {'фісташки':'Фісташка','кеш’ю':'Кешью','бринза':'Сир бринза','кукурудза':'Кукурудза','гхі':'Топлене масло','кава':'Кава мелена','какао':'Какао-порошок','чай':'Чай чорний','мак':'Насіння маку','кунжут':'Насіння кунжуту','хабанеро':'Перець хабанеро','сичуанський перець':'Перець сичуанський','чорний кмин':'Чорний кмин','насіння калінджі':'Чорний кмин','єрба-мате':'Чай мате','мате':'Чай мате','кочугару':'Перець кочугару'}.items():
 # Only use a synonym target that already exists; otherwise keep the user's name.
 c=sqlite3.connect(ROOT/'backend/dev.db');present=c.execute('SELECT name FROM Ingredient WHERE name=?',(b,)).fetchone();c.close()
 if present:ALIASES[norm(a)]=b
OVERRIDES={}
for cat,names in {
 'Крупи':'Ферментована кукурудза|Ферментована кукурудзяна маса кенкей|Трахана|Берхер-мюслі|Фіолетова кукурудза|Кукурудза канча|Біла кукурудза|Попкорн',
 'Напої':'Гібіскус|Каркаде|Сушений гібіскус|Матча|Улун Алішань|Мате|Горчата з чуфи',
 'Їстівні комахи':'Їстівні гусениці|Гусениці мопане',
 'Овочі':'Маланга|Серцевина пальми|Порошок сушеної бамії|Цикорій вітлуф|Мака',
 'Спеції':'Пажитник|Галангал|Аннато ачіоте|Мастиха Хіоса',
 'Соуси та заправки':'Хариса|Лютениця|Ремулaд|Песто дженовезе',
 'Фрукти':'Матоке|Яблука апорт|Горака|Фізаліс учува|Каму-каму|Оливки|Оливки Каламата|Оливки Бара|Гуарана',
 'Кондитерські інгредієнти':'Цукрова тростина|Трояндова вода|Оманська халва|Салміаккі',
 'Мариновані та ферментовані продукти':'Кодзі|Натто|Ферментований тофу',
 'Зелень':'Женьшень|В’єтнамський коріандр|Любисток',
 'Хліб та випічка':'Пиріг бирек|Монегаська фугас|Житня закваска жур|Торунські пряники|Масляні тарталетки',
 'Молочні продукти':'Маринований гермелін|Фермерський чеддер|Моцарела ді буфала|Парміджано-реджано|Пекоріно романо',
 'Риба та морепродукти':'Маринований оселедець|Ряпушка|Осетрова ікра|Сюрстремінг|Морепродукти',
 "М'ясні вироби":'Братвурст|Хамон іберіко',
 'Макаронні вироби':'Яєчна локшина шпецле',
 'Алкогольні напої':'Рислінг',
 'Горіхи та насіння':'Мак|Арахісова паста',
}.items():
 for n in names.split('|'):OVERRIDES[norm(n)]=cat
RULES=[
 ('Олії','🫒',r'олія|гусячий жир'),('Алкогольні напої','🍷',r'вино|винний|віскі|ром\b|горіл|ракія|пиво|настоян|наливк|лікер|шампан|піско|кашаса|мескаль|стаут|аквавіт|женевер|бренн|бальзам|арак\b|сливовиц|напій грог|напій тедж|напій уруарва|напій бозо|чича\b|мамахуана|макколлі|ель\b'),
 ('Харчові водорості','🌿',r'водорост'),('Борошно та крохмаль','🌾',r'борошн|крохмал|саго\b'),
 ('Молочні продукти','🧀',r'сир|молоко|йогурт|кефір|вершк|масло|каймак|лабне|скір|кумис|шубат|айраг|курт\b|курут|мацун|бринза|стілтон|грюєр|рокфор|едам\b|аппенцеллер'),
 ('Риба та морепродукти','🐟',r'риб|краб|лобстер|кревет|лосос|вугор|форель|тріск|сардин|молюск|міді|шпрот|окунь|тунець|устриц|конч\b|голець'),
 ("М'ясні вироби",'🥓',r'ковбас|шинка|салямі|суджук|пршут|прошут|гуанчале|білтонг|бекон|в.ялен|сушене м.ясо|паштет|шпек'),
 ("М'ясо",'🥩',r'м.ясо|ялович|свинин|баранин|козлят|конин|кролят|печінк|зебу'),
 ('Підсолоджувачі','🍯',r'мед\b|цукор|сироп|патока|джагері|панела|стевія'),
 ('Соуси та заправки','🥣',r'соус|паста|приправа|самбал|айвар|кечап|гірчиц|майонез|оцет|сумбала|бербере|дукка|заатар|рас-ель|суміш спецій|епіс|мазавару'),
 ('Напої','🫖',r'напій|чай|кава|какао|сік|узвар|ройбуш|рутбір|kinnie|rivella|лимонад|терере|еспресо'),
 ('Хліб та випічка','🥖',r'хліб|корж|булоч|торт|печиво|пиріж|плацинд|піадіна|штрудель|брецел|тісто|тістеч|паштел|вафл|потиця|баурсаки'),
 ('Кондитерські інгредієнти','🍫',r'шоколад|джем|варення|повидло|мармелад|карамел|цукерк|чурчхела|суджух|дульсе|арекіпе|турон|лакриця|стропваф'),
 ('Спеції','🧂',r'перець|паприк|шафран|кориц|куркум|кмин|сумах|сіль|асафетид|ажгон|ваніл|гвоздик|кардамон|мацис|ялівець|галап|пірі|хабанеро|поблано|рокото|ахі-|чилі'),
 ('Горіхи та насіння','🥜',r'горіх|мигдал|фісташ|кунжут|арахіс|каштан|насіння|кеш.ю|піньйон'),
 ('Крупи','🌾',r'крупа|рис\b|просо|сорго|фоніо|теф\b|каньїва|фріке|овес|ячмінь|кіноа|полента|амарант'),
 ('Бобові','🫘',r'квасол|горох|боби|люпин|тарві|сочевиц'),
 ('Гриби','🍄',r'гриб|трюфел'),
 ('Зелень','🌿',r'лист|зелень|пагон|квіт|тархун|орегано|чебрец|базилік|кропив|шісо|чипілін|кулантро|епасоте|калалу|мангольд|лемонграс'),
 ('Овочі','🥕',r'маніок|таро|ямс|картопл|батат|баклажан|гарбуз|моркв|капуст|дайкон|помідор|огір|кактус|томат|салат|окра|чайот|якон|ока\b|молохія'),
 ('Фрукти','🍍',r'ананас|лайм|лимон|апельсин|манго|плід|плоди|ягод|банан|плантан|кокос|цитрус|курага|родзин|фінік|шовков|ягід|виноград|інжир|папая|дуріан|пандан|тамаринд|гуава|гуанабана|грейпфрут|журавл|морошк|чорниц|брусниц|вишн|малина|слив|опунці|агав|акаї|асаї|марула|баобаб|жаботикаба|куандонг|квандонг|лукума|куmutex|каламанс|нектар|фейхоа|айв|джекфрут|купо|купуасу|луло|наранх|юдзу|умебосі|гранат|абрикос|обліпих|ківі|маракуя|каву|акі\b'),
]
def classify(name):
 if norm(name) in OVERRIDES:return OVERRIDES[norm(name)],'🥣'
 for cat,emoji,pattern in RULES:
  if re.search(pattern,name,re.I):return cat,emoji
 return 'Інше','🥣'
def run():
 import argparse
 p=argparse.ArgumentParser();p.add_argument('--apply',action='store_true');a=p.parse_args()
 rows=json.loads((ROOT/'scripts/nutrition/user-country-products.json').read_text(encoding='utf-8'))
 db=sqlite3.connect(ROOT/'backend/dev.db');db.row_factory=sqlite3.Row
 existing={norm(r['name']):dict(r) for r in db.execute('select * from Ingredient')}
 associations_path=ROOT/'scripts/nutrition/country-associations.json'
 associations=json.loads(associations_path.read_text(encoding='utf-8'))
 assoc={x['name']:x for x in associations['entries']};new=[];matches=[]
 for row in rows:
  for label in row['products']:
   canonical=ALIASES.get(norm(label),label)
   found=existing.get(norm(canonical))
   if not found:
    # Only remove an optional generic noun when the entire remaining name matches.
    candidates=[x for key,x in existing.items() if norm(re.sub(r'^(сир|насіння|горіхи|перець)\s+','',x['name'],flags=re.I))==norm(canonical)]
    if len(candidates)==1:found=candidates[0]
   if not found:
    category,emoji=classify(canonical)
    found=dict(id=str(uuid.uuid5(uuid.NAMESPACE_URL,'cookbook-ai/country-product/'+norm(canonical))),name=canonical[0].upper()+canonical[1:],category=category,emoji=emoji)
    new.append(found);existing[norm(canonical)]=found
   entry=assoc.setdefault(found['name'],dict(name=found['name'],countries=[],note='Кулінарний зв’язок із переліку, наданого користувачем; не країна виробництва.',sourceUrls=[],provenance='user-country-products.json'))
   if row['code'] not in entry['countries']:entry['countries'].append(row['code'])
   matches.append(dict(country=row['code'],input=label,ingredient=found['name']))
 print(json.dumps(dict(countries=len(rows),mentions=len(matches),new=len(new),existingMentions=len(matches)-len(new),uncategorized=[x['name'] for x in new if x['category']=='Інше']),ensure_ascii=False))
 if not a.apply:return
 now=datetime.datetime.now(datetime.timezone.utc).isoformat()
 backup=ROOT/'tmp/nutrition/backups'/('pre-country-products-'+datetime.datetime.now().strftime('%Y%m%dT%H%M%S')+'.db')
 with sqlite3.connect(backup) as dst:db.backup(dst)
 from enrich_catalog import groups,aliases,foods
 from taxonomy import country_region,COUNTRIES,apply as apply_taxonomy
 assert all(row['code'] in COUNTRIES for row in rows)
 with db:
  for x in new:
   candidates=[];kind='family'
   extra={'маніок':r'^Cassava,','таро':r'^Taro,','плантан':r'^Plantains,','хлібний плід':r'^Breadfruit,','гуанабан':r'^Soursop,','джекфрут':r'^Jackfruit,','ямс':r'^Yam,','тамаринд':r'^Tamarinds,','пальмова олія':r'^Oil, palm','пальмова олія денде':r'^Oil, palm','саго':r'^Sago','тапіока':r'^Tapioca','серцевина пальми':r'^Palm hearts,','опунці':r'^Prickly pears,','сік цукрової тростини':r'^Sugarcane','гуава':r'^Guavas,','папая':r'^Papayas,','фінік':r'^Dates,','листя таро':r'^Taro leaves,','горох':r'^(Peas,|Pigeon peas,)','пажитник':r'^Spices, fenugreek','мате':r'^Tea,','гуарана':r'guarana','оливки':r'^Olives,','амарант':r'^Amaranth grain,','арорут':r'^Arrowroot flour','фісташ':r'^Nuts, pistachio','арганова олія':r'^Oil, argan','макадам':r'^Nuts, macadamia'}
   for token,pattern in {**extra,**aliases}.items():
    if token in x['name'].lower():
     candidates=[f for f in foods if re.search(pattern,f['name'],re.I)]
     if candidates:break
   if not candidates:
    kind='category';pattern=groups.get(x['category']);candidates=[f for f in foods if pattern and re.search(pattern,f['name'],re.I)]
   envelope=None
   direct=next((f for f in foods if x['name'].lower()=='фініки деглет нур' and f['name']=='Dates, deglet noor'),None)
   if candidates:
    envelope={k:dict(min=min(f['nutrients'][k] for f in candidates),max=max(f['nutrients'][k] for f in candidates)) for k in ['kcal','protein','fat','carbs']}
    envelope.update(kind=kind,sampleCount=len(candidates),source='USDA SR Legacy 2018',sourceUrl='https://fdc.nal.usda.gov/download-datasets/',sourceIds=[f['id'] for f in candidates],note='Довідковий діапазон '+('споріднених продуктів' if kind=='family' else 'широкої харчової категорії, НЕ конкретного продукту')+'. Потрібна етикетка або точний склад; не використовується як точне КБЖВ рецепта.')
   db.execute('INSERT OR IGNORE INTO Category(name) VALUES (?)',(x['category'],))
   db.execute('INSERT INTO Ingredient(id,name,category,emoji,nutritionStatus,nutritionNote,nutritionRange,nutritionUpdatedAt) VALUES (?,?,?,?,?,?,?,?)',(x['id'],x['name'],x['category'],x['emoji'],'needs_review','Потрібні склад, стан приготування або етикетка конкретного продукту. Довідкові аналоги не є його точними показниками.',json.dumps(envelope,ensure_ascii=False) if envelope else None,now))
   if direct:
    n=direct['nutrients'];db.execute('UPDATE Ingredient SET nutritionStatus=?,caloriesPer100g=?,proteinPer100g=?,fatPer100g=?,carbsPer100g=?,nutritionSource=?,nutritionSourceUrl=?,nutritionSourceFood=?,nutritionNote=?,nutritionRange=NULL WHERE id=?',('verified',n['kcal'],n['protein'],n['fat'],n['carbs'],'USDA SR Legacy 2018','https://fdc.nal.usda.gov/food-details/'+direct['id']+'/nutrients',direct['name'],'Прямий запис USDA на 100 г їстівної частини.',x['id']))
  for name,entry in assoc.items():
   stored=db.execute('SELECT culinaryCountries,culinaryRegions,category FROM Ingredient WHERE name=?',(name,)).fetchone()
   if not stored:continue
   countries=list(dict.fromkeys(json.loads(stored['culinaryCountries'])+entry['countries']))
   regions=list(dict.fromkeys([v for v in json.loads(stored['culinaryRegions']) if v!='Універсальні']+[country_region(code) for code in countries]));regions=[v for v in regions if v] or ['Універсальні']
   db.execute('UPDATE Ingredient SET culinaryCountries=?,culinaryRegions=?,categoryTags=CASE WHEN categoryTags=\'[]\' THEN ? ELSE categoryTags END WHERE name=?',(json.dumps(countries),json.dumps(regions,ensure_ascii=False),json.dumps([stored['category']],ensure_ascii=False),name))
  apply_taxonomy(db)
 associations['entries']=list(assoc.values());associations_path.write_text(json.dumps(associations,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 (ROOT/'scripts/nutrition/user-product-matches.json').write_text(json.dumps(matches,ensure_ascii=False,indent=2),encoding='utf-8')
 print('Backup:',backup)
 if new:(ROOT/'scripts/nutrition/user-products-added.json').write_text(json.dumps(new,ensure_ascii=False,indent=2),encoding='utf-8')
 print('Ranges:',db.execute("select count(*) from Ingredient where id in ("+','.join('?' for _ in new)+") and nutritionRange is not null",[x['id'] for x in new]).fetchone()[0])
if __name__=='__main__':run()
