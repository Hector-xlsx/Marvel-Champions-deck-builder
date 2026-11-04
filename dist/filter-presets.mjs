import {canonical,filterCards,compareCards,traitSourceOptions} from './catalog.mjs';
import {normalizeAllyFilter} from './ally-filters.mjs';
const PREFIX='marvel.filter.v1.';
const clone=value=>JSON.parse(JSON.stringify(value));
const uid=()=>crypto.randomUUID();
const list=value=>Array.isArray(value)?[...new Set(value.filter(x=>typeof x==='string').map(x=>x.slice(0,100)))].slice(0,3000):[];
export function presetCriteria(filter){
  const result={search:String(filter.search||'').slice(0,1000),language:['es','en','both'].includes(filter.language)?filter.language:'es',searchFields:{name:filter.searchFields?.name!==false,text:filter.searchFields?.text!==false}};
  if(!result.searchFields.name&&!result.searchFields.text)result.searchFields.name=true;
  result.traitSources=traitSourceOptions(filter.traitSources);
  result.allyStats=normalizeAllyFilter(filter.allyStats);
  for(const key of ['factions','types','traits','costs','resources'])if(Array.isArray(filter[key]))result[key]=list(filter[key]);
  for(const key of ['hideHero','sameAspect','owned'])result[key]=Boolean(filter[key]);
  return result;
}
export function createPreset(filter,name='Filtro 1',source){return {id:uid(),name,created:new Date().toISOString(),enabled:true,onlyPinned:source?.onlyPinned??false,criteria:presetCriteria(filter),pins:[...(source?.pins||[])],ui:clone(source?.ui||{})};}
export function singleVisiblePreset(presets,advanced,activeId){const visible=advanced?presets.filter(p=>p.enabled):presets.filter(p=>p.id===activeId);return visible.length===1?visible[0]:null;}
export function presetMatches(card,preset,deck,collection,specialRule){return filterCards([card],{...preset.criteria,specialRule},deck,collection).length>0;}
export function presetResults(choices,presets,deck,collection,{specialRule,sorts,selected=false}={}){
  const included=new Set();
  for(const preset of presets.filter(p=>p.enabled)){
    if(preset.onlyPinned){const pins=new Set(preset.pins);for(const card of choices)if(pins.has(card.code))included.add(card.code);}
    else for(const card of filterCards(choices,{...preset.criteria,specialRule},deck,collection))included.add(card.code);
  }
  return choices.filter(c=>included.has(c.code)&&(!selected||deck.cards[c.code]>0)).sort((a,b)=>compareCards(a,b,sorts));
}
export class FilterPresetStore{
  constructor(storage,cards){this.storage=storage;this.cards=cards;this.queue=Promise.resolve();}
  load(id){
    const raw=this.storage.getItem(PREFIX+id);if(!raw)return null;
    const p=JSON.parse(raw);if(p.id!==id||typeof p.name!=='string'||!p.criteria||typeof p.criteria!=='object')throw Error('Filtro guardado inválido.');
    const pins=list(p.pins).filter(code=>this.cards[code]?.role==='deck_card'&&!this.cards[code].en.hidden).map(code=>canonical(this.cards[code],this.cards));
    return {...p,name:p.name.slice(0,100),criteria:presetCriteria(p.criteria),pins:[...new Set(pins)],ui:p.ui&&typeof p.ui==='object'?p.ui:{},enabled:p.enabled!==false,onlyPinned:p.onlyPinned===true};
  }
  list(){const found=[];for(let i=0;i<this.storage.length;i++){const key=this.storage.key(i);if(!key?.startsWith(PREFIX))continue;try{const p=this.load(key.slice(PREFIX.length));if(p)found.push(p);}catch{/* Preserve unreadable records. */}}return found.sort((a,b)=>String(a.created||'').localeCompare(String(b.created||''))||a.id.localeCompare(b.id));}
  save(preset){this.storage.setItem(PREFIX+preset.id,JSON.stringify(preset));}
  update(id,mutate){
    const run=()=>{const latest=this.load(id);if(!latest)return null;mutate(latest);this.save(latest);return latest;};
    const next=this.queue.then(()=>globalThis.navigator?.locks?navigator.locks.request('marvel.filter.'+id,async()=>run()):run());this.queue=next.catch(()=>{});return next;
  }
  remove(id){const run=()=>this.storage.removeItem(PREFIX+id);const next=this.queue.then(()=>globalThis.navigator?.locks?navigator.locks.request('marvel.filter.'+id,async()=>run()):run());this.queue=next.catch(()=>{});return next;}
}
export const isPresetStorageKey=key=>key?.startsWith(PREFIX);
