import { FavoriteButton } from "../FavoriteButton";
import { Markdown } from "../Markdown";
import { RecipeDiscussion } from "../RecipeDiscussion";
import type { FridgeItem } from "../types";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, getSession } from "../api";
import { RecipeImage } from "../RecipeImage";
import type { Recipe } from "../types";

export function RecipePage() {
  const { id } = useParams();
  const [shareStatus, setShareStatus] = useState("");
  const [checked, setChecked] = useState<string[]>([]);
  const [fridge, setFridge] = useState<FridgeItem[] | null>(null);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const owned = recipe?.authorId === getSession()?.user.id;

  async function remove() {
    if (!recipe || deleting) return;
    setDeleting(true); setError("");
    try { await api(`/recipes/${encodeURIComponent(recipe.id)}`, { method: "DELETE" }); navigate("/dashboard"); }
    catch (e) { setError(e instanceof Error ? e.message : "Не вдалося видалити рецепт"); }
    finally { setDeleting(false); }
  }

  useEffect(() => {
    let active = true;
    setRecipe(null);
    setError("");
    setConfirmDelete(false);

    setFridge(null);
    api<FridgeItem[]>("/fridge").then(items=>{if(active)setFridge(items);}).catch(()=>{});
    if (id) {
      api<Recipe>(`/recipes/${encodeURIComponent(id)}`)
        .then((result) => {
          if (active) setRecipe(result);
        })
        .catch((e: unknown) => {
          if (active) {
            setError(
              e instanceof Error ? e.message : "Не вдалося відкрити рецепт",
            );
          }
        });
    } else {
      setError("Не вказано ідентифікатор рецепта");
    }

    return () => {
      active = false;
    };
  }, [id]);

  return (
    <div className="recipe-detail">
      <Link to="/dashboard" className="back">
        ← Повернутися до каталогу
      </Link>

      {error && <div className="error" role="alert">{error}</div>}
      {!recipe && !error && <p>Завантаження рецепта…</p>}

      {recipe && (
        <>
          <div className="detail-heading"><div><span className="eyebrow">Кулінарна книга / Рецепт</span><h1>{recipe.title}</h1><Markdown>{recipe.description || ""}</Markdown></div><div className="recipe-actions"><FavoriteButton id={recipe.id}/><button className="button button-outline" onClick={async()=>{try{await navigator.clipboard.writeText(window.location.href);setShareStatus("Посилання скопійовано");}catch{setShareStatus("Скопіюйте адресу рецепта з рядка браузера");}}}>↗ Поділитися</button></div></div>{shareStatus&&<p role="status">{shareStatus}</p>}
          <div className="detail-hero">
            <RecipeImage url={recipe.imageUrl} title={recipe.title} emoji={recipe.emoji} detail />
            <div className="dish-info"><h2>♧ Про страву</h2><span className="eyebrow">{recipe.isPublished ? "Офіційний рецепт" : recipe.isShared ? "Рецепт спільноти" : "Особистий рецепт"}</span>

            <div className="recipe-meta">
              <span>⏱️ {recipe.preparationMinutes} хв</span>
              <span>◈ {{ EASY: "Просто", MEDIUM: "Середньо", HARD: "Складно" }[recipe.difficulty]}</span>
              <span>🍴 {recipe.servings} порцій</span>
              <span>🔥 {recipe.calories ?? "—"} ккал/порція</span>
            </div><h3>КБЖВ на 1 порцію</h3><div className="nutrition-summary">{[["Ккал",recipe.calories],["Білки",recipe.protein],["Жири",recipe.fat],["Вуглеводи",recipe.carbs]].map(([label,value])=><div key={label}><small>{label}</small><strong>{value??"—"}{label!=="Ккал"&&value!==null?" г":""}</strong></div>)}</div></div>
          </div>

          {owned && <div className="recipe-actions owner-actions"><Link className="button" to={`/recipes/${encodeURIComponent(recipe.id)}/edit`}>Редагувати рецепт</Link><button className="button button-danger" onClick={() => setConfirmDelete(true)}>Видалити рецепт</button><span className="muted">{recipe.isPublished ? "Опублікований рецепт" : recipe.isShared ? "Рецепт доступний спільноті" : "Особистий рецепт · доступний лише вам"}</span></div>}
          {owned && confirmDelete && <section className="delete-confirm panel" role="alertdialog" aria-labelledby="delete-title"><h2 id="delete-title">Видалити «{recipe.title}»?</h2><p>Рецепт та його інгредієнти буде видалено з вашої книги. Цю дію не можна скасувати.</p><div className="recipe-actions"><button className="button button-danger" disabled={deleting} onClick={remove}>{deleting ? "Видаляємо…" : "Так, видалити"}</button><button className="button button-outline" disabled={deleting} onClick={() => setConfirmDelete(false)}>Залишити рецепт</button></div></section>}

          {fridge && <section className="panel missing-products"><h2>Що потрібно докупити</h2><div className="pills">{recipe.ingredients.filter(item=>!item.optional&&!fridge.some(f=>f.ingredientId===item.ingredientId)).map(item=><span className="pill missing-pill" key={item.ingredientId}><span className="ingredient-icon">{item.ingredient.emoji||"🥣"}</span>{item.ingredient.name}<small>{item.quantity !== null ? item.quantity+" "+(item.unit??"") : ""}</small></span>)}</div>{recipe.ingredients.every(item=>item.optional||fridge.some(f=>f.ingredientId===item.ingredientId))&&<p className="available-note">✓ Усі обов’язкові продукти є у холодильнику</p>}<small className="muted">Перевіряється наявність продуктів; достатність кількості не враховується.</small></section>}
          <div className="detail-grid">
            <section className="panel">
              <h2>Інгредієнти</h2>
              <ul className="ingredients-list">
                {recipe.ingredients.map((item) => (
                  <li key={item.ingredientId}>
                    <span>
                      <input type="checkbox" aria-label={"Підготовлено "+item.ingredient.name} checked={checked.includes(item.ingredientId)} onChange={()=>setChecked(previous=>previous.includes(item.ingredientId)?previous.filter(id=>id!==item.ingredientId):[...previous,item.ingredientId])} /> {item.ingredient.name}
                      {item.optional ? " (необов’язково)" : ""}
                    </span>
                    <strong>
                      {item.quantity ?? "—"} {item.unit ?? ""}
                    </strong>
                  </li>
                ))}
              </ul>
              <p className="muted">
                КБЖУ на порцію: Б {recipe.protein ?? "—"} г · Ж{" "}
                {recipe.fat ?? "—"} г · В {recipe.carbs ?? "—"} г
              </p>
            </section>

            <section className="panel">
              <h2>Спосіб приготування</h2>
              <Markdown>{recipe.instructions}</Markdown>

            </section>
          </div>
          <RecipeDiscussion key={recipe.id} id={recipe.id} />
        </>
      )}
    </div>
  );
}
