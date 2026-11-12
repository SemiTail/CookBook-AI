"""Derive searchable tags and reference envelopes without replacing exact nutrients."""
import json,sqlite3,datetime,re
from pathlib import Path
from taxonomy import annotate,apply as apply_taxonomy
ROOT=Path(__file__).resolve().parents[2]
foods=json.loads((ROOT/'tmp/nutrition/usda-foods.json').read_text(encoding='utf-8'))
# Source groups, not invented nutrient numbers. Family matches override the wider group.
groups={
 'Харчові водорості':r'^Seaweed,',
 'Тісто та обгортки':r'(Wonton wrappers|Dough|Rice paper)',
 'Заморожені продукти':r'frozen',
 'Консерви':r'canned',
 'Мариновані та ферментовані продукти':r'(pickled|sauerkraut|kimchi|fermented)',
 'Сухофрукти':r'^(Apples, dried|Pears, dried|Apricots, dried|Figs, dried|Raisins,|Dates,|Plums, dried|Bananas, dehydrated|Cranberries, dried)',
 'Молочні продукти':r'^(Milk,|Cheese,|Cream,|Yogurt,|Kefir,|Butter)',
 'Алкогольні напої':r'^Alcoholic beverage',
 'Спеції':r'^Spices,', 'Олії':r'^(Oil,|Fat,|Lard)',
 'Борошно та крохмаль':r'(flour|starch)', 'Бобові':r'^(Beans,|Peas,|Lentils,|Chickpeas|Soybeans|Mung beans|Lupins|Broadbeans)',
 'Горіхи та насіння':r'^(Nuts,|Seeds,|Peanuts,)', 'Гриби':r'^Mushrooms,',
 'Крупи':r'^(Rice,|Buckwheat|Millet|Bulgur|Couscous|Amaranth grain|Quinoa|Barley|Oats|Wheat|Spelt|Teff|Wild rice)',
 'Риба та морепродукти':r'^(Fish,|Mollusks,|Crustaceans,)',
 "М'ясо":r'^(Beef,|Pork,|Chicken,|Turkey,|Lamb,|Veal,|Duck,|Goose,|Game meat,)',
 "М'ясні вироби":r'(Sausage|Bologna|Salami|Ham,|Bacon|Pate)',
 'Соуси та заправки':r'(Sauce,|Salad dressing|Mustard|Vinegar|Catsup|Horseradish)',
 'Підсолоджувачі':r'^(Sugars,|Syrups,|Sweeteners,|Honey|Molasses)',
 'Хліб та випічка':r'^(Bread,|Rolls,|Bagels,|Croissants,|Tortillas,|Crackers,)',
 'Макаронні вироби':r'^(Pasta,|Noodles,|Macaroni,|Spaghetti,|Rice noodles,)',
 'Напої':r'^(Beverages,|Coffee,|Tea,)', 'Рослинні альтернативи':r'(Soymilk|soy milk|Tofu|Tempeh|Seitan|Almond milk|rice milk|coconut milk)',
 'Кондитерські інгредієнти':r'^(Candies,|Chocolate,|Cocoa,|Baking chocolate|Leavening agents|Gelatins,|Candied fruit|Cookies,)',
 'Фрукти':r'^(Apples,|Pears,|Peaches,|Apricots,|Bananas,|Mangos,|Papayas,|Plums,|Nectarines,|Oranges,|Lemons,|Limes,|Figs,|Dates,|Pineapple,)',
 'Ягоди':r'^(Blueberries,|Raspberries,|Strawberries,|Blackberries,|Currants,|Cranberries,|Cherries,|Gooseberries,|Mulberries,)',
 'Овочі':r'^(Cabbage,|Carrots,|Potatoes,|Tomatoes,|Onions,|Peppers,|Beets,|Broccoli,|Cauliflower,|Squash,|Eggplant,|Pumpkin,)',
 'Зелень':r'^(Lettuce,|Parsley,|Spinach,|Arugula,|Chard,|Coriander|Basil,|Dill weed|Chives,|Mint,)',
 'Яйця':r'^Egg,',
}
aliases={
 'молоко':r'^Milk,.*fluid','вершки':r'^Cream,','сметана':r'^Cream, sour','йогурт':r'^Yogurt,','кефір':r'^Kefir,','сир':r'^Cheese,',
 'морозиво':r'^Ice creams,','кокос':r'coconut','мигдал':r'almond','рисов':r'rice','соєв':r'soy','вівсян':r'oat',
 'масло вершкове':r'^Butter,','пиво':r'^Alcoholic beverage, beer','вино':r'^Alcoholic beverage, wine','горілка':r'^Alcoholic beverage, distilled',
 'сочевиц':r'^Lentils,','квасол':r'^(Beans,|Lima beans,)','горох':r'^Peas,','нут':r'^Chickpeas','борошно':r'flour','крохмаль':r'starch',
 'гриб':r'^Mushrooms,','маслюк':r'^Mushrooms,','опень':r'^Mushrooms,','трюф':r'^Mushrooms,',
 'майонез':r'mayonnaise','гірчиц':r'^Mustard,','оцет':r'^Vinegar','томат':r'^(Tomatoes,|Tomato products,|Sauce, tomato)',
 'песто':r'pesto','бешамель':r'white.*sauce','шоколад':r'^(Chocolate,|Candies,.*chocolate|Cocoa,)',
 'цукор':r'^Sugars,','сироп':r'^Syrups,','стеві':r'stevia','еритрит':r'erythrit','пектин':r'pectin','желатин':r'^Gelatins,','ваніл':r'vanilla',
 'фінік':r'^Dates,','родзин':r'^Raisins,','курага':r'^Apricots, dried','журавлин':r'^Cranberries,','ягід':r'^(Blueberries|Raspberries|Strawberries|Blackberries)',
 'полуниц':r'^Strawberries,','вишн':r'^Cherries, sour','малин':r'^Raspberries,','салат':r'^Lettuce,',
 'часник':r'garlic','цибул':r'^Onions,','перець':r'^(Peppers,|Spices, pepper)','паприка':r'^Spices, paprika','імбир':r'ginger','куркум':r'turmeric',
 'куря':r'^Chicken,','курят':r'^Chicken,','індич':r'^Turkey,','ялович':r'^Beef,','свин':r'^Pork,','баран':r'^Lamb,','ягня':r'^Lamb,','качк':r'^Duck,','гуск':r'^Goose,',
 'лосос':r'^Fish, salmon','сьомг':r'^Fish, salmon','форел':r'^Fish, trout','кревет':r'^Crustaceans, shrimp','кальмар':r'^Mollusks, squid','мід':r'^Mollusks, mussel','тун':r'^Fish, tuna',
 'оселед':r'^Fish, herring','скумбр':r'^Fish, mackerel','тріск':r'^Fish, cod','сібас':r'^Fish, sea bass','ікра':r'caviar','устриц':r'^Mollusks, oyster',
 'кава':r'^(Coffee,|Beverages, coffee)','чай':r'^(Tea,|Beverages, tea)','сік':r'juice','квас':r'kvass','вода':r'water',
}
regions={
 'Азія':r'(норі|вакаме|комбу|дасі|місо|тофу|темпе|соєв|васабі|кочуджан|самджан|том ям|шиїтаке|енокі|муер|ерінг|локшина (соба|сомен)|саке|мірін|шаосін|едамаме|кімчі|хойсин|теріякі|шрірача)',
 'Європа':r'(пармезан|моцарел|фета|брі|камамбер|гауда|чедер|ементаль|песто|паста|багет|круасан|чіабат|фокач|спельт|греч|сметан|кефір|ряжанк|бринз|сулугун)',
 'Африка':r'(кускус|сорго|теф|бамія|окра|фоніо|харіса|бербере)',
 'Північна Америка':r'(пекан|кленов|бурбон|барбекю|ранч|дикий рис)',
 'Латинська Америка':r'(кіноа|амарант|тортиль|халапеньйо|текіла|чіа|авокадо|батат|маракуя|какао)',
 'Океанія':r'(макадам|ківі)',
}
def main():
 db=sqlite3.connect(ROOT/'backend/dev.db');db.row_factory=sqlite3.Row
 backup=ROOT/'tmp/nutrition/backups'/('pre-enrichment-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'.db')
 with sqlite3.connect(backup) as dst:db.backup(dst)
 counts={'familyRanges':0,'categoryRanges':0,'noRange':0}
 with db:
  for row in db.execute('SELECT * FROM Ingredient').fetchall():
   name=row['name'];low=name.casefold();taxonomy=annotate(row);cat=taxonomy['category'];tags=taxonomy['categoryTags']
   if cat in ['Фрукти','Ягоди','Овочі','Зелень','Гриби','Бобові','Крупи','Горіхи та насіння','Олії','Сухофрукти','Борошно та крохмаль','Рослинні альтернативи','Проростки']:tags.append('Рослинні продукти')
   if cat in ["М'ясо","М'ясні вироби",'Субпродукти','Риба та морепродукти','Молочні продукти','Яйця']:tags.append('Тваринні продукти')
   for pattern,tag in [(r'сир(ий|а|і|е)\b','Сирі'),(r'варен|відварен','Варені'),(r'сушен|сух(ий|і|е)\b','Сушені'),(r'заморож','Заморожені'),(r'консерв','Консервовані'),(r'маринов|квашен|фермент|кімчі','Ферментовані та мариновані'),(r'борошно|крохмаль','Борошно та крохмаль'),(r'олія|масло|жир','Жири та олії')]:
    if re.search(pattern,low):tags.append(tag)
   reg=list(dict.fromkeys([r for r in taxonomy['culinaryRegions'] if r!='Універсальні']+[r for r,pattern in regions.items() if re.search(pattern,low)])) or ['Універсальні']
   envelope=None
   if row['nutritionStatus'] not in ('verified','not_food'):
    candidates=[];kind='family'
    for token,pattern in aliases.items():
     if token in low:
      candidates=[f for f in foods if re.search(pattern,f['name'],re.I)]
      if candidates:break
    if not candidates:
     kind='category';pattern=groups.get(cat)
     candidates=[f for f in foods if pattern and re.search(pattern,f['name'],re.I)]
    if candidates:
     n={k:{'min':min(f['nutrients'][k] for f in candidates),'max':max(f['nutrients'][k] for f in candidates)} for k in ['kcal','protein','fat','carbs']}
     envelope=dict(**n,kind=kind,sampleCount=len(candidates),source='USDA SR Legacy 2018',sourceUrl='https://fdc.nal.usda.gov/download-datasets/',sourceIds=[f['id'] for f in candidates],note='Мінімум–максимум довідникових варіантів '+('спорідненого продукту.' if kind=='family' else 'широкої категорії; це НЕ діапазон конкретного продукту.')+' Не лабораторні межі й не точні значення для рецепта.')
     counts['familyRanges' if kind=='family' else 'categoryRanges']+=1
    else:counts['noRange']+=1
   db.execute('UPDATE Ingredient SET category=?,categoryTags=?,culinaryRegions=?,culinaryCountries=?,nutritionRange=? WHERE id=?',(cat,json.dumps(list(dict.fromkeys(tags)),ensure_ascii=False),json.dumps(reg,ensure_ascii=False),json.dumps(taxonomy['culinaryCountries']),json.dumps(envelope,ensure_ascii=False) if envelope else None,row['id']))
  apply_taxonomy(db)
 print(json.dumps(counts));print('Backup',backup)
if __name__=='__main__':main()
