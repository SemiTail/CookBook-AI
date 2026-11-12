import {DepartedBadge} from '../DepartedBadge';
import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {api} from '../api';
import {RecipeCard} from './DashboardPage';
import {Avatar,CommentText,type ThreadComment} from '../RecipeDiscussion';
import type {Recipe} from '../types';
type Item=Recipe&{comments?:ThreadComment[];averageRating?:number;ratingCount?:number};
export function ActivityPage({kind}:{kind:'ratings'|'mine'|'community'}){
 const [items,setItems]=useState<Item[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[query,setQuery]=useState('');
 useEffect(()=>{let active=true;setLoading(true);setError('');setItems([]);setQuery('');api<Item[]>(kind==='ratings'?'/library/rated-recipes':'/library/comments/'+kind).then(rows=>{if(active)setItems(rows);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[kind]);
 const title=kind==='ratings'?'Мої рецепти з оцінками':kind==='mine'?'Мої коментарі':'Коментарі спільноти';
 const filter=query.trim().toLocaleLowerCase('uk');const shown=items.map(r=>({...r,comments:!filter||r.title.toLocaleLowerCase('uk').includes(filter)?r.comments:r.comments?.filter(c=>(c.text+' '+c.user.name+' '+c.user.handle).toLocaleLowerCase('uk').includes(filter))})).filter(r=>!filter||r.title.toLocaleLowerCase('uk').includes(filter)||!!r.comments?.length);
 return <section className='activity-page'><Link className='back' to='/statistics'>← Моя статистика</Link><h1>{title}</h1><p className='muted'>{kind==='ratings'?'Рецепти, які ви створили та які вже отримали оцінки.':kind==='mine'?'Ваші коментарі й відповіді під доступними рецептами.':'Коментарі й відповіді інших користувачів під вашими рецептами.'}</p>
 {error&&<p className='error' role='alert'>{error}</p>}{loading?<p role='status'>Завантажуємо…</p>:<><label className='activity-search'>Пошук рецептів і коментарів<input type='search' value={query} onChange={e=>setQuery(e.target.value)}/></label><p role='status'>Знайдено рецептів: {shown.length}</p><div className='activity-grid'>{shown.map(recipe=><article className='panel activity-card' key={recipe.id}><RecipeCard recipe={recipe} rating={recipe.averageRating}/>
 {kind==='ratings'?<p className='muted'>Оцінок: {recipe.ratingCount}</p>:<div className='activity-comments'>{recipe.comments?.map(c=><article className='comment activity-comment' key={c.id}><Link className='comment-author' to={'/users/'+c.user.id}><Avatar key={c.user.profile?.avatarUrl} url={c.user.profile?.avatarUrl} name={c.user.name}/><span><strong>{c.user.name}</strong><DepartedBadge deletedAt={c.user.deletedAt}/><small>@{c.user.handle}</small></span></Link><time>{new Date(c.createdAt).toLocaleString('uk-UA')}</time>{c.parent&&<small className='muted'>↳ {c.parent.deletedAt?'Відповідь на видалений коментар':'Відповідь '+c.parent.user.name}</small>}<CommentText comment={c}/><Link className='text-button' to={'/recipes/'+recipe.id+'#comment-'+c.id}>Відкрити гілку →</Link></article>)}</div>}
 </article>)}</div>{!shown.length&&<p className='empty'>{items.length?'Нічого не знайдено.':kind==='ratings'?'Ваші рецепти ще не отримали оцінок.':'Поки немає коментарів у цьому списку.'}</p>}</>}
 </section>;
}
