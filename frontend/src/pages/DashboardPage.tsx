import { Markdown } from "../Markdown";
import { RecipeImage } from "../RecipeImage";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api";
import type { FridgeItem, Ingredient, Recipe, User } from "../types";
import { AssistantChat, type ChatMode } from "../AssistantChat";
import { FridgePanel } from "../FridgePanel";

export function DashboardPage({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState("");
  const [minutes, setMinutes] = useState(0);
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [sort, setSort] = useState("title");
  const [view, setView] = useState("grid");
  const [tab, setTab] = useState("ready");
  const [community, setCommunity] = useState<Recipe[]>([]);
  const [myRecipes, setMyRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [fridge, setFridge] = useState<FridgeItem[]>([]);
  const [suggestions, setSuggestions] = useState<Recipe[]>([]);
  const [chatMode, setChatMode] = useState<ChatMode>("closed");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const handleError = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.status === 401) onUnauthorized();
    else setError(e instanceof Error ? e.message : "Помилка завантаження");
  }, [onUnauthorized]);

  const refresh = useCallback(async () => {
    try {
      const [items, matches, catalog] = await Promise.all([api<FridgeItem[]>("/fridge"), api<Recipe[]>("/recommendations"), api<Ingredient[]>("/ingredients")]);
      setFridge(items); setSuggestions(matches); setIngredients(catalog); setError("");
    } catch (e) { handleError(e); }
  }, [handleError]);

  useEffect(() => {
    let active = true;
    Promise.all([api<User>("/users/me"), api<Recipe[]>("/recipes"), api<Ingredient[]>("/ingredients"), api<FridgeItem[]>("/fridge"), api<Recipe[]>("/recommendations"), api<Recipe[]>("/recipes/mine"), api<Recipe[]>("/recipes/community")])
      .then(([me, r, i, items, matches, mine, shared]) => { if (active) { setUser(me); setRecipes(r); setIngredients(i); setFridge(items); setSuggestions(matches); setMyRecipes(mine); setCommunity(shared); } })
      .catch((e: unknown) => { if (active) handleError(e); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [handleError]);

  const displayed = (tab === "mine" ? myRecipes : tab === "official" ? recipes : tab === "community" ? community : suggestions)
    .filter(r => r.title.toLocaleLowerCase("uk").includes(search.toLocaleLowerCase("uk")) && (!minutes || r.preparationMinutes <= minutes) && (!difficultyFilter || r.difficulty === difficultyFilter))
    .sort((a,b) => sort === "time" ? a.preparationMinutes-b.preparationMinutes : sort === "calories" ? (a.calories??Infinity)-(b.calories??Infinity) : a.title.localeCompare(b.title,"uk"));
  return <>
    <div className="dashboard-heading"><section className="welcome"><span className="eyebrow">Твоя кулінарна книга</span><h1>Вітаємо{user ? `, ${user.name}` : ""} 👋</h1><p>Обери продукти, які маєш, і знайди страву на сьогодні.</p></section><button className="button assistant-toggle" aria-expanded={chatMode === "open"} onClick={() => setChatMode(mode => mode === "open" ? "closed" : "open")}>✦ ШІ-помічник</button></div>
    {user && <p className="muted">Ви увійшли як {user.email}</p>}
    {user?.role === "MODERATOR" && <p className="eyebrow">Модератор · публікація офіційних рецептів у формі створення та редагування</p>}
    {error && <div className="error" role="alert">{error} <button onClick={() => window.location.reload()}>Повторити</button></div>}
    {loading ? <p>Завантажуємо дані…</p> : <div className={`dashboard-layout ${chatMode === "open" ? "is-chat-open" : ""}`}><div className="dashboard-content">
      <FridgePanel fridge={fridge} ingredients={ingredients} onChanged={refresh} onError={handleError} />
      <section className="recipes-section">
        <div className="section-header"><h2>Каталог рецептів</h2><Link className="button" to="/recipes/new">+ Створити рецепт</Link></div>
        <div className="recipe-tabs" role="tablist" aria-label="Види рецептів">{[["mine","Свої"],["official","Офіційні"],["ready","Що можна приготувати"],["community","Браузер рецептів"]].map(([key,label]) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? "button" : "button button-outline"} onClick={() => setTab(key)}>{label}</button>)}</div>
        <label className="catalog-search">Пошук рецептів<input type="search" placeholder="Знайдіть свою наступну улюблену страву…" value={search} onChange={e=>setSearch(e.target.value)} /></label>
        <div className="catalog-layout"><aside className="catalog-filters"><h3>Фільтри</h3><label>Час приготування<select value={minutes} onChange={e=>setMinutes(Number(e.target.value))}><option value={0}>Будь-який час</option><option value={15}>До 15 хв</option><option value={30}>До 30 хв</option><option value={60}>До 60 хв</option></select></label><label>Складність<select value={difficultyFilter} onChange={e=>setDifficultyFilter(e.target.value)}><option value="">Будь-яка</option><option value="EASY">Просто</option><option value="MEDIUM">Середньо</option><option value="HARD">Складно</option></select></label><button className="button button-outline" onClick={()=>{setSearch("");setMinutes(0);setDifficultyFilter("");}}>Очистити фільтри</button></aside><div>
        <div className="catalog-tools"><span>Знайдено рецептів: <strong>{displayed.length}</strong></span><label>Сортування<select value={sort} onChange={e=>setSort(e.target.value)}><option value="title">За назвою</option><option value="time">Спочатку швидкі</option><option value="calories">За калорійністю</option></select></label><button className="button button-outline" aria-label="Перемкнути вигляд каталогу" onClick={()=>setView(view==="grid"?"list":"grid")}>{view==="grid"?"☷":"▦"}</button></div>
        <div role="tabpanel"><div className={"cards catalog-"+view}>{displayed.map(recipe => <RecipeCard key={recipe.id} recipe={recipe} />)}</div>
        {!displayed.length && <p className="empty">У цьому розділі поки немає рецептів.</p>}</div></div></div>
      </section>
    </div><AssistantChat mode={chatMode} onMode={setChatMode} fridgeCount={fridge.length} /></div>}
  </>;
}

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const difficulty: Record<Recipe["difficulty"], string> = { EASY: "Просто", MEDIUM: "Середньо", HARD: "Складно" };
  return <Link className="recipe-card" to={`/recipes/${encodeURIComponent(recipe.id)}`}>
    <RecipeImage url={recipe.imageUrl} title={recipe.title} emoji={recipe.emoji} />
    <div className="recipe-content"><h3>{recipe.title}</h3><div className="card-description"><Markdown compact>{recipe.description || "Домашній рецепт"}</Markdown></div><div className="recipe-meta"><span>⏱ {recipe.preparationMinutes} хв</span><span>◈ {difficulty[recipe.difficulty]}</span>{typeof recipe.matchPercent === "number" && <strong>{recipe.matchPercent}% є</strong>}</div></div>
  </Link>;
}


