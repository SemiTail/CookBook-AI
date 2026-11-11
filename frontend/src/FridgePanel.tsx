import { useState } from "react";
import { api } from "./api";
import { IngredientCreator } from "./IngredientCreator";
import type { FridgeItem, Ingredient } from "./types";
export function FridgePanel({ fridge, ingredients, onChanged, onError }: { fridge:FridgeItem[]; ingredients:Ingredient[]; onChanged:()=>Promise<void>; onError:(e:unknown)=>void }) {
 const [picker,setPicker]=useState(false), [search,setSearch]=useState(""), [category,setCategory]=useState("");
 const [selected,setSelected]=useState<string[]>([]), [removed,setRemoved]=useState<string[]>([]);
 const [pending,setPending]=useState(false), [confirm,setConfirm]=useState(false);
 const owned=new Set(fridge.map(x=>x.ingredientId));
 const categories=[...new Set(ingredients.map(x=>x.category))].sort((a,b)=>a.localeCompare(b,"uk"));
 const visible=ingredients.filter(x=>!owned.has(x.id)&&(!category||x.category===category)&&x.name.toLocaleLowerCase("uk").includes(search.toLocaleLowerCase("uk"))).sort((a,b)=>a.name.localeCompare(b.name,"uk"));
 async function mutate(path:string,method:string,body?:unknown) { setPending(true); try { await api(path,{method,...(body?{body:JSON.stringify(body)}:{})}); if(path === "/fridge/bulk") setPicker(false); await onChanged(); setSelected([]); setRemoved([]); setConfirm(false); } catch(e){onError(e);} finally {setPending(false);} }
 return <section className="panel fridge-panel"><div className="section-header"><div><span className="eyebrow">Твій запас продуктів</span><h2>Мій холодильник <span className="count">{fridge.length}</span></h2></div><button className="text-button danger-text" disabled={pending||!fridge.length} onClick={()=>setConfirm(true)}>Очистити холодильник</button></div>
 <IngredientCreator onCreated={async item=>{await onChanged();setSelected(s=>[...s,item.id]);setCategory("");setSearch("");setPicker(true);}} />
 <button className="button multi-picker-toggle" disabled={pending} aria-expanded={picker} onClick={()=>setPicker(!picker)}>Обрати кілька продуктів</button>
 {picker&&<div className="product-picker"><div className="ingredient-controls"><label>Пошук продуктів<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Назва продукту" /></label><label>Тип продуктів<select aria-label="Тип продуктів" value={category} onChange={e=>setCategory(e.target.value)}><option value="">Усі типи</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label></div>
 <div className="picker-tools"><span>Обрано: {selected.length}</span><button className="text-button" onClick={()=>setSelected(s=>[...new Set([...s,...visible.map(x=>x.id)])].slice(0,200))}>Обрати знайдені</button><button className="text-button" onClick={()=>setSelected([])}>Скинути вибір</button></div>
 <div className="product-options">{visible.map(x=><label key={x.id}><input type="checkbox" aria-label={"Додати "+x.name} checked={selected.includes(x.id)} disabled={pending||(!selected.includes(x.id)&&selected.length>=200)} onChange={()=>setSelected(s=>s.includes(x.id)?s.filter(id=>id!==x.id):[...s,x.id])}/><span className="ingredient-icon" aria-hidden="true">{x.emoji||"🥣"}</span><span>{x.name}<small>{x.category}</small></span></label>)}{!visible.length&&<p className="muted">Немає продуктів за цим пошуком.</p>}</div>
 <button className="button" disabled={pending||!selected.length} onClick={()=>void mutate("/fridge/bulk","POST",{ingredientIds:selected.filter(id=>!owned.has(id))})}>Додати обрані</button></div>}
 {!!fridge.length&&<div className="picker-tools"><label><input type="checkbox" aria-label="Обрати всі продукти в холодильнику" checked={removed.length===fridge.length} onChange={e=>setRemoved(e.target.checked?fridge.slice(0,200).map(x=>x.id):[])}/> Обрати всі</label><button className="text-button danger-text" disabled={pending||!removed.length} onClick={()=>void mutate("/fridge/selected","DELETE",{ids:removed})}>Видалити обрані</button></div>}
 <div className="pills">{fridge.map(x=><span className="pill" key={x.id}><label><input type="checkbox" aria-label={"Обрати "+x.ingredient.name} checked={removed.includes(x.id)} onChange={()=>setRemoved(s=>s.includes(x.id)?s.filter(id=>id!==x.id):[...s,x.id].slice(0,200))}/><span className="ingredient-icon">{x.ingredient.emoji||"🥣"}</span>{x.ingredient.name}<small className="category-tag">{x.ingredient.category}</small></label><button disabled={pending} aria-label={"Видалити "+x.ingredient.name} onClick={()=>void mutate("/fridge/"+x.id,"DELETE")}>×</button></span>)}</div>
 {!fridge.length&&<p className="muted">Холодильник порожній. Додайте перший інгредієнт.</p>}
 {confirm&&<div role="alertdialog" className="fridge-confirm"><p>Видалити всі продукти?</p><button className="button" disabled={pending} onClick={()=>void mutate("/fridge","DELETE")}>Так, видалити продукти</button><button className="button button-outline" onClick={()=>setConfirm(false)}>Скасувати</button></div>}
 </section>;
}
