import {matchesSearch} from '../search';
import {useReposts,RepostFilter,matchesReposts} from '../Reposts';
import {useSearchHistory} from "../useSearchHistory";
import { Markdown } from "../Markdown";
import { RecipeImage } from "../RecipeImage";
import { useCallback, useEffect, useState } from "react";
import { Link,useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api";
import type { FridgeItem, Ingredient, Recipe, User } from "../types";
import { AssistantChat, type ChatMode } from "../AssistantChat";
import { FridgePanel } from "../FridgePanel";

export function DashboardPage({ onUnauthorized }: { onUnauthorized: () => void }) {
  const reposts=useReposts();const [repostFilter,setRepostFilter]=useState('all');
  const [params]=useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [moderation,setModeration]=useState<Recipe[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState(params.get("search")??"");
  const [minutes, setMinutes] = useState(0);
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [sort, setSort] = useState("title");
  const [savedRecipes,setSavedRecipes]=useState<Recipe[]>([]);
  const [followed,setFollowed]=useState<{id:string;name:string}[]>([]);
  const [feed,setFeed]=useState<Recipe[]>([]);
  const [ratings,setRatings]=useState<{id:string;average:number;count:number}[]>([]);
  const [meal,setMeal]=useState("");
  const [view, setView] = useState("grid");
  const [tab, setTab] = useState(params.get("tab")??"ready");
  useEffect(()=>{setSearch(params.get("search")??"");const t=params.get("tab");if(t&&["mine","official","ready","community","saved","following","moderation"].includes(t))setTab(t);},[params]);
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
    Promise.all([api<User>("/users/me"), api<Recipe[]>("/recipes"), api<Ingredient[]>("/ingredients"), api<FridgeItem[]>("/fridge"), api<Recipe[]>("/recommendations"), api<Recipe[]>("/recipes/mine"), api<Recipe[]>("/recipes/community"),api<Recipe[]>("/library/saved"),api<{users:{id:string;name:string}[];recipes:Recipe[]}>("/library/following"),api<{id:string;average:number;count:number}[]>("/library/ratings")])
      .then(([me, r, i, items, matches, mine, shared, saved, following, scores]) => { if (active) { setUser(me); setRecipes(r); setIngredients(i); setFridge(items); setSuggestions(matches); setMyRecipes(mine); setCommunity(shared);setSavedRecipes(saved);setFollowed(following.users);setFeed(following.recipes);setRatings(scores); } })
      .catch((e: unknown) => { if (active) handleError(e); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [handleError]);

  useEffect(()=>{if(user?.role!=="MODERATOR")return;let active=true;api<Recipe[]>("/recipes/moderation").then(r=>{if(active)setModeration(r);}).catch(handleError);return()=>{active=false;};},[user?.role,handleError]);
  const displayed = (tab === "moderation" ? moderation : tab === "mine" ? myRecipes : tab === "official" ? recipes : tab === "community" ? community : tab === "saved" ? savedRecipes : tab === "following" ? feed : suggestions)
    .filter(r=>matchesReposts(reposts[r.id]??0,repostFilter)).filter(r => matchesSearch(r.title+" "+(r.description??""),search) && (!minutes || r.preparationMinutes <= minutes) && (!difficultyFilter || r.difficulty === difficultyFilter) && (!meal || r.mealType===meal))
    .sort((a,b) => sort === "reposts" ? (reposts[b.id]??0)-(reposts[a.id]??0) : sort === "newest" ? new Date(b.publishedAt??b.createdAt).getTime()-new Date(a.publishedAt??a.createdAt).getTime() : sort==="oldest" ? new Date(a.publishedAt??a.createdAt).getTime()-new Date(b.publishedAt??b.createdAt).getTime() : sort==="rating" ? (ratings.find(x=>x.id===b.id)?.average??-1)-(ratings.find(x=>x.id===a.id)?.average??-1) : sort === "time" ? a.preparationMinutes-b.preparationMinutes : sort === "calories" ? (a.calories??Infinity)-(b.calories??Infinity) : a.title.localeCompare(b.title,"uk"));
  const recordSearch=useSearchHistory(search,tab,displayed,undefined,!loading);
  return <>
    <div className="dashboard-heading"><section className="welcome"><span className="eyebrow">Твоя кулінарна книга</span><h1>Вітаємо{user ? `, ${user.name}` : ""} 👋</h1><p>Обери продукти, які маєш, і знайди страву на сьогодні.</p></section><button className="button assistant-toggle" aria-expanded={chatMode === "open"} onClick={() => setChatMode(mode => mode === "open" ? "closed" : "open")}>✦ ШІ-помічник</button></div>
    {user && <p className="muted">Ви увійшли як {user.email}</p>}
    {user?.role === "MODERATOR" && <p className="eyebrow">Модератор · публікація офіційних рецептів у формі створення та редагування</p>}
    {error && <div className="error" role="alert">{error} <button onClick={() => window.location.reload()}>Повторити</button></div>}
    {loading ? <p>Завантажуємо дані…</p> : <div className={`dashboard-layout ${chatMode === "open" ? "is-chat-open" : ""}`}><div className="dashboard-content">
      <FridgePanel fridge={fridge} ingredients={ingredients} onChanged={refresh} onError={handleError} />
      <section className="recipes-section">
        <div className="section-header"><h2>Каталог рецептів</h2><Link className="button" to="/recipes/new">+ Створити рецепт</Link></div>
        <div className="recipe-tabs" role="tablist" aria-label="Види рецептів">{[["mine","Свої"],["official","Офіційні"],["ready","Що можна приготувати"],["community","Браузер рецептів"],["saved","Збережені"],["following","Відстеження"],...(user?.role==="MODERATOR"?[["moderation","Модерація"]]:[])].map(([key,label]) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? "button" : "button button-outline"} onClick={() => setTab(key)}>{label}</button>)}</div>
        {tab==="following"&&<div className="following-users"><h3>Ви відстежуєте</h3>{followed.map(u=><Link key={u.id} className="button button-outline" to={"/users/"+u.id}>{u.name}</Link>)}{!followed.length&&<p>Відкрийте профіль автора та натисніть «Відстежувати користувача».</p>}</div>}
        <label className="catalog-search">Пошук рецептів<input type="search" onBlur={recordSearch} placeholder="Знайдіть свою наступну улюблену страву…" value={search} onChange={e=>setSearch(e.target.value)} /></label>
        <div className="catalog-layout"><aside className="catalog-filters"><h3>Фільтри</h3><label>Час приготування<select value={minutes} onChange={e=>setMinutes(Number(e.target.value))}><option value={0}>Будь-який час</option><option value={15}>До 15 хв</option><option value={30}>До 30 хв</option><option value={60}>До 60 хв</option></select></label><label>Складність<select value={difficultyFilter} onChange={e=>setDifficultyFilter(e.target.value)}><option value="">Будь-яка</option><option value="EASY">Просто</option><option value="MEDIUM">Середньо</option><option value="HARD">Складно</option></select></label><label>Прийом їжі<select aria-label="Прийом їжі" value={meal} onChange={e=>setMeal(e.target.value)}><option value="">Усі</option><option value="BREAKFAST">Сніданок</option><option value="LUNCH">Обід</option><option value="DINNER">Вечеря</option><option value="SNACK">Перекус</option><option value="DESSERT">Десерт</option><option value="ANY">Не вказано</option></select></label><button className="button button-outline" onClick={()=>{setMeal("");setSearch("");setMinutes(0);setDifficultyFilter("");}}>Очистити фільтри</button></aside><div>
        <div className="catalog-tools"><span>Знайдено рецептів: <strong>{displayed.length}</strong></span><RepostFilter value={repostFilter} onChange={setRepostFilter}/><label>Сортування<select aria-label="Сортування" value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Нові публікації</option><option value="oldest">Старі публікації</option><option value="rating">За оцінкою</option><option value="reposts">За пересиланнями</option><option value="title">За назвою</option><option value="time">Спочатку швидкі</option><option value="calories">За калорійністю</option></select></label><button className="button button-outline" aria-label="Перемкнути вигляд каталогу" onClick={()=>setView(view==="grid"?"list":"grid")}>{view==="grid"?"☷":"▦"}</button></div>
        <div role="tabpanel"><div className={"cards catalog-"+view}>{displayed.map(recipe => <RecipeCard key={recipe.id} recipe={recipe} rating={ratings.find(x=>x.id===recipe.id)?.average} />)}</div>
        {!displayed.length && <p className="empty">У цьому розділі поки немає рецептів.</p>}</div></div></div>
      </section>
    </div><AssistantChat mode={chatMode} onMode={setChatMode} fridgeCount={fridge.length} /></div>}
  </>;
}

export function RecipeCard({ recipe, rating }: { recipe: Pick<Recipe,"id"|"title"|"description"|"imageUrl"|"emoji"|"preparationMinutes"|"difficulty"|"matchPercent">; rating?:number }) {
  const reposts=useReposts();
  const difficulty: Record<Recipe["difficulty"], string> = { EASY: "Просто", MEDIUM: "Середньо", HARD: "Складно" };
  return <article className="recipe-card"><Link to={`/recipes/${encodeURIComponent(recipe.id)}`}>
    <RecipeImage url={recipe.imageUrl} title={recipe.title} emoji={recipe.emoji} /></Link>
    <div className="recipe-content"><h3><Link to={`/recipes/${encodeURIComponent(recipe.id)}`}>{recipe.title}</Link></h3><div className="card-description"><Markdown compact>{recipe.description || "Домашній рецепт"}</Markdown></div><div className="recipe-meta"><span aria-label="Кількість пересилань">↗ {reposts[recipe.id]??0}</span>{rating!==undefined&&<strong>★ {rating.toFixed(1)}</strong>}<span>⏱ {recipe.preparationMinutes} хв</span><span>◈ {difficulty[recipe.difficulty]}</span>{typeof recipe.matchPercent === "number" && <strong>{recipe.matchPercent}% є</strong>}</div></div>
  </article>;
}


