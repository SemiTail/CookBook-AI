import {useEffect,useRef,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {openAdmins} from './management';
import {api} from './api';
import {Avatar} from './RecipeDiscussion';
export function AccountMenu({name,onLogout}:{name:string;onLogout:()=>void}){
 const [open,setOpen]=useState(false),[person,setPerson]=useState<{name:string;role?:string;profile:{avatarUrl:string|null}|null}|null>(null);
 const box=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null);const location=useLocation();
 useEffect(()=>{setOpen(false);let active=true;const refresh=()=>api<{name:string;role?:string;profile:{avatarUrl:string|null}|null}>('/users/me').then(p=>{if(active)setPerson(p);}).catch(()=>{});void refresh();window.addEventListener('cookbook-profile-updated',refresh);return()=>{active=false;window.removeEventListener('cookbook-profile-updated',refresh);};},[location.pathname]);
 useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(!box.current?.contains(e.target as Node))setOpen(false);};const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);button.current?.focus();}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};},[open]);
 const links=[['/profile','👤','Мій профіль'],['/statistics','📊','Статистика'],['/history','🕘','Історія пошуку'],['/following','👥','Відстеження'],['/saved','🔖','Збереження'],['/administration','🛡','Мої повноваження'],...(person?.role==='MODERATOR'?[['/moderation','⚖','Панель модерації']]:[])];
 return <div className='account-menu' ref={box}>
 <button ref={button} type='button' className='account-avatar-button' aria-label='Меню користувача' aria-expanded={open} aria-controls='account-dropdown' onClick={()=>setOpen(!open)} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setOpen(true);requestAnimationFrame(()=>box.current?.querySelector<HTMLAnchorElement>('.account-dropdown a')?.focus());}}}><Avatar key={person?.profile?.avatarUrl} url={person?.profile?.avatarUrl} name={person?.name||name}/><span aria-hidden='true'>⌄</span></button>
 {open&&<div id='account-dropdown' className='account-dropdown' onKeyDown={e=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;const items=[...(box.current?.querySelectorAll<HTMLElement>('.account-dropdown a,.account-dropdown button')??[])];const i=items.indexOf(document.activeElement as HTMLElement);e.preventDefault();items[e.key==='Home'?0:e.key==='End'?items.length-1:(i+(e.key==='ArrowUp'?-1:1)+items.length)%items.length]?.focus();}}>
 <strong className='account-menu-name'>{person?.name||name}</strong><nav aria-label='Особисте меню'>{links.map(([path,icon,label])=><Link key={path} to={path} onClick={()=>setOpen(false)}><span aria-hidden='true'>{icon}</span>{label}</Link>)}<button type='button' onClick={()=>{setOpen(false);openAdmins();}}>🛡 Адміністратори профілю</button><button type='button' className='account-logout' onClick={()=>{setOpen(false);onLogout();}}><span aria-hidden='true'>↪</span>Вийти</button></nav>
 </div>}</div>;
}
