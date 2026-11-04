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
  const linked=cards[hero.links?.other_face],alter=linked?.en.type_code==='alter_ego'?linked:Object.values(cards).find(c=>hero.links?.set&&c.role==='identity'&&c.en.type_code==='alter_ego'&&c.links?.set===hero.links?.set);
  return [hero,...(alter&&alter.code!==hero.code?[alter]:[])];
}
