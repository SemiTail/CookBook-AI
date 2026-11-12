import { useState } from "react";
import { resolvePhotoUrl } from "./api";

export function RecipeImage({ url, title, emoji, detail = false }: { url: string | null; title: string; emoji: string; detail?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return url && /^(?:https?:\/\/|\/api\/v1\/photos\/)/i.test(url) && failedUrl !== url
    ? <img className={detail ? "recipe-photo detail-photo" : "recipe-photo"} src={resolvePhotoUrl(url)} alt={title} loading={detail?"eager":"lazy"} decoding="async" referrerPolicy="no-referrer" onError={() => setFailedUrl(url)} />
    : <div className={detail ? "emoji detail-emoji" : "recipe-art emoji"} aria-hidden="true">{emoji}</div>;
}
