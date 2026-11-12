import {auditFieldNames,auditValue} from './auditPresentation';
export function AuditEventDetails({details,technical,action}:{details:Record<string,unknown>|null;technical:boolean;action:string}){
 if(!details)return null;
 const before=details.before&&typeof details.before==='object'&&!Array.isArray(details.before)?details.before as Record<string,unknown>:null;
 const after=details.after&&typeof details.after==='object'&&!Array.isArray(details.after)?details.after as Record<string,unknown>:null;
 const excluded=['id','createdAt','updatedAt','originalAuthorship','author','permissions'];
 const visibleKeys=(record:Record<string,unknown>)=>Object.keys(record).filter(k=>!excluded.includes(k)&&!k.endsWith('Id'));
 const changes=after?visibleKeys(after).filter(k=>JSON.stringify(before?.[k])!==JSON.stringify(after[k])):[];
 const snapshot=before&&!Object.hasOwn(details,'after')?visibleKeys(before):[];
 const visibilityChange=/^recipe\.(hide|restore)$/.test(action)&&Object.hasOwn(details,'after');
 const label=(key:string)=>action.startsWith('grant.')&&key==='instructions'?'Правила та інструкція автора':auditFieldNames[key]??key;
 const value=(key:string,v:unknown)=>['hiddenAt','pinnedAt'].includes(key)?(v?`Так · ${new Date(String(v)).toLocaleString('uk-UA')}`:'Ні'):auditValue(v);
 const notes=Object.keys(details).filter(k=>['reason','text','mode','deletedRecipes','publishedRecipes','status','decision'].includes(k));
 if(!changes.length&&!notes.length&&!snapshot.length&&!visibilityChange&&!technical)return null;
 return <details className='audit-event-details'><summary>Переглянути зміни <span aria-hidden='true'>⌄</span></summary><div className='audit-details-body'>
 {notes.map(k=><div className={'audit-detail-note'+(k==='reason'?' is-reason':'')} key={k}><span>{auditFieldNames[k]??k}</span><p>{auditValue(details[k])}</p></div>)}
 {changes.map(key=><section className='audit-change' key={key}><h4>{label(key)}</h4><div className='audit-change-columns'><div className='audit-change-before'><small>Було</small><pre>{value(key,before?.[key])}</pre></div><div className='audit-change-after'><small>Стало</small><pre>{value(key,after?.[key])}</pre></div></div></section>)}
 {visibilityChange&&<section className='audit-change'><h4>Приховано</h4><div className='audit-change-columns'><div className='audit-change-before'><small>Було</small><pre>{value('hiddenAt',details.before)}</pre></div><div className='audit-change-after'><small>Стало</small><pre>{value('hiddenAt',details.after)}</pre></div></div></section>}
 {!!snapshot.length&&<section className='audit-snapshot'><h4>Стан перед дією</h4>{snapshot.map(key=><div className='audit-detail-note' key={key}><span>{label(key)}</span><pre>{value(key,before?.[key])}</pre></div>)}</section>}
 {!changes.length&&!notes.length&&!snapshot.length&&!visibilityChange&&<p className='muted'>Додатковий запис модерації.</p>}
 {technical&&<details className='audit-technical'><summary>Службові дані</summary><pre className='audit-raw'>{JSON.stringify(details,null,2)}</pre></details>}
 </div></details>;
}
