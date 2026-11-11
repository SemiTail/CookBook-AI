import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { api, getSession, saveSession } from "../api";
import { Avatar } from "../RecipeDiscussion";
import { Markdown, MarkdownEditor } from "../Markdown";
import { RecipeCard } from "./DashboardPage";
import type { Recipe } from "../types";
type Profile = {bio:string|null;avatarUrl:string|null;coverUrl:string|null;showRecipes:boolean};
type Person = {id:string;name:string;profile:Profile|null;recipes?:Recipe[]};
export function ProfilePage() {
 const {id}=useParams();const editing=!id;
 const [person,setPerson]=useState<Person|null>(null),[name,setName]=useState(""),[bio,setBio]=useState(""),[avatar,setAvatar]=useState(""),[cover,setCover]=useState(""),[show,setShow]=useState(false),[error,setError]=useState(""),[saved,setSaved]=useState(false),[pending,setPending]=useState(false);
 useEffect(()=>{let active=true;setPerson(null);setError("");api<Person>(editing?"/users/me":"/users/"+id+"/profile").then(p=>{if(!active)return;setPerson(p);setName(p.name);setBio(p.profile?.bio??"");setAvatar(p.profile?.avatarUrl??"");setCover(p.profile?.coverUrl??"");setShow(p.profile?.showRecipes??false);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[id,editing]);
 async function save(e:FormEvent){e.preventDefault();setPending(true);setSaved(false);setError("");try{const p=await api<Person>("/users/me/profile",{method:"PUT",body:JSON.stringify({name,bio,avatarUrl:avatar.trim()||null,coverUrl:cover.trim()||null,showRecipes:show})});setPerson(p);const session=getSession();if(session)saveSession({...session,user:{...session.user,name:p.name}});setSaved(true);}catch(e){setError(e instanceof Error?e.message:"Помилка");}finally{setPending(false);}}
 return <section className="profile-page">{error&&<p className="error" role="alert">{error}</p>}{!person&&!error&&<p>Завантаження…</p>}{person&&<>
 <div className="panel profile-hero">{person.profile?.coverUrl&&<img className="profile-cover" src={person.profile.coverUrl} alt="Обкладинка профілю" referrerPolicy="no-referrer"/>}<Avatar key={person.profile?.avatarUrl} url={person.profile?.avatarUrl} name={person.name}/><h1>{person.name}</h1><Markdown>{person.profile?.bio??""}</Markdown></div>
 {editing?<form className="panel profile-form" onSubmit={save}><h2>Особистий кабінет</h2><fieldset disabled={pending}><label>Ім’я<input required minLength={2} maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label><label>Аватар (URL)<input type="url" value={avatar} onChange={e=>setAvatar(e.target.value)}/></label><label>Обкладинка (URL)<input type="url" value={cover} onChange={e=>setCover(e.target.value)}/></label><MarkdownEditor label="Про себе" value={bio} onChange={setBio} maxLength={4000}/><label className="check-label"><input type="checkbox" checked={show} onChange={e=>setShow(e.target.checked)}/>Показувати мої оприлюднені рецепти у профілі</label><p className="muted">Ім’я, аватар, обкладинка та опис доступні іншим користувачам. Приватні рецепти й email не показуються.</p><button className="button">Зберегти профіль</button>{saved&&<p role="status">Профіль збережено</p>}</fieldset></form>:<section><h2>Вітрина рецептів</h2>{person.profile?.showRecipes?<div className="cards">{person.recipes?.map(r=><RecipeCard key={r.id} recipe={r}/>)}{!person.recipes?.length&&<p>Поки немає оприлюднених рецептів.</p>}</div>:<p className="empty">Користувач приховав свою вітрину рецептів.</p>}</section>}
 </>}</section>;
}
