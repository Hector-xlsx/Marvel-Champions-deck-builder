import {canonical,requiredHeroCards,canSetQuantity} from './catalog.mjs';
export const AUXILIARY_GROUP='reserved:auxiliaries';
export function automaticAuxiliaries(deck,cards){
  const set=cards[deck.hero]?.links?.set;if(!set)return {};
  return Object.fromEntries(Object.values(cards).filter(c=>c.role==='hero_auxiliary'&&!c.en.hidden&&(c.links.parent_hero_set===set||c.links.set===set)).map(c=>[c.code,c.en.quantity||1]));
}
export function auxiliaryCards(deck,cards){return {...(deck.auxiliaries||{}),...automaticAuxiliaries(deck,cards)};}
export function moveAuxiliary(deck,code,toAuxiliary,cards){
  const root=canonical(cards[code],cards),automatic=automaticAuxiliaries(deck,cards);
  if(automatic[code])throw Error('Los auxiliares propios del héroe permanecen en Auxiliares.');
  deck.auxiliaries??={};
  if(toAuxiliary){
    if(requiredHeroCards(deck,cards)[root])throw Error('Las cartas obligatorias del héroe no pueden retirarse del mazo.');
    const keys=Object.keys(deck.cards).filter(k=>canonical(cards[k],cards)===root),quantity=keys.reduce((n,k)=>n+deck.cards[k],0);
    if(!quantity)throw Error('La carta no está en el mazo.');
    deck.auxiliaries[root]=(deck.auxiliaries[root]||0)+quantity;for(const key of keys)delete deck.cards[key];
  }else{
    if(cards[root].role!=='deck_card')throw Error('Esta carta solo puede estar en Auxiliares.');
    const quantity=deck.auxiliaries[root];if(!quantity)throw Error('La carta no está en Auxiliares.');
    const existing=Object.entries(deck.cards).filter(([key])=>canonical(cards[key],cards)===root).reduce((n,[,q])=>n+q,0);
    if(!canSetQuantity(deck,root,quantity+existing,cards))throw Error('La cantidad auxiliar supera el límite del mazo; ajústala antes de devolverla.');
    deck.cards[root]=(deck.cards[root]||0)+quantity;delete deck.auxiliaries[root];
  }
}
