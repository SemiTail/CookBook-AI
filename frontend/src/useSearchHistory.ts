import {useCallback,useEffect,useRef} from 'react';
import {api,getSession} from './api';
export function useSearchHistory(query:string,source:string,results:{id:string}[],profileUserId?:string,enabled=true){
 const ids=results.slice(0,3).map(x=>x.id).join('|');const last=useRef('');
 const record=useCallback(()=>{const clean=query.normalize('NFKC').trim().replace(/\s+/g,' ').slice(0,160);const key=source+':'+(profileUserId??'')+':'+clean;if(!getSession()||!enabled||clean.length<2||last.current===key)return;last.current=key;void api('/library/history',{method:'POST',body:JSON.stringify({query:clean,source,recipeIds:ids?ids.split('|'):[],...(profileUserId?{profileUserId}:{})}),keepalive:true}).then(()=>window.dispatchEvent(new Event('cookbook-history-updated'))).catch(()=>{if(last.current===key)last.current='';});},[query,source,ids,profileUserId,enabled]);
 useEffect(()=>{const timer=setTimeout(record,800);return()=>clearTimeout(timer);},[record]);
 useEffect(()=>{if(!query.trim())last.current='';},[query]);
 return record;
}
