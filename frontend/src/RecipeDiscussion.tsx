import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getSession } from "./api";
type Comment = { id:string; text:string; createdAt:string; user:{id:string; name:string; profile:{avatarUrl:string|null}|null} };
type Discussion = { comments:Comment[]; average:number|null; count:number; mine:number|null };
export function Avatar({ url, name }: {url?:string|null;name:string}) { const [failed,setFailed]=useState(false); return url&&!failed ? <img className="avatar" src={url} alt={name} referrerPolicy="no-referrer" onError={()=>setFailed(true)}/> : <span className="avatar avatar-fallback">{name.slice(0,1).toUpperCase()}</span>; }
export function RecipeDiscussion({id}:{id:string}) {
 const [data,setData]=useState<Discussion|null>(null),[text,setText]=useState(""),[error,setError]=useState(""),[pending,setPending]=useState(false);
 useEffect(()=>{let active=true;api<Discussion>("/recipes/"+id+"/discussion").then(d=>{if(active)setData(d);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[id]);
 async function act(path:string,method:string,body?:unknown){setPending(true);setError("");try{await api("/recipes/"+id+path,{method,...(body?{body:JSON.stringify(body)}:{})});setData(await api<Discussion>("/recipes/"+id+"/discussion"));if(path==="/comments")setText("");}catch(e){setError(e instanceof Error?e.message:"Помилка");}finally{setPending(false);}}
 return <section className="panel discussion"><h2>Оцінки та коментарі</h2>{error&&<p className="error" role="alert">{error}</p>}
 <p>{data?.count ? "★ "+data.average?.toFixed(1)+" · "+data.count+" оцінок" : "Ще немає оцінок"}</p><div className="rating-stars" aria-label="Ваша оцінка">{[1,2,3,4,5].map(n=><button key={n} disabled={pending} aria-label={"Оцінити на "+n} aria-pressed={data?.mine===n} onClick={()=>void act("/rating","PUT",{value:n})}>{n<=(data?.mine??0)?"★":"☆"}</button>)}</div>
 <form onSubmit={e=>{e.preventDefault();void act("/comments","POST",{text});}}><label>Ваш коментар<textarea required maxLength={4000} value={text} onChange={e=>setText(e.target.value)} /></label><button className="button" disabled={pending||!text.trim()}>Додати коментар</button></form>
 {data?.comments.map(c=><article className="comment" key={c.id}><Link aria-label={c.user.name} className="comment-author" to={"/users/"+c.user.id}><Avatar url={c.user.profile?.avatarUrl} name={c.user.name}/><strong>{c.user.name}</strong></Link><time>{new Date(c.createdAt).toLocaleString("uk-UA")}</time><p>{c.text}</p>{c.user.id===getSession()?.user.id&&<button className="text-button" disabled={pending} onClick={()=>void act("/comments/"+c.id,"DELETE")}>Видалити коментар</button>}</article>)}
 </section>;
}
