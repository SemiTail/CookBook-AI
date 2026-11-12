"""Compile reviewed direct matches from the original USDA download; no fuzzy import."""
import csv,json,math,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
WORK=ROOT/'tmp/nutrition'
def load(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def validate(n):
 if set(n)!={'kcal','protein','fat','carbs'}:raise ValueError('Missing nutrients')
 for k,v in n.items():
  if not isinstance(v,(int,float)) or not math.isfinite(v) or not 0<=v<=(1000 if k=='kcal' else 100):raise ValueError(f'Invalid {k}: {v}')
 if n['protein']+n['fat']+n['carbs']>101:raise ValueError('Nutrients exceed food mass')
def main():
 foods={str(r['id']):r for r in load(WORK/'usda-foods.json')}
 original=load(WORK/'ingredients-original.json')
 matches=[r for i in range(3) for r in load(HERE/f'matches-{i}.json')]
 byid={r['ingredientId']:r for r in matches}
 if len(matches)!=len(byid) or set(byid)!={r['id'] for r in original}:raise ValueError('Every ingredient must be reviewed exactly once')
 def source(fid):
  f=foods[str(fid)];validate(f['nutrients'])
  return dict(nutrients=f['nutrients'],fdcId=str(fid),source='USDA FoodData Central / SR Legacy 2018',sourceUrl=f'https://fdc.nal.usda.gov/food-details/{fid}/nutrients',sourceFood=f['name'])
 entries=[];review=[]
 for old in original:
  m=byid[old['id']]
  if m['name']!=old['name']:raise ValueError('Changed name')
  row=dict(ingredientId=old['id'],name=old['name'],note=m.get('note',''))
  if m['status']=='matched' and m.get('fdcId'):row.update(status='verified',**source(m['fdcId']))
  elif m['status']=='matched' and m.get('nutrients') and m.get('sourceUrl'):
   validate(m['nutrients']);row.update(status='verified',nutrients=m['nutrients'],source=m['sourceName'],sourceUrl=m['sourceUrl'],sourceFood=m.get('sourceFood',old['name']))
  else:
   row['status']='not_food' if m['status']=='not_food' else 'needs_review'
   review.append(dict(name=old['name'],category=old['category'],status=row['status'],reason=row['note']))
  entries.append(row)
 names={r['name'].casefold().strip() for r in original}
 with (HERE/'expansion.tsv').open(encoding='utf-8-sig') as f:
  for x in csv.DictReader(f,delimiter='\t'):
   if x['name'].casefold().strip() in names:continue
   names.add(x['name'].casefold().strip())
   entries.append(dict(name=x['name'],category=x['category'],emoji=x['emoji'],status='verified',note='Прямий запис USDA. Стан зазначено в назві; на 100 г їстівної частини. Вуглеводи включають клітковину.',**source(x['fdcId'])))
 (HERE/'catalog.json').write_text(json.dumps(dict(schemaVersion=1,sourceDataset='https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip',sourceSha256=hashlib.sha256((WORK/'usda-sr-legacy.zip').read_bytes()).hexdigest(),entries=entries),ensure_ascii=False,indent=2),encoding='utf-8')
 (HERE/'review-needed.json').write_text(json.dumps(review,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps(dict(original=len(original),verifiedOriginal=sum(r['status']=='verified' for r in entries if r.get('ingredientId')),new=sum(not r.get('ingredientId') for r in entries),unresolved=sum(r['status']=='needs_review' for r in review),nonfood=[r['name'] for r in review if r['status']=='not_food']),ensure_ascii=False))
if __name__=='__main__':main()
