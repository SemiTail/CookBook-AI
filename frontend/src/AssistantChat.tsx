import { Markdown } from "./Markdown";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { api } from "./api";

type Turn = { id: string; prompt: string; reply: string; createdAt: string; expiresAt: string };
type History = { turns: Turn[]; retentionDays: number; available: boolean };
export type ChatMode = "closed" | "minimized" | "open";

function Reply({ text }: { text: string }) {
  return <div className="chat-reply"><Markdown>{text}</Markdown></div>;
}

export function AssistantChat({ mode, onMode, fridgeCount }: { mode: ChatMode; onMode: (mode: ChatMode) => void; fridgeCount: number }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [pendingMessage, setPendingMessage] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [retry, setRetry] = useState(0);
  const end = useRef<HTMLDivElement>(null);
  const compose = useRef<HTMLTextAreaElement>(null);
  const panel = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (mode !== "open") return;
    let frame = 0;
    const resize = () => {
      if (panel.current) panel.current.style.setProperty("--chat-height", `${Math.max(360, window.innerHeight - Math.max(20, panel.current.getBoundingClientRect().top) - 20)}px`);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(resize); };
    resize();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", schedule); window.removeEventListener("scroll", schedule); };
  }, [mode]);

  useEffect(() => {
    if (mode !== "open" || sending) return;
    let active = true;
    setLoading(true); setError("");
    api<History>("/assistant/history").then(history => {
      if (active) { setTurns(history.turns); setAvailable(history.available); }
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : "Не вдалося завантажити історію"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [mode, retry]);

  useEffect(() => { if (mode === "open") end.current?.scrollIntoView({ block: "nearest" }); }, [turns, sending, mode]);
  useEffect(() => {
    if (mode !== "open") return;
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onMode("closed"); };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [mode, onMode]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || sending || loading || clearing) return;
    setSending(true); setPendingMessage(message); setDraft(""); setError("");
    try {
      const turn = await api<Turn>("/assistant/messages", { method: "POST", body: JSON.stringify({ message }) });
      setTurns(previous => [...previous, turn]);
    } catch (e) { setError(e instanceof Error ? e.message : "Не вдалося отримати відповідь"); setDraft(message); }
    finally { setSending(false); setPendingMessage(""); }
  }

  async function clear() {
    setClearing(true); setError("");
    try { await api("/assistant/history", { method: "DELETE" }); setTurns([]); setConfirmClear(false); }
    catch (e) { setError(e instanceof Error ? e.message : "Не вдалося очистити історію"); }
    finally { setClearing(false); }
  }

  if (mode !== "open") return mode === "minimized" ? <button className="chat-minimized button" onClick={() => onMode("open")} aria-label="Розгорнути ШІ-помічника">✦ {sending ? "Gemini готує відповідь…" : "ШІ-помічник"} ↑</button> : null;
  return <aside ref={panel} className="assistant-panel panel" aria-label="ШІ-помічник Gemini">
    <div className="chat-header"><div><span className="eyebrow">✦ CookBook AI</span><h2>Кулінарний помічник</h2></div><div className="chat-controls"><button type="button" className="icon-button" aria-label="Згорнути чат" title="Згорнути" onClick={() => onMode("minimized")}>−</button><button type="button" className="icon-button" aria-label="Закрити чат" title="Закрити" onClick={() => onMode("closed")}>×</button></div></div>
    <p className="chat-context">У холодильнику: {fridgeCount} продуктів. Враховую актуальний список у кожному запиті.</p>
    <div className="chat-history" role="log" aria-label="Історія чату" aria-live="polite" aria-relevant="additions text" aria-busy={loading}>
      {loading && <p className="muted">Завантажуємо історію…</p>}
      {!loading && !turns.length && <div className="chat-empty"><h3>Що приготуємо?</h3><p>Попросіть швидку вечерю, страву без певного продукту або рецепт із заданою калорійністю.</p><button className="button button-outline" onClick={() => { setDraft("Що можна приготувати за 20 хвилин із моїх продуктів?"); compose.current?.focus(); }}>Ідея на 20 хвилин</button><button className="button button-outline" onClick={()=>{setDraft("Запропонуй вечерю з наявних продуктів у холодильнику");compose.current?.focus();}}>Вечеря з моїх продуктів</button></div>}
      {turns.map(turn => <div className="chat-turn" key={turn.id}><article className="chat-message chat-user"><span className="chat-speaker">Ви</span><p>{turn.prompt}</p></article><article className="chat-message chat-model"><span className="chat-speaker">Gemini</span><Reply text={turn.reply} /></article></div>)}
      {sending && <><article className="chat-message chat-user"><span className="chat-speaker">Ви</span><p>{pendingMessage}</p></article><p role="status" className="muted">Gemini підбирає страву…</p></>}
      <div ref={end} />
    </div>
    {!available && <p className="error" role="status">ШІ-помічник ще не налаштований. Історія залишається доступною.</p>}
    {error && <div className="error" role="alert">{error} <button className="text-button" disabled={sending} onClick={() => setRetry(value => value + 1)}>Оновити чат</button></div>}
    {confirmClear && <div className="chat-confirm" role="alertdialog" aria-label="Очистити історію чату"><p>Видалити всю вашу історію чату?</p><div className="recipe-actions"><button className="button button-danger button-small" disabled={sending || clearing} onClick={clear}>Так, очистити чат</button><button className="button button-outline button-small" disabled={clearing} onClick={() => setConfirmClear(false)}>Скасувати</button></div></div>}
    <form className="chat-compose" onSubmit={send}><label htmlFor="assistant-message" className="chat-speaker">Ваш запит</label><textarea ref={compose} id="assistant-message" rows={3} maxLength={4000} value={draft} disabled={sending || clearing} onChange={e => setDraft(e.target.value)} placeholder="Наприклад: вечеря на двох без молока…" /><div className="chat-compose-actions"><button className="text-button" type="button" disabled={!turns.length || sending || clearing || loading} onClick={() => setConfirmClear(true)}>Очистити історію</button><button className="button button-small" disabled={!draft.trim() || sending || clearing || loading || !available}>{sending ? "Очікуємо…" : "Надіслати"}</button></div></form>
    <p className="chat-disclosure">Історія зберігається 30 днів. Для відповіді Gemini отримує ваш запит, останні повідомлення та актуальні продукти й доступні рецепти.</p>
  </aside>;
}
