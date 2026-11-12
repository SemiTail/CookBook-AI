import {SavedCollections,type CollectionFilter} from '../SavedCollections';
import {matchesSearch} from '../search';
import {ActivityAudit} from '../ActivityAudit';
import {getSession} from '../api';
import {useEffect,useRef,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {api} from '../api';
import {Avatar} from '../RecipeDiscussion';
import {RecipeImage} from '../RecipeImage';
import {RecipeCard} from './DashboardPage';
import type {Recipe} from '../types';
type Person={id:string;name:string;profile:{avatarUrl:string|null}|null};
type Preview=Pick<Recipe,'id'|'title'|'description'|'imageUrl'|'emoji'|'preparationMinutes'|'difficulty'|'matchPercent'>&{authorId:string|null;author?:Person|null};
type Entry={id:string;person?:Person;recipe?:Preview|null;recipes:Preview[];query?:string;source?:string;profileUserId?:string|null;profileUser?:Person|null;createdAt?:string};
type Kind='history'|'saved'|'following';
const settings={history:{title:'Історія пошуку',hint:'Пошуки рецептів на головній сторінці та у вітринах користувачів.',action:'Видалити з історії',empty:'Ваша історія пошуку поки порожня.'},saved:{title:'Збережені рецепти',hint:'Ваша особиста добірка рецептів.',action:'Прибрати зі збережень',empty:'Ви ще не зберегли жодного рецепта.'},following:{title:'Мої відстеження',hint:'Користувачі, за чиїми публікаціями ви стежите, та їхні останні рецепти.',action:'Припинити відстеження',empty:'Ви поки нікого не відстежуєте.'}};
const sources:Record<string,string>={mine:'Свої рецепти',official:'Офіційні рецепти',ready:'Що можна приготувати',community:'Браузер рецептів',saved:'Збережені',following:'Відстеження',moderation:'Модерація',profile:'Вітрина користувача'};
function Author({person}:{person?:Person|null}){return person?<Link className='library-author' to={'/users/'+person.id}><Avatar key={person.profile?.avatarUrl} url={person.profile?.avatarUrl} name={person.name}/><span>{person.name}</span></Link>:null;}
function Previews({recipes}:{recipes:Preview[]}){return <div className='library-previews'>{recipes.map(recipe=><div className='library-preview' key={recipe.id}><Link to={'/recipes/'+recipe.id}><RecipeImage url={recipe.imageUrl} emoji={recipe.emoji} title={recipe.title}/><strong>{recipe.title}</strong></Link><Author person={recipe.author}/></div>)}</div>;}
function replay(entry:Entry){const query=encodeURIComponent(entry.query??'');return entry.source==='profile'&&entry.profileUserId?'/users/'+entry.profileUserId+'?search='+query:'/dashboard?search='+query+'&tab='+encodeURIComponent(entry.source==='profile'?'official':entry.source??'official');}
export function LibraryPage({kind}:{kind:Kind}){
 const [entries,setEntries]=useState<Entry[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[query,setQuery]=useState(''),[selected,setSelected]=useState<string[]>([]),[confirm,setConfirm]=useState(false),[pending,setPending]=useState(false),[revision,setRevision]=useState(0),[cursor,setCursor]=useState<string|null>(null),[more,setMore]=useState(false);
 const [params]=useSearchParams();const requested=params.get('select');
 const [collection,setCollection]=useState<CollectionFilter>(null);
 const config=settings[kind];const currentKind=useRef(kind);currentKind.current=kind;
 useEffect(()=>{setQuery('');setCollection(null);},[kind]);
 useEffect(()=>{if(kind!=='history')return;const refresh=()=>setRevision(n=>n+1);window.addEventListener('cookbook-history-updated',refresh);return()=>window.removeEventListener('cookbook-history-updated',refresh);},[kind]);
 useEffect(()=>{let active=true;setLoading(true);setError('');setEntries([]);setSelected([]);setConfirm(false);setCursor(null);setMore(false);
  (async()=>{if(kind==='saved'){const data=await api<{id:string;savedAt:string;recipe:Preview|null}[]>('/library/saved-items');return {entries:data.map(x=>({id:x.id,recipe:x.recipe,recipes:[],createdAt:x.savedAt})),cursor:null};}
   if(kind==='following'){const data=await api<{users:Person[];recipes:Preview[]}>('/library/following');return {entries:data.users.map(person=>({id:person.id,person,recipes:data.recipes.filter(r=>r.authorId===person.id).slice(0,3)})),cursor:null};}
   const data=await api<{items:Entry[];nextCursor:string|null}>('/library/history');return {entries:data.items,cursor:data.nextCursor};
  })().then(data=>{if(active){setEntries(data.entries);setCursor(data.cursor);if(kind==='saved'&&requested&&data.entries.some(e=>e.id===requested))setSelected([requested]);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};
 },[kind,revision,requested]);
 const visible=entries.filter(e=>!collection||collection.ids.includes(e.id)).filter(e=>matchesSearch(e.person?.name??e.recipe?.title??e.query??'',query));
 const ids=new Set(selected);const toggle=(id:string)=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):s.length<500?[...s,id]:s);
 async function remove(){if(pending||!selected.length)return;setPending(true);setError('');try{await api('/library/'+kind,{method:'DELETE',body:JSON.stringify({ids:selected})});setSelected([]);setConfirm(false);setRevision(n=>n+1);}catch(e){setError((e as Error).message);}finally{setPending(false);}}
 async function loadMore(){if(!cursor||more)return;setMore(true);setError('');try{const data=await api<{items:Entry[];nextCursor:string|null}>('/library/history?cursor='+encodeURIComponent(cursor));if(currentKind.current!==kind)return;setEntries(old=>[...new Map([...old,...data.items].map(x=>[x.id,x])).values()]);setCursor(data.nextCursor);}catch(e){setError((e as Error).message);}finally{setMore(false);}}
 return <section className='library-page'><Link className='back' to='/dashboard'>← Головна</Link><h1>{config.title}</h1><p className='muted'>{config.hint}</p>
 {kind==='saved'&&!loading&&<SavedCollections recipes={entries.map(e=>e.recipe?e.recipe:{id:e.id,title:'Недоступний рецепт',imageUrl:null,emoji:'📖'})} selected={selected} filter={collection} onFilter={c=>{setCollection(c);setSelected([]);setConfirm(false);}} onDone={()=>setSelected([])} revision={revision}/>}
 {error&&<p className='error' role='alert'>{error}</p>}{loading?<p role='status'>Завантажуємо…</p>:<>
 {!!entries.length&&<div className='panel library-tools'><label>Пошук у списку<input type='search' aria-label='Пошук у списку' value={query} onChange={e=>setQuery(e.target.value)}/></label><div className='library-selection-tools'>
 <label className='library-select-all'><input type='checkbox' aria-label='Обрати всі видимі записи' checked={visible.length>0&&visible.every(x=>ids.has(x.id))} disabled={pending||!visible.length} onChange={e=>setSelected(s=>e.target.checked?[...new Set([...s,...visible.map(x=>x.id)])].slice(0,500):s.filter(id=>!visible.some(x=>x.id===id)))}/>Обрати видимі</label><span role='status'>Обрано: {selected.length}</span><button type='button' className='text-button' onClick={()=>setSelected([])}>Скинути вибір</button><button type='button' className='button button-outline' disabled={pending||!selected.length} onClick={()=>setConfirm(true)}>{config.action}</button>
 </div>{entries.length>500&&<small>За один раз можна обрати до 500 записів.</small>}</div>}
 {confirm&&<div className='panel library-confirm' role='alertdialog' aria-label='Підтвердження видалення зі списку'><p>{config.action}: {selected.length}?</p><button type='button' className='button button-danger' disabled={pending} onClick={()=>void remove()}>Підтвердити видалення</button><button type='button' className='button button-outline' disabled={pending} onClick={()=>setConfirm(false)}>Скасувати</button></div>}
 {!entries.length?<p className='empty'>{config.empty}</p>:!visible.length?<p className='empty'>{collection?'У цій колекції немає рецептів за поточним пошуком. Оберіть «Усі збереження», щоб додати рецепти.':'За цим пошуком нічого не знайдено.'}</p>:<div className={'library-grid library-'+kind}>
 {visible.map(entry=><article className={'panel library-entry'+(ids.has(entry.id)?' is-selected':'')} key={entry.id}>
 <label className='library-entry-select'><input type='checkbox' aria-label={'Обрати '+(entry.person?.name??entry.recipe?.title??entry.query??'недоступний рецепт')} checked={ids.has(entry.id)} disabled={pending||(!ids.has(entry.id)&&selected.length>=500)} onChange={()=>toggle(entry.id)}/>Обрати</label>
 {kind==='saved'&&(entry.recipe?<><RecipeCard recipe={entry.recipe}/><Author person={entry.recipe.author}/></>:<div className='library-unavailable'><span aria-hidden='true'>📖</span><h3>Рецепт недоступний</h3><p>Його можна прибрати зі збережень.</p></div>)}
 {kind==='following'&&entry.person&&<><Link to={'/users/'+entry.person.id} className='library-person'><Avatar key={entry.person.profile?.avatarUrl} url={entry.person.profile?.avatarUrl} name={entry.person.name}/><h2>{entry.person.name}</h2></Link><Previews recipes={entry.recipes}/>{!entry.recipes.length&&<p className='muted'>Ще немає доступних публікацій.</p>}</>}
 {kind==='history'&&<><h2><Link to={replay(entry)}>{entry.query}</Link></h2><small className='muted'>{entry.createdAt&&new Date(entry.createdAt).toLocaleString('uk-UA')} · {sources[entry.source??'']??'Пошук'}</small><Author person={entry.profileUser}/><Previews recipes={entry.recipes}/>{!entry.recipes.length&&<p className='muted'>Немає доступних рецептів для попереднього перегляду.</p>}<Link className='text-button' to={replay(entry)}>Повторити пошук →</Link></>}
 </article>)}
 </div>}{kind==='history'&&cursor&&<button type='button' className='button button-outline library-more' disabled={more} onClick={()=>void loadMore()}>{more?'Завантажуємо…':'Показати давніші записи'}</button>}
 </>}
 </section>;
}
type Stats={repostsMade:number;repostsReceived:number;myComments:number;communityComments:number;recipes:number;official:number;shared:number;saved:number;following:number;followers:number;history:number;averageRating:number|null;ratingCount:number;byMeal:{meal:string;count:number}[]};
const mealNames:Record<string,string>={BREAKFAST:'Сніданок',LUNCH:'Обід',DINNER:'Вечеря',SNACK:'Перекус',DESSERT:'Десерт',ANY:'Не вказано'};
export function StatisticsPage(){
 const [stats,setStats]=useState<Stats|null>(null),[error,setError]=useState('');useEffect(()=>{let active=true;api<Stats>('/library/stats').then(s=>{if(active)setStats(s);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 return <section className='statistics-page'><Link className='back' to='/dashboard'>← Головна</Link><h1>Моя статистика</h1>{error&&<p className='error' role='alert'>{error}</p>}{!stats&&!error&&<p>Завантажуємо…</p>}{stats&&<>
 <div className='statistics-grid'>{[['Переслано вами рецептів',stats.repostsMade,''],['Переслано ваших рецептів',stats.repostsReceived,''],['Мої рецепти',stats.recipes,'/dashboard?tab=mine'],['Офіційні рецепти',stats.official,'/dashboard?tab=mine'],['Публікації спільноти',stats.shared,'/dashboard?tab=mine'],['Збережені рецепти',stats.saved,'/saved'],['Відстежую',stats.following,'/following'],['Мої підписники',stats.followers,''],['Записи історії пошуку',stats.history,'/history'],['Мої коментарі',stats.myComments,'/statistics/comments/mine'],['Коментарі спільноти',stats.communityComments,'/statistics/comments/community']].map(([label,value,path])=>path?<Link key={label} className='panel statistics-tile' to={String(path)}><strong>{value}</strong><span>{label}</span></Link>:<div className='panel statistics-tile' key={label}><strong>{value}</strong><span>{label}</span></div>)}<Link className='panel statistics-tile' to='/statistics/ratings'><strong>{stats.averageRating===null?'—':'★ '+stats.averageRating.toFixed(1)}</strong><span>Середня оцінка моїх рецептів · {stats.ratingCount} оцінок</span></Link></div>
 <section className='panel statistics-meals'><h2>Мої рецепти за прийомом їжі</h2>{!stats.recipes?<p className='muted'>Створіть перший рецепт, щоб побачити розподіл.</p>:Object.entries(mealNames).map(([meal,label])=>{const count=stats.byMeal.find(x=>x.meal===meal)?.count??0;return <div className='statistics-bar' key={meal}><span>{label}</span><progress max={Math.max(1,...stats.byMeal.map(x=>x.count))} value={count} aria-label={label}/><strong>{count}</strong></div>;})}</section>
 </>}<ActivityAudit ownerId={getSession()?.user.id}/></section>;
}
