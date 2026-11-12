"""Freeze reviewed annotations into the migration and fresh-install seed metadata.

Reads the current catalog; never modifies the database. Run only when preparing
a new geography data release, before applying that release's migration.
"""
import json,sqlite3
from taxonomy import ROOT,annotate,GEOGRAPHIC

def quote(value):return "'"+str(value).replace("'","''")+"'"
def encoded(value):return json.dumps(value,ensure_ascii=False,separators=(',',':'))

def main():
 db=sqlite3.connect((ROOT/'backend/dev.db').as_uri()+'?mode=ro',uri=True);db.row_factory=sqlite3.Row
 migration='20261111233000_ingredient_countries'
 if db.execute('SELECT 1 FROM _prisma_migrations WHERE migration_name=? AND finished_at IS NOT NULL',(migration,)).fetchone():raise RuntimeError('This migration is already applied; never rewrite applied migration files.')
 records=[dict(name=row['name'],**annotate(row)) for row in db.execute('SELECT * FROM Ingredient ORDER BY name')]
 categories=sorted(set(row['category'] for row in records))
 sql=['-- Food types and culinary geography have independent filters.',"ALTER TABLE Ingredient ADD COLUMN culinaryCountries JSONB NOT NULL DEFAULT '[]';"]
 for category in categories:sql.append('INSERT OR IGNORE INTO Category(name) VALUES ('+quote(category)+');')
 for row in records:
  assignments=','.join(key+'='+quote(encoded(row[key]) if isinstance(row[key],list) else row[key]) for key in ['category','categoryTags','culinaryRegions','culinaryCountries'])
  sql.append('UPDATE Ingredient SET '+assignments+' WHERE name='+quote(row['name'])+';')
 for row in db.execute('SELECT name FROM Category'):
  if GEOGRAPHIC.search(row['name']):sql.append('DELETE FROM Category WHERE name='+quote(row['name'])+';')
 path=ROOT/'backend/prisma/migrations'/migration;path.mkdir(parents=True,exist_ok=True)
 (path/'migration.sql').write_text('\n'.join(sql)+'\n',encoding='utf-8')
 (ROOT/'backend/prisma/ingredient-geography.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps(dict(ingredients=len(records),annotatedCountries=sum(bool(row['culinaryCountries']) for row in records),categories=len(categories))))

if __name__=='__main__':main()
