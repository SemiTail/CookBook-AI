import { useState } from "react";
import { api } from "./api";
import { IngredientSelection } from "./IngredientSelection";
import { matchesSearch } from "./search";
import type { FridgeItem, Ingredient } from "./types";

const BULK_DELETE_LIMIT = 200;

type FridgePanelProps = {
  fridge: FridgeItem[];
  ingredients: Ingredient[];
  onChanged: () => Promise<void>;
  onError: (error: unknown) => void;
};

function matchingItems(fridge: FridgeItem[], query: string) {
  return fridge.filter(({ ingredient }) => matchesSearch(`${ingredient.name} ${ingredient.category}`, query));
}

export function FridgePanel({ fridge, ingredients, onChanged, onError }: FridgePanelProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const owned = fridge.map(item => item.ingredientId);
  const isSearching = search.trim() !== "";
  const shown = isSearching ? matchingItems(fridge, search) : fridge;
  const shownIds = new Set(shown.map(item => item.id));
  const selectedIds = selected.filter(id => shownIds.has(id));
  const selectedSet = new Set(selectedIds);
  const bulkIds = shown.slice(0, BULK_DELETE_LIMIT).map(item => item.id);
  const allSelected = bulkIds.length > 0 && bulkIds.every(id => selectedSet.has(id));
  const bulkLabel = shown.length > BULK_DELETE_LIMIT
    ? `Обрати перші ${BULK_DELETE_LIMIT}`
    : isSearching ? "Обрати показані" : "Обрати всі";

  function changeSearch(query: string) {
    setSearch(query);
    const matchingIds = new Set(matchingItems(fridge, query).map(item => item.id));
    setSelected(ids => ids.filter(id => matchingIds.has(id)));
  }

  async function mutate(path: string, method: string, body?: unknown) {
    setPending(true);
    try {
      await api(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
      await onChanged();
      setSelected([]);
      setConfirm(false);
    } catch (error) {
      onError(error);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel fridge-panel">
      <div className="section-header">
        <div>
          <span className="eyebrow">Твій запас продуктів</span>
          <h2>Мій холодильник <span className="count">{fridge.length}</span></h2>
        </div>
        <button className="text-button danger-text" disabled={pending || !fridge.length} onClick={() => setConfirm(true)}>
          Очистити холодильник
        </button>
      </div>
      <IngredientSelection
        ingredients={ingredients}
        excluded={owned}
        pending={pending}
        onCreated={() => onChanged()}
        onDeleted={() => void onChanged()}
        onConfirm={ids => mutate("/fridge/bulk", "POST", { ingredientIds: ids })}
      />

      {(fridge.length > 0 || isSearching) && (
        <label className="catalog-search">
          Пошук у холодильнику
          <input
            type="search"
            placeholder="Назва або категорія продукту"
            value={search}
            disabled={pending}
            onChange={event => changeSearch(event.target.value)}
          />
        </label>
      )}
      {isSearching && <p className="muted" role="status">Показано {shown.length} з {fridge.length}</p>}
      {shown.length > 0 && (
        <>
          <div className="picker-tools">
            <label>
              <input
                type="checkbox"
                aria-label={bulkLabel === "Обрати всі" ? "Обрати всі продукти в холодильнику" : bulkLabel}
                checked={allSelected}
                disabled={pending}
                onChange={event => setSelected(event.target.checked ? bulkIds : [])}
              />
              {bulkLabel}
            </label>
            <button
              className="text-button danger-text"
              disabled={pending || !selectedIds.length}
              onClick={() => void mutate("/fridge/selected", "DELETE", { ids: selectedIds })}
            >
              Видалити обрані
            </button>
          </div>
          <div className="pills">
            {shown.map(item => {
              const checked = selectedSet.has(item.id);
              return (
                <span className="pill" key={item.id}>
                  <label>
                    <input
                      type="checkbox"
                      aria-label={"Обрати " + item.ingredient.name}
                      checked={checked}
                      disabled={pending || (!checked && selectedIds.length >= BULK_DELETE_LIMIT)}
                      onChange={() => setSelected(checked ? selectedIds.filter(id => id !== item.id) : [...selectedIds, item.id])}
                    />
                    <span className="ingredient-icon">{item.ingredient.emoji || "🥣"}</span>
                    {item.ingredient.name}
                    <small className="category-tag">{item.ingredient.category}</small>
                  </label>
                  <button
                    disabled={pending}
                    aria-label={"Видалити " + item.ingredient.name}
                    onClick={() => void mutate("/fridge/" + item.id, "DELETE")}
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        </>
      )}
      {!fridge.length && <p className="muted">Холодильник порожній. Додайте перший інгредієнт.</p>}
      {fridge.length > 0 && !shown.length && <p className="muted">За цим пошуком продуктів немає.</p>}
      {confirm && (
        <div role="alertdialog" className="fridge-confirm">
          <p>Видалити всі продукти?</p>
          <button className="button" disabled={pending} onClick={() => void mutate("/fridge", "DELETE")}>
            Так, видалити продукти
          </button>
          <button className="button button-outline" onClick={() => setConfirm(false)}>Скасувати</button>
        </div>
      )}
    </section>
  );
}
