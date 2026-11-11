import { useState } from "react";

export function RecipeImage({ url, title, emoji, detail = false }: { url: string | null; title: string; emoji: string; detail?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return url && /^https?:\/\//i.test(url) && failedUrl !== url
    ? <img className={detail ? "recipe-photo detail-photo" : "recipe-photo"} src={url} alt={title} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedUrl(url)} />
    : <div className={detail ? "emoji detail-emoji" : "recipe-art emoji"} aria-hidden="true">{emoji}</div>;
}
