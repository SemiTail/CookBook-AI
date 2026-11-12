import {lazy,Suspense,useState} from 'react';
import type {Ingredient} from './types';
import {ingredientTags,ingredientRegions,ingredientCountries,matchesIngredientFilters} from './ingredientSorting';
import countryData from './data/countries.json';

const WorldIngredientMap=lazy(()=>import('./WorldIngredientMap').then(module=>({default:module.WorldIngredientMap})));
type Props={ingredients:Ingredient[];categories:string[];regions:string[];countries:string[];onCategories:(values:string[])=>void;onRegions:(values:string[])=>void;onCountries:(values:string[])=>void};

export function IngredientFilters({ingredients,categories,regions,countries,onCategories,onRegions,onCountries}:Props){
 const [mode,setMode]=useState<'categories'|'regions'>('categories');
 const [geographyView,setGeographyView]=useState<'list'|'map'>('list');
 const [query,setQuery]=useState(''),[reverse,setReverse]=useState(false);
 const regionMode=mode==='regions';
 const categoryPool=ingredients.filter(x=>matchesIngredientFilters(x,[],regions,countries));
 const regionalPool=ingredients.filter(x=>matchesIngredientFilters(x,categories,[],[]));
 const pool=regionMode?regionalPool:categoryPool;
 const valuesFor=regionMode?ingredientRegions:ingredientTags;
 const counts=new Map<string,number>();
 for(const ingredient of pool)for(const value of valuesFor(ingredient))counts.set(value,(counts.get(value)??0)+1);
 const options=[...new Set(ingredients.flatMap(valuesFor))].filter(x=>x.toLocaleLowerCase('uk').includes(query.toLocaleLowerCase('uk'))).sort((a,b)=>a.localeCompare(b,'uk')*(reverse?-1:1));
 const countryCounts=new Map<string,number>();
 for(const ingredient of regionalPool)for(const code of ingredientCountries(ingredient))countryCounts.set(code,(countryCounts.get(code)??0)+1);
 const mapCountries=countryData.map(country=>({...country,count:countryCounts.get(country.code)??0}));
 const selected=regionMode?regions:categories;const change=regionMode?onRegions:onCategories;
 return <details className='ingredient-filter-panel'>
  <summary>Категорії та регіони · обрано {categories.length+regions.length+countries.length}</summary>
  <div className='picker-tools'>
   <button type='button' className='button button-outline' aria-pressed={!regionMode} onClick={()=>{setMode('categories');setQuery('');}}>Категорії</button>
   <button type='button' className='button button-outline' aria-pressed={regionMode} onClick={()=>{setMode('regions');setQuery('');}}>Регіони світу</button>
   <button type='button' className='text-button' onClick={()=>{onCategories([]);onRegions([]);onCountries([]);}}>Скинути фільтри</button>
  </div>
  {regionMode&&<div className='picker-tools geography-views'>
   <button type='button' className='button button-outline' aria-pressed={geographyView==='list'} onClick={()=>setGeographyView('list')}>Список регіонів</button>
   <button type='button' className='button button-outline' aria-pressed={geographyView==='map'} onClick={()=>setGeographyView('map')}>Карта країн</button>
  </div>}
  {!!(regions.length+((!regionMode||geographyView!=='map')?countries.length:0))&&<div className='geography-selection' aria-label='Обрана географія'>
   {regions.map(region=><button key={region} type='button' className='geography-chip' aria-label={'Прибрати регіон '+region} onClick={()=>onRegions(regions.filter(r=>r!==region))}>{region} ×</button>)}
   {(!regionMode||geographyView!=='map')&&countries.map(code=><button key={code} type='button' className='geography-chip' aria-label={'Прибрати країну '+(countryData.find(c=>c.code===code)?.name??code)} onClick={()=>onCountries(countries.filter(c=>c!==code))}>{countryData.find(c=>c.code===code)?.name??code} ×</button>)}
  </div>}
  {regionMode&&geographyView==='map'?<Suspense fallback={<p role='status'>Завантажуємо карту країн…</p>}><WorldIngredientMap countries={mapCountries} selected={countries} onChange={onCountries}/></Suspense>:<>
   <div className='ingredient-controls'>
    <label>{regionMode?'Пошук регіонів':'Пошук категорій'}<input value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <label>{regionMode?'Порядок регіонів':'Порядок категорій'}<select value={reverse?'desc':'asc'} onChange={e=>setReverse(e.target.value==='desc')}><option value='asc'>А–Я</option><option value='desc'>Я–А</option></select></label>
   </div>
   <div className='filter-options'>{options.map(value=><label key={value}>
    <input type='checkbox' aria-label={(regionMode?'Регіон ':'Категорія ')+value} checked={selected.includes(value)} onChange={()=>change(selected.includes(value)?selected.filter(x=>x!==value):[...selected,value])}/>
    <span>{value}</span><small>{counts.get(value)??0}</small>
   </label>)}{!options.length&&<p className='muted'>Нічого не знайдено.</p>}</div>
  </>}
  <small className='muted filter-explanation'>Кілька категорій поєднуються за «або»; країни й регіони також. Географія уточнює обрані категорії та означає кулінарний зв’язок.</small>
 </details>;
}
