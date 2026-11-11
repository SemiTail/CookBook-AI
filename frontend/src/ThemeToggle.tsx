import { useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === "dark");
  const label = dark ? "Увімкнути світлу тему" : "Увімкнути темну тему";
  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("cookbook-theme", next); } catch { /* Theme still works without storage. */ }
    setDark(next === "dark");
  }
  return <button type="button" className="theme-toggle button button-small button-outline" aria-label={label} title={label} aria-pressed={dark} onClick={toggle}>
    <span aria-hidden="true">{dark ? "☀" : "☾"}</span>
  </button>;
}
