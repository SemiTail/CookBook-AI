import { useState } from "react";
import { api } from "./api";
import { RecipeImage } from "./RecipeImage";

export function PhotoUpload({value,onChange,onBusy,disabled,emoji,title}:{value:string;onChange:(url:string)=>void;onBusy:(busy:boolean)=>void;disabled:boolean;emoji:string;title:string}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 return <section className="photo-upload"><h2>Фото страви</h2><p className="muted">Фото необов’язкове: без нього відображається емодзі. JPG, PNG або WebP, до 2,5 МБ.</p>
 <label>Завантажити своє фото<input type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled||busy} onChange={async e=>{
   const file=e.target.files?.[0];e.target.value="";setError("");if(!file)return;
   if(file.size>2500000){setError("Фото перевищує допустимі 2,5 МБ");return;}
   if(!["image/jpeg","image/png","image/webp"].includes(file.type)){setError("Оберіть фото JPG, PNG або WebP");return;}
   setBusy(true);onBusy(true);try{const form=new FormData();form.append("photo",file);const result=await api<{imageUrl:string}>("/photos",{method:"POST",body:form});onChange(result.imageUrl);}catch(e){setError(e instanceof Error?e.message:"Не вдалося завантажити фото");}finally{setBusy(false);onBusy(false);}
 }}/></label>
 {busy&&<p role="status">Завантажуємо фото…</p>}{error&&<p className="error" role="alert">{error}</p>}
 {value&&<><div className="photo-upload-preview"><RecipeImage url={value} title={title||"Фото страви"} emoji={emoji}/></div><button type="button" className="button button-outline" disabled={disabled||busy} onClick={()=>onChange("")}>Прибрати фото</button></>}
 </section>;
}
