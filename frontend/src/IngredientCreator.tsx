import { useEffect, useState } from "react";
import { api } from "./api";
import type { Ingredient } from "./types";

export function IngredientCreator({ onCreated }: { onCreated: (item: Ingredient) => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [emoji, setEmoji] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Овочі");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    let active = true;
    api<string[]>("/ingredients/categories").then(items => { if (active) setCategories(items); }).catch(() => { if (active) setError("Не вдалося завантажити категорії. Закрийте форму та спробуйте ще раз."); });
    return () => { active = false; };
  }, [open]);
  async function create() {
    if (pending || name.trim().length < 2) return;
    setPending(true); setError("");
    try {
      const item = await api<Ingredient>("/ingredients", { method: "POST", body: JSON.stringify({ name, category, ...(emoji.trim() ? { emoji: emoji.trim() } : {}) }) });
      await onCreated(item); setName(""); setEmoji(""); setOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Не вдалося створити інгредієнт"); }
    finally { setPending(false); }
  }
  return <div className="ingredient-creator">
    <button type="button" className="text-button" disabled={pending} aria-expanded={open} onClick={() => { setOpen(!open); setError(""); }}>{open ? "Закрити створення інгредієнта" : "+ Новий інгредієнт"}</button>
    {open && <div className="product-picker">
      <p className="muted">Новий продукт з’явиться у спільному каталозі для холодильника та рецептів.</p>
      <div className="ingredient-controls"><label>Назва інгредієнта<input value={name} maxLength={100} disabled={pending} onChange={e => setName(e.target.value)} placeholder="Наприклад, чорниця" /></label>
      <label>Категорія інгредієнта<select aria-label="Категорія інгредієнта" value={category} disabled={pending || !categories.length} onChange={e => setCategory(e.target.value)}>{categories.map(value => <option key={value}>{value}</option>)}</select></label></div>
      <label>Емодзі продукту (необов’язково)<input value={emoji} maxLength={32} onChange={e => setEmoji(e.target.value)} placeholder="🥑" /></label>
      <div className="ingredient-controls"><label>Нова категорія<input value={newCategory} maxLength={80} onChange={e => setNewCategory(e.target.value)} /></label><button type="button" className="button button-outline" disabled={pending || newCategory.trim().length < 2} onClick={async () => { setPending(true); setError(""); try { const created = await api<{name:string}>("/ingredients/categories", { method:"POST", body:JSON.stringify({name:newCategory}) }); setCategories(previous => [...previous,created.name]); setCategory(created.name); setNewCategory(""); } catch(e) { setError(e instanceof Error ? e.message : "Не вдалося створити категорію"); } finally { setPending(false); } }}>Додати категорію</button></div>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="button" className="button button-small" disabled={pending || name.trim().length < 2 || !categories.length} onClick={() => void create()}>{pending ? "Зберігаємо…" : "Створити інгредієнт"}</button>
    </div>}
  </div>;
}
