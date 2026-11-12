"""Render 250 original recipes against the existing ingredient catalog (no DB writes)."""
import collections,copy,json,sqlite3,uuid
from pathlib import Path
from cooking_plans import PLANS,ALIASES
ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
MEALS={'BREAKFAST':'Сніданок','LUNCH':'Обід','DINNER':'Вечеря','SNACK':'Перекус','DESSERT':'Десерт'}
FLOORS={'CAKE':80,'BROWNIE':90,'MUFFIN':50,'COOKIE':40,'COCONUT_COOKIE':40,'SHORTBREAD':60,'CRUMBLE':60,'GELATIN':300,'FROZEN':400,'SORBET':420,'COFFEE_PARFAIT':180,'ENERGY':40,'BAKED_BAR':75,'FRUIT_BAKE':40,'CASSEROLE':55,'CASSEROLE_SWEET':55,'CHEESECAKE':420}
def plan(key):
 base=key
 while base in ALIASES:base=ALIASES[base]
 return copy.deepcopy(PLANS[base])

def customized(key,title,ingredients):
 desc,steps=plan(key)
 prefix=[]
 if key in ['TOAST_EGG','SALAD_EGG','WARM_SALAD']:
  prefix.append(('Зваріть яйця','10–12 хв','Яйця залийте технічною водою, доведіть до кипіння та варіть 10 хвилин. Охолодіть у холодній воді, очистіть і наріжте. У переліку вказана маса їстівної частини без шкаралупи.'))
 if key in ['SALAD_CHICKEN','WRAP_CHICKEN','PASTA_CHICKEN','NOODLES_CHICKEN']:
  prefix.append(('Приготуйте птицю','10–12 хв','Куряче філе наріжте однаковими невеликими шматочками. На частині зазначеної олії обсмажте до повної готовності, перевіривши 74 °C усередині найбільшого шматочка. Тимчасово перекладіть на чисту тарілку. Далі використайте решту олії, не додаючи понад перелік.'))
 if key=='SALAD_FISH':
  prefix.append(('Запечіть рибу','18–22 хв','Розігрійте духовку до 190 °C. Рибу без кісток змастіть частиною зазначеної олії й запечіть до 63 °C усередині найтовстішої частини. Трохи остудіть і розділіть на шматочки.'))
 if key=='NOODLES_SHRIMP':
  prefix.append(('Приготуйте креветки','5–7 хв','Креветки очистіть та обсушіть. На частині олії обсмажте до непрозорої середини, орієнтир — 63 °C. Тимчасово відкладіть і поверніть у локшину наприкінці.'))
 if key=='FISH_GRAIN':
  prefix.append(('Зваріть булгур','18–20 хв','Промийте булгур, залийте всією зазначеною водою й готуйте під кришкою на слабкому вогні до м’якості. Залиште під кришкою на 5 хвилин. Рибу готуйте паралельно; до булгуру вмішайте частину олії та петрушку.'))
 if key=='WARM_SALAD':
  prefix.append(('Прогрійте основу','5 хв','Уже варені картоплю та стручкову квасолю прогрійте на парі або у мікрохвильовій печі. Картоплю заправляйте теплою; яйця додавайте в останню чергу.'))
 if key=='WRAP_EGG':
  prefix.append(('Зробіть омлет','6–8 хв','Яйця розмішайте. На зазначеній олії приготуйте тонкий омлет до повного схоплювання, орієнтир — 71 °C. Трохи остудіть і наріжте смужками.'))
 if key=='WRAP_HOT':
  steps.append(('Підрум’яньте рулети','5–6 хв','На частині зазначеної олії обсмажте готові рулети по 2–3 хвилини з кожного боку до розплавлення сиру. Кладіть швом донизу й не додавайте зайвої олії.'))
 if key=='OMELET_ROLL':
  steps=[('Зробіть тонкий омлет','10–12 хв','Шпинат коротко припустіть на частині олії. Яйця збийте з молоком і сіллю, додайте шпинат. На решті олії приготуйте 2 тонкі омлети до повного схоплювання середини й температури не менше 71 °C.'),('Сформуйте рулети','5 хв','Кріп подрібніть і змішайте з вершковим сиром. Злегка остуджені омлети тонко змастіть начинкою, щільно згорніть та наріжте навскіс.')]
 if key=='SOUP_CHICKEN':
  steps=[('Приготуйте курячу основу','18–22 хв','Курку без кісток наріжте невеликими шматочками. Залийте зазначеною водою, доведіть до слабкого кипіння, зніміть піну. Додайте нарізані овочі, імбир і гриби, якщо вони є у складі. Варіть до повної готовності курки, орієнтир — 74 °C.'),('Завершіть суп','5–8 хв','Додайте кокосове молоко або локшину, якщо вони є у складі. Вермішель варіть за часом на упаковці, кокосове молоко лише прогрійте. Зелень, рибний соус та сік лайма додавайте наприкінці. Для прозорого супу достатньо зазначеної солі.')]
 if key=='SOUP_FISH':
  steps.append(('Додайте рибу','8–10 хв','До вже м’яких овочів покладіть філе без кісток невеликими шматочками. Варіть при слабкому кипінні до 63 °C у центрі риби; не перемішуйте надто інтенсивно.'))
 if key=='STEW_CHICKEN':
  prefix.append(('Обсмажте курку','8–10 хв','На частині зазначеної олії підрум’яньте невеликі шматочки філе. Відкладіть, приготуйте овочеву основу на решті олії. Поверніть курку разом із томатами й тушкуйте до 74 °C у центрі шматочка.'))
 if key=='STEW_PORK':
  prefix.append(('Підрум’яньте м’ясо','8–10 хв','Вирізку наріжте поперек волокон скибками до 1 см. На частині зазначеної олії підрум’яньте з обох боків. Тимчасово перекладіть на тарілку й поверніть у соус на етапі тушкування. Цілі шматки свинини доведіть щонайменше до 63 °C та залиште відпочити не менше 3 хвилин.'))
  steps=[('Підготуйте соус','8 хв','На решті зазначеної олії припустіть цибулю та гриби, якщо вони є. Додайте воду й гірчицю за наявності, поверніть м’ясо.'),('Протушкуйте','20–25 хв','Готуйте на слабкому вогні до м’якості. Яблука додавайте на останні 10 хвилин; сметану — наприкінці, не доводячи соус до бурхливого кипіння.')]
 if key=='STEW_BEEF':
  steps=[('Обсмажте основу','15 хв','Яловичину наріжте кубиками по 2 см. На олії підрум’яньте невеликими порціями. Додайте цибулю, моркву й томатну пасту, прогрійте ще 3 хвилини.'),('Повільно протушкуйте','90–100 хв','Влийте зазначену гарячу воду, додайте лавровий лист і сіль. Тушкуйте під кришкою при мінімальному кипінні до повної м’якості яловичини. За потреби підливайте технічну гарячу воду. Лавровий лист видаліть перед подачею.')]
 if key=='STIR_BEEF':
  desc='Тонко нарізана яловичина з пружними овочами та насиченим соусом.'
  steps=[('Обсмажте яловичину','7–10 хв','М’ясо наріжте тонко поперек волокон. На частині олії обсмажуйте невеликими порціями до готовності, орієнтир — 71 °C. Перекладіть на чисту тарілку.'),('Зробіть соус','7–10 хв','Броколі бланшуйте 3 хвилини й відцідіть. На решті олії коротко прогрійте імбир та часник, додайте броколі й м’ясо. Крохмаль розведіть у холодній зазначеній воді, змішайте із соєвим соусом та влийте до страви. Прогрійте до загущення.')]
 if key=='PATTIES_BEEF':
  steps=[(h,t,text.replace('для фаршу з птиці','для яловичого фаршу').replace('74 °C','71 °C')) for h,t,text in steps]
 if key in ['PASTA_CHICKEN','NOODLES_CHICKEN']:
  steps[-1]=(steps[-1][0],steps[-1][1],steps[-1][2]+' Приготовлену курку поверніть у страву на останні 2 хвилини.')
 if key=='FRUIT_SALAD':
  desc='Соковиті фруктові шматочки з освіжальною цитрусовою заправкою.'
 if 'песто' in title.lower() and key=='PASTA':
  prefix.append(('Запечіть томати','20 хв','Поки закипає вода для пасти, запечіть половинки чері на зазначеній олії при 200 °C. Песто не смажте: вмішайте його вже після вимкнення нагріву.'))
 return desc,prefix+steps

def main():
 db=sqlite3.connect(ROOT/'backend/dev.db');db.row_factory=sqlite3.Row
 catalog={r['name']:dict(r) for r in db.execute('SELECT * FROM Ingredient')}
 original=db.execute("SELECT * FROM Recipe WHERE title=?",('Які Данґо (Yaki Dango)',)).fetchone()
 assert original,'Reference recipe missing'
 author=db.execute('SELECT * FROM User WHERE id=?',(original['authorId'],)).fetchone()
 assert author and author['role']=='MODERATOR','Official recipes require moderator authorship'
 rows=[];meal=None
 for line in (HERE/'official-recipes.txt').read_text(encoding='utf-8-sig').splitlines():
  if not line:continue
  if line.startswith('['):meal=line[1:-1];continue
  title,key,minutes,items,note=line.split('|');grams=[(x.rsplit('=',1)[0],float(x.rsplit('=',1)[1])) for x in items.split(';')]
  assert len(set(n for n,q in grams))==len(grams),title
  for n,q in grams:
   assert n in catalog,(title,n)
   assert q>0,(title,n,q)
  ingredients=[dict(ingredientId=catalog[n]['id'],name=n,quantity=q,unit='г',optional=False) for n,q in grams]
  desc,steps=customized(key,title,ingredients)
  flavors=[];names={n for n,q in grams}
  if names&{'Лимон','Лайм','Апельсин'}:flavors.append('Цитрусові додають свіжий аромат і легку кислинку.')
  elif names&{'Кориця','Кардамон','Імбир свіжий'}:flavors.append('Прянощі створюють теплий, виразний аромат.')
  elif names&{'Волоський горіх','Мигдаль','Арахіс','Насіння кунжуту'}:flavors.append('Горіхи або насіння додають приємний текстурний акцент.')
  elif names&{'Базилік','Петрушка','Кріп','Кінза','М\'ята'}:flavors.append('Свіжа зелень робить смак виразнішим.')
  elif names&{'Помідор','Помідори чері','Томатна паста'}:flavors.append('Томати дають соковитість і м’яку кислинку.')
  elif names&{'Какао-порошок','Шоколад чорний'}:flavors.append('Какао додає глибокий шоколадний аромат.')
  description=desc+' '+''.join(flavors)
  servings=4 if meal=='DESSERT' or key.startswith('SOUP') or key in ['CREAM_SOUP','MISO','STEW_BEEF','MEATLOAF','CASSEROLE','CASSEROLE_SWEET','BAKED_OATS'] else 2
  if meal=='SNACK':servings=2 if key in ['SMOOTHIE','YOGURT','FRUIT_SALAD','SALAD'] else 4
  if meal=='DESSERT' and key in ['CAKE','MUFFIN','COOKIE','COCONUT_COOKIE','SHORTBREAD','BROWNIE']:servings=8
  if key in ['BAR','BAKED_BAR','ROAST_NUTS']:servings=8
  if key=='CHEESECAKE':servings=8
  portion_word='порції' if servings in [2,3,4] else 'порцій'
  first='Відміряйте всі продукти на '+str(servings)+' '+portion_word+'. Овочі, фрукти та зелень помийте й обсушіть; підготуйте потрібний посуд. '+note
  instructions=[('Підготовка','5–10 хв',first)]+steps
  end='Розподіліть страву на '+str(servings)+' '+portion_word+'. '
  if key in ['GELATIN','CHIA','PARFAIT','YOGURT','OVERNIGHT','COFFEE_PARFAIT','SORBET','FROZEN','SMOOTHIE','AGAR','CHOC_LOG','CHEESECAKE']:end+='Подавайте охолодженою.'
  elif key in ['COOKIE','COCONUT_COOKIE','SHORTBREAD','CAKE','MUFFIN','BROWNIE','BAR','BAKED_BAR','CRACKER','ROAST_NUTS']:end+='Нарізайте або перекладайте після охолодження, щоб зберегти форму.'
  else:end+='Подавайте одразу після завершення приготування.'
  instructions.append(('Подача','2 хв',end))
  rendered='\n\n'.join(str(i)+'. **'+h+' — '+t+'**\n\n   '+txt for i,(h,t,txt) in enumerate(instructions,1))
  rendered+='\n\n> Кількості вказані для їстівної частини продуктів. Якщо у назві інгредієнта зазначено «варений» або «приготовлений», зважуйте його вже готовим; інші крупи та суху пасту — до варіння. Вода для промивання й відварювання зі зливанням є технічною.'
  if any(t in rendered for t in ['71 °C','74 °C','63 °C']):rendered+='\n\n[Орієнтири готовності м’яса, риби та яєць](https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures). '
  emoji='🍰' if meal=='DESSERT' else '🥣' if key in ['PORRIDGE','GRAIN','CORN','CREAM_SOUP','MISO'] or key.startswith('SOUP') else '🥗' if 'SALAD' in key or key in ['ROAST_BOWL','YOGURT'] else '🍳' if key in ['OMELET','SHAKSHUKA','FRITTATA','SCRAMBLE','HASH','OMELET_ROLL'] else '🍝' if key.startswith(('PASTA','NOODLES')) else '🐟' if key in ['BAKE_FISH','FISH_GRAIN','SHRIMP','MUSSELS'] else '🍗' if 'CHICKEN' in key or key=='PILAF' else '🥪' if key in ['TOAST','TOAST_EGG','BAKED_TOAST','CROSTINI'] or key.startswith('WRAP') else '🍪' if key in ['COOKIE','CRACKER','SHORTBREAD','COCONUT_COOKIE'] else '🍽️'
  if meal=='DESSERT' and key in ['COOKIE','COCONUT_COOKIE','SHORTBREAD']:emoji='🍪'
  if key in ['FROZEN','SORBET']:emoji='🍨'
  if key=='SMOOTHIE':emoji='🥤'
  icon_overrides={'PUDDING':'🍮','RICE_PUDDING':'🍚','SEMOLINA':'🍮','GELATIN':'🍮','CHIA':'🥣','CRUMBLE':'🥧','BROWNIE':'🍫','CHEESECAKE':'🍰','FRUIT_PAN':'🍍','PARFAIT':'🍨','COFFEE_PARFAIT':'☕','ENERGY':'🍫','CHOC_LOG':'🍫','BAR':'🍫','BAKED_BAR':'🍪','ROAST_NUTS':'🥜','COUSCOUS':'🥣','COUSCOUS_SAVORY':'🥣','GRAIN':'🍚','GRAIN_SAVORY':'🍚','PILAF':'🍚','FRIED_RICE':'🍚','FRIED_RICE_SHRIMP':'🍤','RISOTTO':'🍚','SPREAD':'🫘','SPREAD_COARSE':'🥑','SHRIMP':'🍤','MUSSELS':'🦪','RICE_ROLL':'🥬','RICE_ROLL_SHRIMP':'🍤','ONIGIRI':'🍙','TOFU':'🥢','PANCAKE':'🥞','FRITTER_SWEET':'🥞','CREPE':'🥞','COTTAGE':'🥞','CORN':'🌽','CORN_SAVORY':'🌽','STUFFED':'🫑','STUFFED_VEG':'🍅','STUFFED_POTATO':'🍠','STUFFED_MUSHROOM':'🍄','MUSHROOM_PUREE':'🍄','VEG_SNACK':'🥒','POTATO_BAKE':'🥔','POTATO_WEDGES':'🥔','CURRY':'🍛','LENTIL_CURRY':'🍛','STEW':'🍲','STEW_CHICKEN':'🍲','STEW_PORK':'🍲','STEW_BEEF':'🍲','MEATBALL':'🧆','FALAFEL':'🧆','SOUP':'🍲','SOUP_CHICKEN':'🍲','SOUP_FISH':'🍲'}
  emoji=icon_overrides.get(key,emoji)
  if key=='FRUIT_BAKE':emoji={'Груша':'🍐','Яблуко':'🍎','Банан':'🍌','Слива':'🍑'}.get(ingredients[0]['name'],'🍎')

  row=dict(id=str(uuid.uuid5(uuid.NAMESPACE_URL,'cookbook-ai/official-collection-2026/'+meal+'/'+title)),title=title,description=description,instructions=rendered,emoji=emoji,imageUrl=None,preparationMinutes=max(int(minutes),FLOORS.get(key,0)),servings=servings,difficulty='MEDIUM' if key in ['RISOTTO','CHEESECAKE','MEATLOAF','STUFFED','LASAGNA','RICE_ROLL','RICE_ROLL_SHRIMP','ONIGIRI'] else 'EASY',nutritionAuto=True,mealType=meal,isShared=False,isPublished=True,authorId=author['id'],ingredients=ingredients)
  assert len(title)<=160 and len(rendered)<=20000 and len(description)<=2000
  rows.append(row)
 counts=collections.Counter(r['mealType'] for r in rows)
 assert counts=={m:50 for m in MEALS},counts
 assert len({r['title'].casefold() for r in rows})==250
 assert len({tuple(sorted((i['name'],i['quantity']) for i in r['ingredients'])) for r in rows})==250,'Duplicate ingredient compositions'
 assert original['id'] not in {r['id'] for r in rows}
 (HERE/'official-recipes.json').write_text(json.dumps(dict(schemaVersion=1,referenceRecipe=original['title'],temperatureSource='https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures',recipes=rows),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps(dict(recipes=len(rows),counts=dict(counts),ingredients=len({i['name'] for r in rows for i in r['ingredients']}),instructionsMin=min(len(r['instructions']) for r in rows)),ensure_ascii=False))
if __name__=='__main__':main()
