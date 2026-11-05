import {plain} from './catalog.mjs';

/** Return text segments; callers render these with text nodes, never innerHTML. */
export function ruleTextParts(value){
  const text=plain(value),parts=[];let offset=0;
  for(const match of text.matchAll(/\[\[([^\[\]]+)\]\]/g)){
    if(match.index>offset)parts.push({text:text.slice(offset,match.index),bold:false});
    parts.push({text:match[1].toLocaleUpperCase('es'),bold:true});offset=match.index+match[0].length;
  }
  if(offset<text.length)parts.push({text:text.slice(offset),bold:false});
  return parts;
}

export function identityPreviewCards(hero,cards){
  if(!hero)return [];
  const linked=cards[hero.links?.other_face];
  const family=Object.values(cards).filter(card=>hero.links?.set&&card.role==='identity'&&card.links?.set===hero.links.set);
  const base=hero.en.type_code==='hero'&&linked?.en.type_code==='alter_ego'
    ? hero : family.find(card=>card.en.type_code==='hero'&&cards[card.links.other_face]?.en.type_code==='alter_ego')||hero;
  const alter=cards[base.links?.other_face]||family.find(card=>card.en.type_code==='alter_ego');
  return [...new Set([base,alter,...family.filter(card=>card.en.type_code==='hero'&&!card.en.hidden)].filter(Boolean))];
}
