import {useEffect,useState} from "react";
import {api} from "./api";
export function FavoriteButton({id}:{id:string}) {
 const [saved,setSaved]=useState(false),[pending,setPending]=useState(true),[error,setError]=useState("");
 useEffect(()=>{let active=true;setPending(true);api<{saved:boolean}>("/recipes/"+id+"/favorite").then(r=>{if(active)setSaved(r.saved);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setPending(false);});return()=>{active=false;};},[id]);
 return <><button className="button button-outline" disabled={pending} aria-pressed={saved} onClick={async()=>{setPending(true);setError("");try{const result=await api<{saved:boolean}>("/recipes/"+id+"/favorite",{method:saved?"DELETE":"PUT"});setSaved(result.saved);}catch(e){setError(e instanceof Error?e.message:"Помилка збереження");}finally{setPending(false);}}}>{saved?"♥ Збережено":"♡ Зберегти"}</button>{error&&<small role="alert">{error}</small>}</>;
}
