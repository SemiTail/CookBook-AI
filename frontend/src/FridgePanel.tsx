import { IngredientSelection } from "./IngredientSelection";
import { useState } from "react";
import { api } from "./api";
import type { FridgeItem, Ingredient } from "./types";
export function FridgePanel({ fridge, ingredients, onChanged, onError }: { fridge:FridgeItem[]; ingredients:Ingredient[]; onChanged:()=>Promise<void>; onError:(e:unknown)=>void }) {
 const [removed,setRemoved]=useState<string[]>([]);
 const [pending,setPending]=useState(false), [confirm,setConfirm]=useState(false);
 const owned=new Set(fridge.map(x=>x.ingredientId));
 async function mutate(path:string,method:string,body?:unknown) { setPending(true); try { await api(path,{method,...(body?{body:JSON.stringify(body)}:{})}); await onChanged(); setRemoved([]); setConfirm(false); } catch(e){onError(e);} finally {setPending(false);} }
 return <section className="panel fridge-panel"><div className="section-header"><div><span className="eyebrow">Твій запас продуктів</span><h2>Мій холодильник <span className="count">{fridge.length}</span></h2></div><button className="text-button danger-text" disabled={pending||!fridge.length} onClick={()=>setConfirm(true)}>Очистити холодильник</button></div>
 <IngredientSelection ingredients={ingredients} excluded={[...owned]} pending={pending} onCreated={()=>onChanged()} onDeleted={()=>void onChanged()} onConfirm={ids=>mutate("/fridge/bulk","POST",{ingredientIds:ids})}/>

 {!!fridge.length&&<div className="picker-tools"><label><input type="checkbox" aria-label="Обрати всі продукти в холодильнику" checked={removed.length===fridge.length} onChange={e=>setRemoved(e.target.checked?fridge.slice(0,200).map(x=>x.id):[])}/> Обрати всі</label><button className="text-button danger-text" disabled={pending||!removed.length} onClick={()=>void mutate("/fridge/selected","DELETE",{ids:removed})}>Видалити обрані</button></div>}
 <div className="pills">{fridge.map(x=><span className="pill" key={x.id}><label><input type="checkbox" aria-label={"Обрати "+x.ingredient.name} checked={removed.includes(x.id)} onChange={()=>setRemoved(s=>s.includes(x.id)?s.filter(id=>id!==x.id):[...s,x.id].slice(0,200))}/><span className="ingredient-icon">{x.ingredient.emoji||"🥣"}</span>{x.ingredient.name}<small className="category-tag">{x.ingredient.category}</small></label><button disabled={pending} aria-label={"Видалити "+x.ingredient.name} onClick={()=>void mutate("/fridge/"+x.id,"DELETE")}>×</button></span>)}</div>
 {!fridge.length&&<p className="muted">Холодильник порожній. Додайте перший інгредієнт.</p>}
 {confirm&&<div role="alertdialog" className="fridge-confirm"><p>Видалити всі продукти?</p><button className="button" disabled={pending} onClick={()=>void mutate("/fridge","DELETE")}>Так, видалити продукти</button><button className="button button-outline" onClick={()=>setConfirm(false)}>Скасувати</button></div>}
 </section>;
}
