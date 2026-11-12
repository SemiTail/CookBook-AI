import {NutritionBreakdown} from "../NutritionBreakdown";
import {useLocalDraft} from "../useLocalDraft";
import { IngredientSelection } from "../IngredientSelection";
import { PhotoUpload } from "../PhotoUpload";
import { RecipeAuthors, type RecipePerson } from "../RecipeAuthors";
import { MarkdownEditor } from "../Markdown";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, getSession } from "../api";
import { calculateNutrition } from "../nutrition";
import type { Ingredient, Recipe } from "../types";

const emojis = ["🍳", "🥗", "🍲", "🍝", "🍕", "🍔", "🥪", "🌮", "🍜", "🍣", "🍚", "🍗", "🥩", "🐟", "🍄", "🥔", "🫘", "🎃", "🥞", "🧇", "🥣", "🍞", "🥐", "🥟", "🍰", "🧁", "🍪", "🍨", "🍓", "🍌", "🥤", "🍽️"];
type IngredientRow = { ingredientId: string; quantity: string; unit: string; optional: boolean };
const emptyRow = (): IngredientRow => ({ ingredientId: "", quantity: "", unit: "г", optional: false });
const nutrients = [
  { key: "calories", label: "Калорійність, ккал", max: 100000 },
  { key: "protein", label: "Білки, г", max: 10000 },
  { key: "fat", label: "Жири, г", max: 10000 },
  { key: "carbs", label: "Вуглеводи, г", max: 10000 },
] as const;
type Nutrition = Record<typeof nutrients[number]["key"], string>;

export function RecipeEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<Ingredient[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [canShare,setCanShare]=useState(true);
  const [isPublished, setIsPublished] = useState(false);
  const isModerator = getSession()?.user.role === "MODERATOR";
  const [emoji, setEmoji] = useState("🍽️");
  const [minutes, setMinutes] = useState("30");
  const [servings, setServings] = useState("1");
  const [nutrition, setNutrition] = useState<Nutrition>({ calories: "", protein: "", fat: "", carbs: "" });
  const [nutritionAuto,setNutritionAuto]=useState(true);
  const [nutritionError,setNutritionError]=useState("");
  const [difficulty, setDifficulty] = useState<Recipe["difficulty"]>("EASY");
  const [rows, setRows] = useState<IngredientRow[]>([]);
  const [authors,setAuthors]=useState<RecipePerson[]>([]);
  const [authorId,setAuthorId]=useState(getSession()?.user.id ?? "");
  const [original,setOriginal]=useState<RecipePerson|null>(null);
  const [mealType, setMealType] = useState("ANY");
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true); setReady(false); setError("");
    Promise.all([api<Ingredient[]>("/ingredients"), id ? api<Recipe>(`/recipes/${encodeURIComponent(id)}`) : Promise.resolve(null)])
      .then(([ingredients, recipe]) => {
        if (!active) return;
        if (recipe && !recipe.permissions?.editRecipes && recipe.authorId !== getSession()?.user.id && getSession()?.user.role !== "MODERATOR") throw new Error("Редагувати можна лише власні рецепти");
        setCanShare(!recipe||recipe.authorId===getSession()?.user.id||getSession()?.user.role==="MODERATOR"||!!recipe.permissions?.hideRecipes);
        setAuthorId(recipe?.authorId??getSession()?.user.id??"");setOriginal(recipe?.originalAuthorship?.user??null);setCatalog(ingredients); setMealType(recipe?.mealType ?? "ANY");
        setTitle(recipe?.title ?? ""); setDescription(recipe?.description ?? ""); setInstructions(recipe?.instructions ?? "");
        setImageUrl(recipe?.imageUrl ?? ""); setIsPublished(recipe?.isPublished ?? false); setIsShared(recipe?.isShared ?? false);
        setEmoji(recipe?.emoji ?? "🍽️"); setMinutes(String(recipe?.preparationMinutes ?? 30)); setServings(String(recipe?.servings ?? 1)); setDifficulty(recipe?.difficulty ?? "EASY");
        setNutritionAuto(recipe?.nutritionAuto??true);
        setNutrition({ calories: String(recipe?.calories ?? ""), protein: String(recipe?.protein ?? ""), fat: String(recipe?.fat ?? ""), carbs: String(recipe?.carbs ?? "") });
        setRows(recipe ? recipe.ingredients.map(item => ({ ingredientId: item.ingredientId, quantity: item.quantity === null ? "" : String(item.quantity), unit: item.unit ?? "", optional: item.optional })) : []);
        setReady(true);
      }).catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "Не вдалося завантажити рецепт"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  useEffect(()=>{if(!isModerator)return;let active=true;api<RecipePerson[]>("/recipes/authors").then(users=>{if(active)setAuthors(users);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[isModerator]);
  useEffect(()=>{if(!ready||!nutritionAuto)return;try{setNutrition(calculateNutrition(rows,catalog,Number(servings)));setNutritionError('');}catch(e){setNutrition({calories:'',protein:'',fat:'',carbs:''});setNutritionError((e as Error).message);}},[ready,nutritionAuto,rows,catalog,servings]);
  const draftValue=JSON.stringify({title,description,instructions,imageUrl,isShared,isPublished,emoji,minutes,servings,nutrition:nutritionAuto?null:nutrition,nutritionAuto,difficulty,rows,authorId,mealType});
  const draft=useLocalDraft('cookbook-recipe-draft:'+getSession()?.user.id+':'+(id??'new'),draftValue,ready);
  function restoreDraft(){try{const text=draft.restore();if(!text)return;const d=JSON.parse(text);if(!d||![d.title,d.description,d.instructions,d.imageUrl,d.emoji,d.minutes,d.servings,d.authorId,d.mealType].every(v=>typeof v==="string")||!Array.isArray(d.rows)||!d.rows.every((r:IngredientRow)=>r&&typeof r.ingredientId==="string"&&typeof r.quantity==="string"&&typeof r.unit==="string"&&typeof r.optional==="boolean"))throw new Error("invalid draft");setTitle(d.title);setDescription(d.description);setInstructions(d.instructions);setImageUrl(d.imageUrl);setIsShared(d.isShared);setIsPublished(d.isPublished);setEmoji(d.emoji);setMinutes(d.minutes);setServings(d.servings);setNutritionAuto(d.nutritionAuto);if(d.nutrition)setNutrition(d.nutrition);setDifficulty(d.difficulty);setRows(d.rows);setAuthorId(d.authorId);setMealType(d.mealType);}catch{setError('Чернетку пошкоджено. Відкрийте рецепт повторно.');}}
  function changeRow(index: number, patch: Partial<IngredientRow>) {
    setRows(previous => previous.map((row, i) => i === index ? { ...row, ...patch } : row));
  }
  useEffect(()=>{if(error)document.getElementById('recipe-editor-error')?.focus();},[error]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || uploading) return;
    if (!rows.length) { setError("Додайте хоча б один інгредієнт"); return; }
    if(nutritionAuto&&nutritionError){setError(nutritionError);return;}
    setSaving(true); setError("");
    try {
      const recipe = await api<Recipe>(id ? `/recipes/${encodeURIComponent(id)}` : "/recipes", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify({ nutritionAuto, mealType, isShared, title, description, instructions, emoji, imageUrl: imageUrl.trim() || null, ...(isModerator ? { isPublished, ...(authorId ? {authorId} : {}) } : {}), preparationMinutes: Number(minutes), servings: Number(servings), difficulty,
          ...Object.fromEntries(nutrients.map(({ key }) => [key, nutrition[key] === "" ? null : Number(nutrition[key])])),
          ingredients: rows.map(row => ({ ingredientId: row.ingredientId, ...(row.quantity === "" ? {} : { quantity: Number(row.quantity) }), unit: row.unit, optional: row.optional })) }),
      });
      draft.committed();
      navigate(`/recipes/${encodeURIComponent(recipe.id)}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Не вдалося зберегти рецепт"); }
    finally { setSaving(false); }
  }
  return <div className="recipe-editor">
    <Link className="back" to={id ? `/recipes/${encodeURIComponent(id)}` : "/dashboard"}>← Назад</Link>
    <h1>{id ? "Редагувати рецепт" : "Новий рецепт"}</h1>
    <p className="muted">Збережіть власний рецепт. Модератори можуть публікувати офіційні рецепти для всіх користувачів.</p>
    {loading && <p role="status">Завантажуємо форму…</p>}
    {error && <div id="recipe-editor-error" tabIndex={-1} className="error" role="alert">{error}<p>Введені дані залишилися у формі. Виправте причину та спробуйте знову.</p></div>}
    {ready&&<aside className="panel draft-notice" aria-label="Локальна чернетка">{draft.candidate?<><strong>Знайдено незбережену чернетку</strong><p>Збережена на цьому пристрої {new Date(draft.candidate.savedAt).toLocaleString('uk-UA')}. Відновлення не публікує рецепт.</p><div className="recipe-actions"><button type="button" className="button" onClick={restoreDraft}>Відновити чернетку</button><button type="button" className="button button-outline" onClick={draft.discard}>Відкинути чернетку</button></div></>:<p role="status">{draft.storageError|| (draft.savedAt?'Чернетку збережено на цьому пристрої · '+new Date(draft.savedAt).toLocaleTimeString('uk-UA'):draft.dirty?'Зберігаємо чернетку…':'Чернетка зберігатиметься автоматично на цьому пристрої.')}</p>}</aside>}
    {ready && !loading && <form className="panel recipe-form" onSubmit={submit}>
      <fieldset disabled={saving||!!draft.candidate}>
        {isModerator&&<section className="author-editor"><label>Автор рецепта<select aria-label="Автор рецепта" value={authorId} onChange={e=>setAuthorId(e.target.value)}>{authors.map(u=><option key={u.id} value={u.id}>{u.name} · {u.id.slice(0,8)}</option>)}</select></label><RecipeAuthors author={authors.find(u=>u.id===authorId)} original={original}/></section>}
        <div className="editor-title"><span className="emoji recipe-preview" aria-hidden="true">{emoji}</span><label>Назва страви<input required minLength={2} maxLength={160} value={title} onChange={e => setTitle(e.target.value)} /></label></div>
        <label>Емодзі страви<input className="emoji emoji-input" required maxLength={32} value={emoji} onChange={e => setEmoji(e.target.value)} aria-describedby="emoji-hint" /></label>
        <p id="emoji-hint" className="muted">Оберіть емодзі зі списку або вставте власний.</p>
        <div className="emoji-picker" role="group" aria-label="Вибір емодзі">{emojis.map(value => <button key={value} type="button" className="emoji" aria-label={`Обрати ${value}`} aria-pressed={emoji === value} onClick={() => setEmoji(value)}>{value}</button>)}</div>
        <PhotoUpload value={imageUrl} onChange={setImageUrl} onBusy={setUploading} disabled={saving} emoji={emoji} title={title}/>
        <label>Фото страви (URL, необов’язково)<input type="url" maxLength={2048} value={imageUrl.startsWith("/api/v1/photos/") ? "" : imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://example.com/dish.jpg" disabled={uploading} /></label>
        <label className="check-label"><input type="checkbox" disabled={!canShare} checked={isShared} onChange={e=>setIsShared(e.target.checked)} />Показувати в браузері рецептів спільноти</label>
        {isModerator && <label className="check-label"><input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} />Опублікувати офіційний рецепт</label>}
        <MarkdownEditor label="Короткий опис" value={description} onChange={setDescription} maxLength={2000} />
        <label>Прийом їжі<select aria-label="Прийом їжі" value={mealType} onChange={e=>setMealType(e.target.value)}><option value="ANY">Не вказано</option><option value="BREAKFAST">Сніданок</option><option value="LUNCH">Обід</option><option value="DINNER">Вечеря</option><option value="SNACK">Перекус</option><option value="DESSERT">Десерт</option></select></label>
        <div className="editor-columns">
          <label>Час приготування, хв<input type="number" required min={1} max={10080} step={1} value={minutes} onChange={e => setMinutes(e.target.value)} /></label>
          <label>Кількість порцій<input type="number" required min={1} max={1000} step={1} value={servings} onChange={e => setServings(e.target.value)} /></label>
          <label>Складність<select value={difficulty} onChange={e => setDifficulty(e.target.value as Recipe["difficulty"])}><option value="EASY">Просто</option><option value="MEDIUM">Середньо</option><option value="HARD">Складно</option></select></label>
        </div>
        <section aria-labelledby="nutrition-title" className="nutrition-editor">
          <h2 id="nutrition-title">Харчова цінність на порцію</h2>
          <label className="check-label"><input type="checkbox" checked={nutritionAuto} onChange={e=>setNutritionAuto(e.target.checked)}/>Автоматично розраховувати КБЖВ</label>
          <button type="button" className="button button-outline" onClick={()=>{setNutritionAuto(true);try{setNutrition(calculateNutrition(rows,catalog,Number(servings)));setNutritionError('');}catch(e){setNutritionError((e as Error).message);}}}>Розрахувати КБЖВ з інгредієнтів</button>
          <p className="muted">Значення на одну порцію автоматично оновлюються при зміні складу, маси та порцій. За відсутності точного показника використовується середина діапазону — результат орієнтовний. Для шт. і мл потрібні маса штуки та густина в каталозі.</p>
          {nutritionAuto&&nutritionError&&<p role="status" className="muted">{nutritionError}</p>}
          <div className="nutrition-fields">{nutrients.map(({ key, label, max }) => <label key={key}>{label}<input aria-label={label} type="number" min={0} max={max} step="0.01" inputMode="decimal" placeholder="Не вказано" readOnly={nutritionAuto} value={nutrition[key]} onChange={e => setNutrition(previous => ({ ...previous, [key]: e.target.value }))} /></label>)}</div>
        </section>
        {nutritionAuto&&<NutritionBreakdown rows={rows} catalog={catalog} servings={Number(servings)}/>}
        <h2>Інгредієнти</h2>
        <IngredientSelection ingredients={catalog} excluded={rows.map(r=>r.ingredientId)} pending={saving} limit={100-rows.length} onCreated={async()=>setCatalog(await api<Ingredient[]>("/ingredients"))} onDeleted={id=>{setCatalog(previous=>previous.filter(x=>x.id!==id));setRows(previous=>previous.filter(x=>x.ingredientId!==id));}} onConfirm={ids=>setRows(previous=>[...previous,...ids.map(ingredientId=>({...emptyRow(),ingredientId}))])}/>

        {rows.map((row, index) => <div className="editor-ingredient" key={index}>
          <span className="chosen-product"><span className="ingredient-icon">{catalog.find(x=>x.id===row.ingredientId)?.emoji||"🥣"}</span>{catalog.find(x=>x.id===row.ingredientId)?.name}</span>
          <label>Кількість {index + 1}<input type="number" min={0} max={1000000} step="any" value={row.quantity} onChange={e => changeRow(index, { quantity: e.target.value })} /></label>
          <label>Одиниця {index + 1}<input maxLength={30} value={row.unit} placeholder="г, мл, шт." onChange={e => changeRow(index, { unit: e.target.value })} /></label>
          <label className="check-label"><input type="checkbox" checked={row.optional} onChange={e => changeRow(index, { optional: e.target.checked })} />Необов’язковий</label>
          <button type="button" className="button button-outline" disabled={rows.length <= 1} aria-label={`Прибрати інгредієнт ${index + 1}`} onClick={() => setRows(previous => previous.filter((_, i) => i !== index))}>×</button>
        </div>)}
        <MarkdownEditor label="Спосіб приготування" value={instructions} onChange={setInstructions} minLength={3} />
        <div className="recipe-actions"><button className="button" disabled={saving||uploading}>{saving ? "Зберігаємо…" : uploading ? "Завантажуємо фото…" : "Зберегти рецепт"}</button><Link className="button button-outline" to={id ? `/recipes/${encodeURIComponent(id)}` : "/dashboard"}>Скасувати</Link></div>
      </fieldset>
    </form>}
  </div>;
}


