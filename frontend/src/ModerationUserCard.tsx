import {useState} from 'react';
import {Link} from 'react-router-dom';
import {Avatar} from './RecipeDiscussion';
import type {ManagedPerson} from './management';
export type ModerationUser=ManagedPerson&{
 role:string;profileHiddenAt?:string|null;
 profile:({avatarUrl:string|null;coverUrl?:string|null})|null;
 metrics:{rating:number|null;ratingCount?:number;repostsReceived:number;repostsMade:number;published:number;unpublished:number;reports:number};
 _count:{recipes:number;comments:number;ratings:number};
};
export function ModerationUserCard({person:p}:{person:ModerationUser}){
 const [failedCover,setFailedCover]=useState<string|null>(null);
 const cover=p.profile?.coverUrl;const showCover=!!cover&&failedCover!==cover;
 return <article className='panel recipe-card moderation-user-card' data-departed={!!p.deletedAt}>
  <Link className={'moderation-user-cover'+(showCover?' has-cover':'')} to={'/users/'+p.id} aria-label={'Відкрити профіль '+p.name}>
   {showCover&&<img className='moderation-user-cover-photo' src={cover} alt='' loading='lazy' referrerPolicy='no-referrer' onError={()=>setFailedCover(cover)}/>}
   <span className={'moderation-user-role'+(p.role==='MODERATOR'?' is-moderator':'')}><span aria-hidden='true'>{p.role==='MODERATOR'?'✦':'♙'}</span>{p.role==='MODERATOR'?'Модератор':'Користувач'}</span>
   <div className='moderation-user-portrait'><Avatar key={p.profile?.avatarUrl} url={p.profile?.avatarUrl} name={p.name}/></div>
  </Link>
  <div className='recipe-content moderation-user-content'>
   <h3><Link to={'/users/'+p.id}>{p.name}</Link></h3><p className='moderation-user-handle' title={'@'+p.handle}>@{p.handle}</p>
   {p.deletedAt&&<p className='moderation-user-status'><span aria-hidden='true'>◌</span> Користувач покинув сервіс</p>}
   {p.profileHiddenAt&&<p className='moderation-user-status'>Профіль приховано</p>}
   <div className='recipe-meta moderation-user-metrics'>
    <strong aria-label={'Рейтинг страв: '+(p.metrics.rating?.toFixed(2)??'немає оцінок')} title={'Рейтинг страв · '+(p.metrics.ratingCount??0)+' оцінок'}>★ {p.metrics.rating?.toFixed(2)??'—'}</strong>
    <span title='Усього рецептів'>▤ {p._count.recipes} страв</span><span title='Написано коментарів'>◌ {p._count.comments} комент.</span>
    <span title='Унікальних пересилань страв автора' aria-label={'Пересилань страв: '+p.metrics.repostsReceived}>↗ {p.metrics.repostsReceived}</span>
    <span className={p.metrics.reports?'has-reports':undefined} title='Скарг на користувача' aria-label={'Скарг: '+p.metrics.reports}>⚑ {p.metrics.reports}</span>
   </div>
   <dl className='moderation-user-publications'><div><dt>Опубліковано</dt><dd>{p.metrics.published}</dd></div><div><dt>Неопубліковані / приховані</dt><dd>{p.metrics.unpublished}</dd></div></dl>
   <div className='moderation-user-extras'><span title='Кількість унікальних рецептів, які переслав користувач'>Переслав <b>{p.metrics.repostsMade}</b></span><span title='Кількість оцінок, які поставив користувач'>Надав оцінок <b>{p._count.ratings}</b></span></div>
  </div>
  <nav className='moderation-user-actions' aria-label={'Дії з профілем '+p.name}>
   <Link className='button button-outline moderation-user-activity' to={'/moderation/users/'+p.id}>Переглянути активність <span aria-hidden='true'>↗</span></Link>
   <Link className='moderation-user-action' aria-label='Редагувати / відновити акаунт' title='Редагувати / відновити акаунт' to={'/users/'+p.id+'?edit=1'}><span aria-hidden='true'>{p.deletedAt?'↻':'✎'}</span>{p.deletedAt?'Відновити':'Редагувати'}</Link>
   <Link className='moderation-user-action' to={'/manage/'+p.id}><span aria-hidden='true'>▤</span> Кабінет автора</Link>
  </nav>
 </article>;
}
