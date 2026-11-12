"""Food types and culinary geography are separate, repeatable catalog annotations."""
import json,re
from pathlib import Path

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
GEOGRAPHIC=re.compile(r'азі[йя]|європ|африк|америк|океан|австрал|антаркт|середземномор|регіон|країн|япон|китай|корей|індій|тайськ|україн|італій|француз|мексик|кавказ|близько[ -]?схід|східно[ -]?азі',re.I)

def read(name):return json.loads((HERE/name).read_text(encoding='utf-8'))
CORRECTIONS=read('food-category-corrections.json')
ASSOCIATIONS={entry['name']:entry['countries'] for entry in read('country-associations.json')['entries']}
COUNTRIES={entry['code']:entry for entry in json.loads((ROOT/'frontend/src/data/countries.json').read_text(encoding='utf-8'))}

def country_region(code):
 country=COUNTRIES[code]
 if country['region']=='Americas':return 'Північна Америка' if country['subregion']=='North America' and code!='MX' else 'Латинська Америка'
 return {'Europe':'Європа','Asia':'Азія','Africa':'Африка','Oceania':'Океанія','Antarctic':'Антарктида'}.get(country['region'])

def array(value):
 if isinstance(value,str):value=json.loads(value)
 return value if isinstance(value,list) else []

def annotate(row):
 row=dict(row);name=row['name'];old_category=row['category']
 category=CORRECTIONS.get(name,old_category)
 if GEOGRAPHIC.search(category):category='Інше'
 tags=[category]+[v for v in array(row.get('categoryTags')) if isinstance(v,str) and not GEOGRAPHIC.search(v) and v!=old_category]
 if category in ['Фрукти','Ягоди','Овочі','Зелень','Гриби','Бобові','Крупи','Горіхи та насіння','Олії','Сухофрукти','Борошно та крохмаль','Рослинні альтернативи','Проростки','Харчові водорості']:tags.append('Рослинні продукти')
 if category in ["М'ясо","М'ясні вироби",'Субпродукти','Риба та морепродукти','Молочні продукти','Яйця','Їстівні комахи']:tags.append('Тваринні продукти')
 countries=list(dict.fromkeys(ASSOCIATIONS.get(name,[])+array(row.get('culinaryCountries'))))
 if any(code not in COUNTRIES for code in countries):raise ValueError('Invalid country code: '+name)
 regions=[v for v in array(row.get('culinaryRegions')) if isinstance(v,str) and v!='Універсальні']
 for code in countries:
  region=country_region(code)
  if region:regions.append(region)
 return dict(category=category,categoryTags=list(dict.fromkeys(tags)),culinaryRegions=list(dict.fromkeys(regions)) or ['Універсальні'],culinaryCountries=countries)

def apply(db):
 """Use the caller's transaction; nutrient fields and linked data are untouched."""
 for row in db.execute('SELECT * FROM Ingredient').fetchall():
  data=annotate(row)
  db.execute('INSERT OR IGNORE INTO Category(name) VALUES (?)',(data['category'],))
  db.execute('UPDATE Ingredient SET category=?,categoryTags=?,culinaryRegions=?,culinaryCountries=? WHERE id=?',(data['category'],json.dumps(data['categoryTags'],ensure_ascii=False),json.dumps(data['culinaryRegions'],ensure_ascii=False),json.dumps(data['culinaryCountries']),row['id']))
 for row in db.execute('SELECT name FROM Category').fetchall():
  if GEOGRAPHIC.search(row['name']):db.execute('DELETE FROM Category WHERE name=?',(row['name'],))
