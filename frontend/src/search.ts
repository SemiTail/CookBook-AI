// These aliases describe names, not ingredient substitutions.
const aliases=[['нут','турецький горох','chickpea','chickpeas'],['данго','dango'],['кінза','зелень коріандру','cilantro'],['рукола','руккола','arugula'],['баклажан','aubergine','eggplant'],['цукіні','цукині','zucchini'],['тофу','tofu'],['моцарела','моцарелла','mozzarella'],['тахіні','тахина','tahini'],['кускус','кус кус','couscous']];
const aliasPatterns=aliases.map(group=>({pattern:new RegExp('(?<![\\p{L}\\p{N}])(?:'+group.join('|')+')(?![\\p{L}\\p{N}])','gu'),canonical:group[0]}));
export function normalizeSearch(value:string){
 let text=value.normalize('NFKC').toLocaleLowerCase('uk').replace(/ґ/g,'г').replace(/[’'`ʼ]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 for(const {pattern,canonical} of aliasPatterns)text=text.replace(pattern,canonical);
 return text;
}
function smallTypo(a:string,b:string){
 if(a.length<4||Math.abs(a.length-b.length)>1)return false;
 let i=0;while(i<a.length&&a[i]===b[i])i++;
 if(i===a.length)return b.length-a.length<=1;
 if(a.length===b.length)return a.slice(i+1)===b.slice(i+1)||(a[i]===b[i+1]&&a[i+1]===b[i]&&a.slice(i+2)===b.slice(i+2));
 return a.length>b.length?a.slice(i+1)===b.slice(i):a.slice(i)===b.slice(i+1);
}
export function matchesSearch(text:string,query:string){
 const needle=normalizeSearch(query);if(!needle)return true;
 const haystack=normalizeSearch(text);if(haystack.includes(needle))return true;
 const words=haystack.split(' ');
 return needle.split(' ').every(word=>words.some(candidate=>candidate.includes(word)||smallTypo(word,candidate)));
}
