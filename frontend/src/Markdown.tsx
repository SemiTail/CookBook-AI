import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useRef, useState } from "react";
export function Markdown({ children, compact = false }: { children: string; compact?: boolean }) {
 return <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} disallowedElements={compact ? ["a","img","input"] : undefined} unwrapDisallowed={compact}>{children}</ReactMarkdown></div>;
}
export function MarkdownEditor({ label, value, onChange, maxLength = 20000, minLength = 0 }: { label:string; value:string; onChange:(value:string)=>void; maxLength?:number; minLength?:number }) {
 const [preview,setPreview] = useState(false);
 const ref = useRef<HTMLTextAreaElement>(null);
 function wrap(before:string,after="") { const field = ref.current; if (!field) return; const start=field.selectionStart,end=field.selectionEnd; onChange(value.slice(0,start)+before+value.slice(start,end)+after+value.slice(end)); field.focus(); }
 return <div className="markdown-editor"><div className="editor-toolbar"><strong>{label}</strong><button type="button" onClick={()=>setPreview(!preview)}>{preview ? "Редагувати" : "Попередній перегляд"}</button>{!preview && <>{[["Жирний","**","**"],["Курсив","*","*"],["Заголовок","\n## ",""],["Список","\n- ",""],["Посилання","[","](https://)"],["Код","\n```\n","\n```"]].map(([title,before,after])=><button type="button" key={title} onClick={()=>wrap(before,after)}>{title}</button>)}</>}</div>
 {preview ? <Markdown>{value || "*Немає тексту*"}</Markdown> : <textarea ref={ref} aria-label={label} value={value} onChange={e=>onChange(e.target.value)} rows={6} maxLength={maxLength} minLength={minLength} required={minLength>0} />}
 <small className="muted">Markdown: заголовки, таблиці, списки завдань, цитати, код, зображення й посилання. HTML і скрипти не виконуються.</small></div>;
}
