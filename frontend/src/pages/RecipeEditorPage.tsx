import { MarkdownEditor } from "../Markdown";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { IngredientCreator } from "../IngredientCreator";
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
  const [isPublished, setIsPublished] = useState(false);
  const isModerator = getSession()?.user.role === "MODERATOR";
  const [emoji, setEmoji] = useState("🍽️");
  const [minutes, setMinutes] = useState("30");
  const [servings, setServings] = useState("1");
  const [nutrition, setNutrition] = useState<Nutrition>({ calories: "", protein: "", fat: "", carbs: "" });
  const [difficulty, setDifficulty] = useState<Recipe["difficulty"]>("EASY");
  const [rows, setRows] = useState<IngredientRow[]>([emptyRow()]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true); setReady(false); setError("");
    Promise.all([api<Ingredient[]>("/ingredients"), id ? api<Recipe>(`/recipes/${encodeURIComponent(id)}`) : Promise.resolve(null)])
      .then(([ingredients, recipe]) => {
        if (!active) return;
        if (recipe && recipe.authorId !== getSession()?.user.id) throw new Error("Редагувати можна лише власні рецепти");
        setCatalog(ingredients);
        setTitle(recipe?.title ?? ""); setDescription(recipe?.description ?? ""); setInstructions(recipe?.instructions ?? "");
        setImageUrl(recipe?.imageUrl ?? ""); setIsPublished(recipe?.isPublished ?? false); setIsShared(recipe?.isShared ?? false);
        setEmoji(recipe?.emoji ?? "🍽️"); setMinutes(String(recipe?.preparationMinutes ?? 30)); setServings(String(recipe?.servings ?? 1)); setDifficulty(recipe?.difficulty ?? "EASY");
        setNutrition({ calories: String(recipe?.calories ?? ""), protein: String(recipe?.protein ?? ""), fat: String(recipe?.fat ?? ""), carbs: String(recipe?.carbs ?? "") });
        setRows(recipe ? recipe.ingredients.map(item => ({ ingredientId: item.ingredientId, quantity: item.quantity === null ? "" : String(item.quantity), unit: item.unit ?? "", optional: item.optional })) : [emptyRow()]);
        setReady(true);
      }).catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "Не вдалося завантажити рецепт"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  function changeRow(index: number, patch: Partial<IngredientRow>) {
    setRows(previous => previous.map((row, i) => i === index ? { ...row, ...patch } : row));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError("");
    try {
      const recipe = await api<Recipe>(id ? `/recipes/${encodeURIComponent(id)}` : "/recipes", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify({ isShared, title, description, instructions, emoji, imageUrl: imageUrl.trim() || null, ...(isModerator ? { isPublished } : {}), preparationMinutes: Number(minutes), servings: Number(servings), difficulty,
          ...Object.fromEntries(nutrients.map(({ key }) => [key, nutrition[key] === "" ? null : Number(nutrition[key])])),
          ingredients: rows.map(row => ({ ingredientId: row.ingredientId, ...(row.quantity === "" ? {} : { quantity: Number(row.quantity) }), unit: row.unit, optional: row.optional })) }),
      });
      navigate(`/recipes/${encodeURIComponent(recipe.id)}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Не вдалося зберегти рецепт"); }
    finally { setSaving(false); }
  }
  return <div className="recipe-editor">
    <Link className="back" to={id ? `/recipes/${encodeURIComponent(id)}` : "/dashboard"}>← Назад</Link>
    <h1>{id ? "Редагувати рецепт" : "Новий рецепт"}</h1>
    <p className="muted">Збережіть власний рецепт. Модератори можуть публікувати офіційні рецепти для всіх користувачів.</p>
    {loading && <p role="status">Завантажуємо форму…</p>}
    {error && <div className="error" role="alert">{error}</div>}
    {ready && !loading && <form className="panel recipe-form" onSubmit={submit}>
      <fieldset disabled={saving}>
        <div className="editor-title"><span className="emoji recipe-preview" aria-hidden="true">{emoji}</span><label>Назва страви<input required minLength={2} maxLength={160} value={title} onChange={e => setTitle(e.target.value)} /></label></div>
        <label>Емодзі страви<input className="emoji emoji-input" required maxLength={32} value={emoji} onChange={e => setEmoji(e.target.value)} aria-describedby="emoji-hint" /></label>
        <p id="emoji-hint" className="muted">Оберіть емодзі зі списку або вставте власний.</p>
        <div className="emoji-picker" role="group" aria-label="Вибір емодзі">{emojis.map(value => <button key={value} type="button" className="emoji" aria-label={`Обрати ${value}`} aria-pressed={emoji === value} onClick={() => setEmoji(value)}>{value}</button>)}</div>
        <label>Фото страви (URL)<input type="url" maxLength={2048} value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://example.com/dish.jpg" required={isPublished} /></label>
        <label className="check-label"><input type="checkbox" checked={isShared} onChange={e=>setIsShared(e.target.checked)} />Показувати в браузері рецептів спільноти</label>
        {isModerator && <label className="check-label"><input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} />Опублікувати офіційний рецепт</label>}
        <MarkdownEditor label="Короткий опис" value={description} onChange={setDescription} maxLength={2000} />
        <div className="editor-columns">
          <label>Час приготування, хв<input type="number" required min={1} max={10080} step={1} value={minutes} onChange={e => setMinutes(e.target.value)} /></label>
          <label>Кількість порцій<input type="number" required min={1} max={1000} step={1} value={servings} onChange={e => setServings(e.target.value)} /></label>
          <label>Складність<select value={difficulty} onChange={e => setDifficulty(e.target.value as Recipe["difficulty"])}><option value="EASY">Просто</option><option value="MEDIUM">Середньо</option><option value="HARD">Складно</option></select></label>
        </div>
        <section aria-labelledby="nutrition-title" className="nutrition-editor">
          <h2 id="nutrition-title">Харчова цінність на порцію</h2>
          <button type="button" className="button button-outline" onClick={() => { try { setNutrition(calculateNutrition(rows, catalog, Number(servings))); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Не вдалося розрахувати КБЖВ"); } }}>Розрахувати КБЖВ з інгредієнтів</button>
          <p className="muted">Автоматичний розрахунок враховує масу всіх інгредієнтів у г/кг та кількість порцій. Це орієнтовні значення. Вкажіть калорійність, білки, жири та вуглеводи вручну. Залиште поле порожнім, якщо значення невідоме.</p>
          <div className="nutrition-fields">{nutrients.map(({ key, label, max }) => <label key={key}>{label}<input aria-label={label} type="number" min={0} max={max} step="0.01" inputMode="decimal" placeholder="Не вказано" value={nutrition[key]} onChange={e => setNutrition(previous => ({ ...previous, [key]: e.target.value }))} /></label>)}</div>
        </section>
        <h2>Інгредієнти</h2>
        <IngredientCreator onCreated={item => { setCatalog(previous => [...previous, item].sort((a, b) => a.name.localeCompare(b.name, "uk"))); setRows(previous => previous.some(row => !row.ingredientId) ? previous.map((row, index) => index === previous.findIndex(value => !value.ingredientId) ? { ...row, ingredientId: item.id } : row) : [...previous, { ...emptyRow(), ingredientId: item.id }]); }} />
        {rows.map((row, index) => <div className="editor-ingredient" key={index}>
          <label>Продукт {index + 1}<select aria-label={`Продукт ${index + 1}`} required value={row.ingredientId} onChange={e => changeRow(index, { ingredientId: e.target.value })}><option value="">Оберіть продукт…</option>{catalog.filter(item => item.id === row.ingredientId || !rows.some(r => r.ingredientId === item.id)).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Кількість {index + 1}<input type="number" min={0} max={1000000} step="any" value={row.quantity} onChange={e => changeRow(index, { quantity: e.target.value })} /></label>
          <label>Одиниця {index + 1}<input maxLength={30} value={row.unit} placeholder="г, мл, шт." onChange={e => changeRow(index, { unit: e.target.value })} /></label>
          <label className="check-label"><input type="checkbox" checked={row.optional} onChange={e => changeRow(index, { optional: e.target.checked })} />Необов’язковий</label>
          <button type="button" className="button button-outline" disabled={rows.length <= 1} aria-label={`Прибрати інгредієнт ${index + 1}`} onClick={() => setRows(previous => previous.filter((_, i) => i !== index))}>×</button>
        </div>)}
        <button type="button" className="button button-outline" disabled={rows.length >= 100 || rows.length >= catalog.length} onClick={() => setRows(previous => [...previous, emptyRow()])}>+ Інгредієнт</button>
        <MarkdownEditor label="Спосіб приготування" value={instructions} onChange={setInstructions} minLength={3} />
        <div className="recipe-actions"><button className="button" disabled={saving}>{saving ? "Зберігаємо…" : "Зберегти рецепт"}</button><Link className="button button-outline" to={id ? `/recipes/${encodeURIComponent(id)}` : "/dashboard"}>Скасувати</Link></div>
      </fieldset>
    </form>}
  </div>;
}


