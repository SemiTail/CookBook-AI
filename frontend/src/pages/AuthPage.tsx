import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, isSession } from "../api";
import type { Session } from "../types";

export function AuthPage({ kind, onLogin }: { kind: "login" | "register"; onLogin: (s: Session) => void }) {
  const isRegister = kind === "register";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError("");
    if (loading) return;
    if (isRegister && password !== confirmPassword) {
      setError("Паролі не збігаються"); return;
    }
    setLoading(true);
    try {
      const result = await api<Session>(`/auth/${isRegister ? "register" : "login"}`, {
        method: "POST", body: JSON.stringify(isRegister ? { name, email, password } : { email, password }),
      });
      if (!isSession(result)) throw new Error("Сервер не повернув дані входу. Спробуйте ще раз.");
      onLogin(result);
    } catch (e) { setError(e instanceof Error ? e.message : "Помилка підключення до сервера"); }
    finally { setLoading(false); }
  };
  return <section className="auth-layout">
    <div className="intro"><span className="eyebrow">Що приготувати сьогодні?</span><h1>Смачні ідеї з того, що вже є в холодильнику.</h1><p>Зберігай продукти, відкривай рецепти та знаходь страви без зайвих покупок.</p><div className="intro-card">🥬 🥚 🍅 <span>Почни з власних інгредієнтів</span></div></div>
    <form className="panel auth-form" onSubmit={handleSubmit}>
      <h2>{isRegister ? "Створити акаунт" : "Вхід до системи"}</h2>
      <p className="muted">{isRegister ? "Реєстрація для доступу до рецептів" : "Увійди, щоб відкрити свій холодильник"}</p>
      {isRegister && <label>Ім’я<input required minLength={2} maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="Ваше ім’я" /></label>}
      <label>Email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" /></label>
      <label>Пароль<input required type={showPassword ? "text" : "password"} minLength={isRegister ? 8 : undefined} value={password} onChange={e => setPassword(e.target.value)} placeholder="Мінімум 8 символів" autoComplete={isRegister ? "new-password" : "current-password"} /></label>
      {isRegister && <label>Підтвердження пароля<input required type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" /></label>}
      <button type="button" className="text-button password-toggle" onClick={()=>setShowPassword(!showPassword)}>{showPassword ? "Приховати пароль" : "Показати пароль"}</button>
      {error && <div className="error" role="alert">{error}</div>}
      <button className="button button-block" disabled={loading}>{loading ? "Зачекайте…" : isRegister ? "Зареєструватися" : "Увійти"}</button>
      <p className="auth-switch">{isRegister ? "Уже є акаунт?" : "Ще немає акаунта?"} <Link to={isRegister ? "/login" : "/register"}>{isRegister ? "Увійти" : "Зареєструватися"}</Link></p>
    </form>
  </section>;
}
