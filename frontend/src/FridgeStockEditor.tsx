import { useState, type FormEvent } from "react";
import { updateFridgeStock } from "./api";
import type { FridgeItem } from "./types";

export function FridgeStockEditor({ items, onSaved, onError }: {
  items: FridgeItem[];
  onSaved: (item: FridgeItem) => void;
  onError: (error: unknown) => void;
}) {
  const [itemId, setItemId] = useState("");
  const [saving, setSaving] = useState(false);
  const item = items.find(entry => entry.id === itemId) ?? items[0];

  if (!item) return null;

  return (
    <details className="panel fridge-stock-editor">
      <summary>Кількість продуктів у холодильнику</summary>
      <label>
        Продукт
        <select value={item.id} disabled={saving} onChange={event => setItemId(event.target.value)}>
          {items.map(entry => <option key={entry.id} value={entry.id}>{entry.ingredient.name}</option>)}
        </select>
      </label>
      <StockForm key={item.id} item={item} saving={saving} onSaving={setSaving} onSaved={onSaved} onError={onError} />
    </details>
  );
}

function StockForm({ item, saving, onSaving, onSaved, onError }: {
  item: FridgeItem;
  saving: boolean;
  onSaving: (saving: boolean) => void;
  onSaved: (item: FridgeItem) => void;
  onError: (error: unknown) => void;
}) {
  const [quantity, setQuantity] = useState(String(item.quantity ?? ""));
  const [unit, setUnit] = useState(item.unit ?? "");
  const [updated, setUpdated] = useState(false);

  const amount = quantity === "" ? null : Number(quantity);
  const normalizedUnit = unit.trim() || null;
  const dirty = amount !== item.quantity || normalizedUnit !== item.unit;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !dirty) return;
    onSaving(true);
    setUpdated(false);
    try {
      const result = await updateFridgeStock(item.id, { quantity: amount, unit: normalizedUnit });
      onSaved(result);
      setQuantity(String(result.quantity ?? ""));
      setUnit(result.unit ?? "");
      setUpdated(true);
    } catch (error) {
      onError(error);
    } finally {
      onSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="fridge-stock-form">
      <label>
        Кількість
        <input type="number" min={0} step="any" value={quantity} disabled={saving}
          onChange={event => { setQuantity(event.target.value); setUpdated(false); }} />
      </label>
      <label>
        Одиниця виміру
        <input type="text" placeholder="Наприклад, г" value={unit} disabled={saving}
          onChange={event => { setUnit(event.target.value); setUpdated(false); }} />
      </label>
      <button className="button button-outline" type="submit" disabled={saving || !dirty}>Зберегти кількість</button>
      {updated && <p role="status">Кількість оновлено.</p>}
    </form>
  );
}
