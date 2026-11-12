import {IngredientManager} from "./IngredientManager";
import {useState} from "react";
import {IngredientCreator} from "./IngredientCreator";
import {ProductPicker} from "./ProductPicker";
import type {Ingredient} from "./types";
export function IngredientSelection({ingredients,excluded,onConfirm,onCreated,onDeleted,pending=false,limit=200}:{ingredients:Ingredient[];excluded:string[];onConfirm:(ids:string[])=>void|Promise<void>;onCreated:(item:Ingredient)=>void|Promise<void>;onDeleted:(id:string)=>void;pending?:boolean;limit?:number}) {
 const [open,setOpen]=useState(false);
 return <div className="ingredient-selection"><IngredientManager ingredients={ingredients} onChanged={onCreated}/><IngredientCreator onCreated={async item=>{await onCreated(item);setOpen(true);}}/><button type="button" className="button multi-picker-toggle" disabled={pending} aria-expanded={open} onClick={()=>setOpen(!open)}>Обрати кілька продуктів</button>{open&&<ProductPicker ingredients={ingredients} excluded={excluded} pending={pending} limit={limit} onDeleted={onDeleted} onConfirm={async ids=>{await onConfirm(ids);setOpen(false);}}/>}</div>;
}
