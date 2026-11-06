import {matchesAllyFilter} from './ally-filters.mjs';
export const factions = {hero:'Héroe',basic:'Básica',aggression:'Agresividad',justice:'Justicia',leadership:'Liderazgo',protection:'Protección',pool:'Masacre'};
export const types = {ally:'Aliado',event:'Evento',support:'Apoyo',upgrade:'Mejora',resource:'Recurso',player_side_scheme:'Plan secundario'};
export const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export const plain = value => String(value ?? '').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&');
export const title = card => card.es.name || card.en.name;
export const aspectCodes = ['aggression','justice','leadership','protection','pool'];
// Dots inside abbreviations such as S.H.I.E.L.D. are not trait separators.
export const traits = value => plain(value).split(/\.(?:\s+|$)/).map(t=>t.trim()).filter(Boolean);
export function cardTraits(card) {return traits(card.es.traits || card.en.traits);}
const traitKey=value=>normalize(value).trim().replace(/\.$/,'').replace(/\s+/g,' ');
export const TEXT_TOPICS={side_scheme:{es:'Plan secundario',en:'Side scheme'}};
export function traitSourceOptions(value){
  const sources={attribute:value?.attribute!==false,text:value?.text===true};
  if(!sources.attribute&&!sources.text)sources.attribute=true;
  return sources;
}
export function buildTraitReferenceIndex(records){
  const vocabulary={es:new Map(),en:new Map()};
  for(const card of records.filter(c=>['deck_card','identity','hero_auxiliary'].includes(c.role)))for(const lang of ['es','en'])for(const name of traits(card[lang]?.traits)){
    const key=traitKey(name);if(!vocabulary[lang].has(key))vocabulary[lang].set(key,name);
  }
  return Object.fromEntries(records.map(card=>{
    const textReferences={},traitReferences={},textTopics={};
    for(const lang of ['es','en']){
      const marked=new Map();for(const match of String(card[lang]?.text||'').matchAll(/\[\[([^\[\]]+)\]\]/g)){
        const name=plain(match[1]).trim();if(name)marked.set(traitKey(name),name);
      }
      textReferences[lang]=[...marked.values()];
      traitReferences[lang]=[...marked.keys()].filter(key=>vocabulary[lang].has(key)).map(key=>vocabulary[lang].get(key));
      const text=normalize(plain(card[lang]?.text)).replace(/\s+/g,' ');
      const mentionsSideScheme=lang==='es'?/\bplan(?:es)? secundarios?\b/.test(text):/\bside[\s-]+schemes?\b/.test(text);
      textTopics[lang]=mentionsSideScheme?['side_scheme']:[];
    }
    return [card.code,{textReferences,traitReferences,textTopics}];
  }));
}
export function scopedTraits(card,sources,includeEnglish=false){
  const scope=traitSourceOptions(sources),values=[];
  if(scope.attribute)values.push(...cardTraits(card),...(includeEnglish?traits(card.en.traits):[]));
  if(scope.text){const refs=card.traitReferences||{};values.push(...(refs.es?.length?refs.es:refs.en||[]),...(includeEnglish?refs.en||[]:[]));
    for(const [key,labels]of Object.entries(TEXT_TOPICS))if(card.textTopics?.es?.includes(key)||card.textTopics?.en?.includes(key))values.push(labels.es,...(includeEnglish?[labels.en]:[]));
  }
  return [...new Map(values.map(name=>[traitKey(name),name])).values()];
}
export const resources = {energy:'Energía',physical:'Físico',mental:'Mental',wild:'Universal',none:'Sin recurso'};
export function specialRuleFor(hero){
  return ({'18001a':{id:'gamora',source:'18001b',description:'Gamora: hasta 6 Eventos de Ataque o Intervención de otros aspectos.'},'33001a':{id:'cyclops',source:'33001b',description:'Cíclope: Aliados Patrulla-X de cualquier aspecto.'},'40001a':{id:'cable_side_schemes',source:'40001b',description:'Cable: planes secundarios de jugador de cualquier aspecto.'},'50001a':{id:'maria_hill',source:'50001b',description:'Maria Hill: hasta 3 Apoyos S.H.I.E.L.D. distintos de otros aspectos.'},'58001a':{id:'wonder_man',source:'58001b',description:'Hombre Maravilla: Eventos con Energía impresa de cualquier aspecto.'}})[hero?.code]??(hero?.links?.set==='cable'?{id:'cable_side_schemes',source:'40001b',description:'Cable: planes secundarios de jugador de cualquier aspecto.'}:null);
}
export function specialRuleAllows(card,rule){
  if(!['basic',...aspectCodes].includes(card.en.faction_code))return false;
  const t=[...cardTraits(card),...traits(card.en.traits)].map(normalize),type=card.en.type_code;
  if(rule?.id==='cable_side_schemes')return type==='player_side_scheme';
  if(rule?.id==='gamora')return type==='event'&&t.some(x=>['attack','thwart','ataque','intervencion'].includes(x));
  if(rule?.id==='cyclops')return type==='ally'&&t.some(x=>['x-men','patrulla-x'].includes(x));
  if(rule?.id==='maria_hill')return type==='support'&&t.some(x=>x.replace(/\./g,'')==='shield');
  return rule?.id==='wonder_man'&&type==='event'&&card.en.resource_energy>0;
}
export function partialSearch(value,query){
  const parts=normalize(query).trim().split(/[\s%]+/).filter(Boolean),text=normalize(plain(value));let from=0;
  for(const part of parts){const index=text.indexOf(part,from);if(index<0)return false;from=index+part.length;}return true;
}
export function traitCounts(records,familyFor=c=>c.code,sources){
  const found=new Map();
  for(const card of records)for(const name of scopedTraits(card,sources)){
    const key=traitKey(name);if(!found.has(key))found.set(key,{name,codes:new Set()});found.get(key).codes.add(familyFor(card));
  }
  return [...found.values()].map(({name,codes})=>({name,count:codes.size}));
}
export function allowedFactions(filter,deck) {
  return Object.keys(factions).filter(code=>code==='hero'?!filter.hideHero:!filter.sameAspect||code==='basic'||deck.aspects.includes(code));
}
export function automaticName(deck,hero,existing=[]) {
  if(!hero)return deck.name;
  const selected=aspectCodes.filter(code=>deck.aspects.includes(code));
  const all=['aggression','justice','leadership','protection'].every(code=>selected.includes(code));
  const base=title(hero)+(!all&&selected.length?' - '+selected.map(code=>factions[code]).join(' / '):'');
  const occupied=new Set(existing.filter(d=>d.id!==deck.id).map(d=>normalize(d.name).trim()));
  let result=base,n=2;while(occupied.has(normalize(result).trim()))result=`${base} (${n++})`;
  return result;
}
export function family(card, cards) {
  const visited = new Set(); let current = card;
  while(current?.links.duplicate_of && !visited.has(current.code)) {visited.add(current.code); current = cards[current.links.duplicate_of] || current;}
  return current?.code || card.code;
}
export function canonical(card, cards) {
  if(card.en.hidden && card.links.other_face && cards[card.links.other_face]) return family(cards[card.links.other_face],cards);
  return family(card,cards);
}
export const limit = card => card.en.type_code==='ally' ? 1 : Number.isInteger(card.en.deck_limit) ? card.en.deck_limit : 3;
export function deckLimit(card,deck,cards){const root=canonical(card,cards),own=cards[root].en.faction_code==='hero'&&cards[root].links.set===cards[deck.hero]?.links.set;return deck.hero==='21031a'&&!own?1:limit(cards[root]);}
export function requiredHeroCards(deck,cards) {
  const set=cards[deck.hero]?.links.set;if(!set)return {};
  return Object.fromEntries(Object.values(cards).filter(c=>c.role==='deck_card'&&!c.en.hidden&&c.en.faction_code==='hero'&&c.links.set===set&&canonical(c,cards)===c.code).map(c=>[c.code,c.en.quantity||1]));
}
export function ensureHeroCards(deck,cards) {
  let added=0;
  for(const [code,min]of Object.entries(requiredHeroCards(deck,cards))){
    const quantity=Object.entries(deck.cards).filter(([key])=>cards[key]&&canonical(cards[key],cards)===code).reduce((sum,[,n])=>sum+n,0);
    if(quantity<min){deck.cards[code]=(deck.cards[code]||0)+(min-quantity);added+=min-quantity;}
  }
  return added;
}
export function canSetQuantity(deck,code,quantity,cards) {
  const root=canonical(cards[code],cards),min=requiredHeroCards(deck,cards)[root]||0;
  return Number.isInteger(quantity)&&quantity>=min&&quantity<=Math.max(min,deckLimit(cards[root],deck,cards));
}
export function selectionState(values,selected){
  const count=values.filter(value=>selected.has(value)).length;
  return count===0?'none':count===values.length?'all':'partial';
}
export function toggleSelection(values,selected){
  const result=new Set(selected),all=selectionState(values,selected)==='all';
  for(const value of values)if(all)result.delete(value);else result.add(value);
  return result;
}
export function filterDecks(decks,{hero='',aspect='',armedOnly=false,retained=new Set(),sortKey='',direction=0}={},cards={}){
  const value=(d,key)=>({name:d.name,hero:cards[d.hero]?title(cards[d.hero]):'',aspects:d.aspects.map(a=>factions[a]||a).join(' / '),version:d.versions.length,count:Object.values(d.cards).reduce((s,n)=>s+n,0),armed:Number(d.armed)})[key];
  const result=decks.filter(d=>(!hero||d.hero===hero)&&(!aspect||d.aspects.includes(aspect))&&(!armedOnly||d.armed||retained.has(d.id)));
  if(sortKey&&direction)result.sort((a,b)=>{
    const av=value(a,sortKey),bv=value(b,sortKey);
    const cmp=typeof av==='number'?av-bv:String(av).localeCompare(String(bv),'es',{numeric:true,sensitivity:'base'});
    return direction*cmp;
  });
  return result;
}
export const CARD_SORT_DEFAULTS = ['faction','type','cost'];
export function compareCards(a,b,criteria=CARD_SORT_DEFAULTS){
  const textCompare=(x,y)=>String(x??'').localeCompare(String(y??''),'es',{numeric:true,sensitivity:'base'});
  for(const key of new Set(criteria.filter(Boolean))){
    let cmp=0;
    if(key==='cost'){
      const cost=c=>Number.isFinite(c.en.cost)&&c.en.cost>=0?c.en.cost:Infinity;
      const av=cost(a),bv=cost(b);cmp=av===bv?0:av<bv?-1:1;
    }else if(key==='faction')cmp=textCompare(factions[a.en.faction_code]||a.es.faction_name,factions[b.en.faction_code]||b.es.faction_name);
    else if(key==='type')cmp=textCompare(types[a.en.type_code]||a.es.type_name,types[b.en.type_code]||b.es.type_name);
    else if(key==='name')cmp=textCompare(title(a),title(b));
    if(cmp)return cmp;
  }
  return textCompare(title(a),title(b))||a.code.localeCompare(b.code);
}
export function paginateCards(cards,{rows=3,columns=1,page=1,selectedFirst=false,selectedCodes=new Set()}={}){
  const ordered=selectedFirst?[...cards.filter(c=>selectedCodes.has(c.code)),...cards.filter(c=>!selectedCodes.has(c.code))]:cards;
  const perPage=rows>0?Math.max(1,Math.floor(rows))*Math.max(1,Math.floor(columns)):Math.max(1,ordered.length);
  const pages=Math.max(1,Math.ceil(ordered.length/perPage));
  const current=Math.max(1,Math.min(pages,Math.floor(page)||1));
  return {items:ordered.slice((current-1)*perPage,current*perPage),page:current,pages,total:ordered.length,perPage};
}
export function filterCards(cards, filter, deck, collection) {
  const q=normalize(filter.search);
  const allowed=allowedFactions(filter,deck);
  return cards.filter(c=> {
    const e=c.en;
    const specialSelected=filter.factions?.includes('special')&&specialRuleAllows(c,filter.specialRule);
    if(filter.hideHero&&(e.faction_code==='hero'||c.heroSetCard||c.role==='hero_auxiliary'||c.links?.parent_hero_set))return false;
    const normalAllowed=allowed.includes(e.faction_code)||(!filter.hideHero&&!filter.sameAspect);
    const normalSelected=!filter.factions||filter.factions.includes(e.faction_code);
    if(!(specialSelected||(normalAllowed&&normalSelected)))return false;
    if(filter.types && !filter.types.includes(e.type_code))return false;
    if(!matchesAllyFilter(c,filter.allyStats))return false;
    if(filter.costs && !filter.costs.includes(String(e.cost??'unknown')))return false;
    if(filter.traits?.length){
      const values=scopedTraits(c,filter.traitSources,true).map(traitKey);
      if(!filter.traits.some(t=>values.includes(traitKey(t))))return false;
    }
    if(filter.faction && e.faction_code!==filter.faction) return false;
    if(filter.type && e.type_code!==filter.type) return false;
    if(filter.pack && !c.printings.some(p=>p.pack===filter.pack)) return false;
    if(filter.owned && !c.printings.some(p=>(collection[p.pack]??1)>0)) return false;
    if(filter.selected && !(deck.cards[c.code]>0)) return false;
    if(filter.cost!==undefined && filter.cost!=='' && String(e.cost ?? 'unknown')!==filter.cost) return false;
    if(filter.resource && !(e['resource_'+filter.resource]>0)) return false;
    if(filter.resources){
      const printed=Object.keys(resources).filter(key=>key!=='none'&&e['resource_'+key]>0);
      if(!filter.resources.some(key=>key==='none'?printed.length===0:printed.includes(key)))return false;
    }
    if(filter.trait && !normalize((c.es.traits||'')+' '+(e.traits||'')).includes(normalize(filter.trait))) return false;
    const langs=filter.language==='both'?['es','en']:[filter.language||'es'];
    return !q || langs.some(l=>{
      const fields=filter.searchFields??{name:true,text:true},data=c[l]||{};
      return (fields.name&&partialSearch([data.name,data.subname].join(' '),q))||(fields.text&&partialSearch(data.text,q));
    });
  }).sort((a,b)=>compareCards(a,b,filter.sorts||[filter.sort||'name']));
}
export function shortage(decks,cards,collection) {
  const needed={};
  for(const d of decks.filter(d=>d.armed)) for(const [code,n] of Object.entries(d.cards)) {
    if(!cards[code]) continue; const key=canonical(cards[code],cards);
    needed[key]??={quantity:0,decks:[]};needed[key].quantity+=n; needed[key].decks.push({name:d.name,quantity:n});
  }
  return Object.entries(needed).map(([code,value])=> {
    const c=cards[code];const available=(c.printings||[]).reduce((sum,p)=>sum+p.quantity*(collection[p.pack]??1),0);
    return {code,...value,available,missing:Math.max(0,value.quantity-available)};
  }).filter(x=>x.missing>0);
}
