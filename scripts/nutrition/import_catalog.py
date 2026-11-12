"""Review-only by default; --apply commits an atomic import after SQLite backup."""
import argparse,datetime,json,sqlite3,uuid,unicodedata
from pathlib import Path
from compile_catalog import validate
from taxonomy import apply as apply_taxonomy
ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
def norm(s):return ' '.join(unicodedata.normalize('NFKC',s).casefold().split())
def main():
 p=argparse.ArgumentParser();p.add_argument('--database',type=Path,default=ROOT/'backend/dev.db');p.add_argument('--apply',action='store_true');a=p.parse_args()
 rows=json.loads((HERE/'catalog.json').read_text(encoding='utf-8'))['entries']
 for r in rows:
  if r['status']=='verified':validate(r['nutrients'])
 db=sqlite3.connect(a.database.resolve().as_uri()+'?mode=rw',uri=True,timeout=30);db.row_factory=sqlite3.Row;db.execute('PRAGMA foreign_keys=ON')
 now=datetime.datetime.now(datetime.timezone.utc).isoformat()
 if a.apply:
  d=ROOT/'tmp/nutrition/backups';d.mkdir(parents=True,exist_ok=True);b=d/('pre-import-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'.db')
  with sqlite3.connect(b) as dst:db.backup(dst)
  print('Backup:',b)
 counts=dict(verified=0,needs_review=0,not_food=0,inserted=0,existingExpansion=0)
 try:
  db.execute('BEGIN IMMEDIATE' if a.apply else 'BEGIN');names={norm(r['name']):r['id'] for r in db.execute('SELECT id,name FROM Ingredient')}
  for r in rows:
   iid=r.get('ingredientId')
   if iid:
    old=db.execute('SELECT name FROM Ingredient WHERE id=?',(iid,)).fetchone()
    if not old or old['name']!=r['name']:raise ValueError('Ingredient changed: '+r['name'])
   else:
    key=norm(r['name'])
    if key in names:counts['existingExpansion']+=1;continue
    iid=str(uuid.uuid5(uuid.NAMESPACE_URL,'cookbook-ai/nutrition/'+r['name']));names[key]=iid;counts['inserted']+=1
    db.execute('INSERT INTO Category (name) VALUES (?) ON CONFLICT(name) DO NOTHING',(r['category'],))
    db.execute('INSERT INTO Ingredient (id,name,category,emoji) VALUES (?,?,?,?)',(iid,r['name'],r['category'],r.get('emoji')))
   counts[r['status']]+=1
   db.execute('UPDATE Ingredient SET nutritionStatus=?,nutritionSource=?,nutritionSourceUrl=?,nutritionSourceFood=?,nutritionNote=?,nutritionUpdatedAt=? WHERE id=?',(r['status'],r.get('source'),r.get('sourceUrl'),r.get('sourceFood'),r.get('note'),now,iid))
   if r['status']=='verified':
    n=r['nutrients'];db.execute('UPDATE Ingredient SET caloriesPer100g=?,proteinPer100g=?,fatPer100g=?,carbsPer100g=? WHERE id=?',(n['kcal'],n['protein'],n['fat'],n['carbs'],iid))
  apply_taxonomy(db)
  if a.apply:db.commit()
  else:db.rollback()
  print(json.dumps(dict(mode='applied' if a.apply else 'dry-run',**counts),ensure_ascii=False))
 except BaseException:db.rollback();raise
 finally:db.close()
if __name__=='__main__':main()
