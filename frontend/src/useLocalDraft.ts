import {useEffect,useRef,useState} from 'react';

type Draft={version:1;value:string;savedAt:string};
export function useLocalDraft(key:string,value:string,ready:boolean){
 const baseline=useRef<string|null>(null),latest=useRef(value),skip=useRef(false);
 const [candidate,setCandidate]=useState<Draft|null>(null),[savedAt,setSavedAt]=useState(''),[storageError,setStorageError]=useState('');
 latest.current=value;
 useEffect(()=>{baseline.current=null;skip.current=false;setCandidate(null);setSavedAt('');if(!ready)return;
  baseline.current=value;
  try{const raw=localStorage.getItem(key);if(raw){const d=JSON.parse(raw);if(d.version===1&&typeof d.value==='string'&&typeof d.savedAt==='string'&&d.value!==value)setCandidate(d);}}
  catch{setStorageError('Не вдалося прочитати локальну чернетку.');}
 },[key,ready]);
 const dirty=ready&&baseline.current!==null&&value!==baseline.current;
 useEffect(()=>{if(!ready||candidate||skip.current)return;
  function save(){try{if(latest.current===baseline.current){localStorage.removeItem(key);setSavedAt('');return;}const date=new Date().toISOString();localStorage.setItem(key,JSON.stringify({version:1,value:latest.current,savedAt:date}));setSavedAt(date);setStorageError('');}catch{setStorageError('Не вдалося зберегти чернетку на цьому пристрої. Збережіть рецепт кнопкою нижче.');}}
  const timer=setTimeout(save,600);
  function leave(e:BeforeUnloadEvent){if(latest.current!==baseline.current&&!skip.current){save();e.preventDefault();e.returnValue='';}}
  function hide(){if(document.visibilityState==='hidden'&&!skip.current)save();}
  window.addEventListener('beforeunload',leave);document.addEventListener('visibilitychange',hide);
  return()=>{clearTimeout(timer);if(!skip.current)save();window.removeEventListener('beforeunload',leave);document.removeEventListener('visibilitychange',hide);};
 },[key,ready,value,candidate]);
 function discard(){try{localStorage.removeItem(key);}catch{}setCandidate(null);setSavedAt('');}
 function restore(){const v=candidate?.value;setCandidate(null);return v;}
 function committed(){skip.current=true;baseline.current=latest.current;try{localStorage.removeItem(key);}catch{}}
 return {candidate,restore,discard,committed,savedAt,storageError,dirty};
}
