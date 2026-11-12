import {useEffect,useState} from "react";
import {api,getSession} from "./api";
export function FollowButton({id}:{id:string}) {
 const [following,setFollowing]=useState(false),[pending,setPending]=useState(true),[error,setError]=useState("");
 useEffect(()=>{let active=true;setPending(true);api<{following:boolean}>("/library/follow/"+id).then(r=>{if(active)setFollowing(r.following);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setPending(false);});return()=>{active=false;};},[id]);
 if(id===getSession()?.user.id)return null;
 return <><button type="button" className="button" disabled={pending} aria-pressed={following} onClick={async()=>{setPending(true);setError("");try{const result=await api<{following:boolean}>("/library/follow/"+id,{method:following?"DELETE":"PUT"});setFollowing(result.following);}catch(e){setError(e instanceof Error?e.message:"Помилка");}finally{setPending(false);}}}>{following?"Припинити відстеження":"Відстежувати користувача"}</button>{error&&<p role="alert">{error}</p>}</>;
}
