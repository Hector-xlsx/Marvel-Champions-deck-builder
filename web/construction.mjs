import {canonical,aspectCodes,specialRuleFor,specialRuleAllows,requiredHeroCards,limit} from './catalog.mjs';
export function constructionReport(deck,cards){
  const byCard={},issues=[],hero=cards[deck.hero],minimum=requiredHeroCards(deck,cards);
  if(!hero)return {byCard,issues,removable:[]};
  const add=(code,message,direct=false)=>{byCard[code]??={messages:[],direct:false};byCard[code].messages.push(message);byCard[code].direct||=direct;};
  const grouped={};for(const [code,n]of Object.entries(deck.cards)){if(!cards[code])continue;const root=canonical(cards[code],cards);grouped[root]=(grouped[root]||0)+n;}
  const aspects=deck.aspects.filter(a=>aspectCodes.includes(a)),adam=hero.code==='21031a',spider=hero.code==='04031a',rule=specialRuleFor(hero),off=[];
  for(const [code,n]of Object.entries(grouped)){
    const c=cards[code],f=c.en.faction_code,own=f==='hero'&&c.links.set===hero.links.set;
    const allowed=own||f==='basic'||(adam?['aggression','justice','leadership','protection'].includes(f):aspects.includes(f))||specialRuleAllows(c,rule);
    if(!allowed)add(code,'No corresponde al héroe y a los aspectos elegidos.',true);
    if(!own&&f!=='basic'&&!aspects.includes(f)&&specialRuleAllows(c,rule))off.push(code);
    const max=adam&&!own?1:Math.max(minimum[code]||0,limit(c));if(n>max)add(code,`Máximo ${max} copias para este mazo.`,true);
  }
  const aggregate=(message,codes)=>{issues.push(message);for(const code of codes)add(code,message);};
  if(rule?.id==='gamora'&&off.reduce((n,c)=>n+grouped[c],0)>6)aggregate('Gamora permite hasta 6 copias de eventos de otros aspectos; elige cuáles retirar.',off);
  if(rule?.id==='maria_hill'&&off.length>3)aggregate('Maria Hill permite hasta 3 apoyos distintos de otros aspectos; elige cuáles retirar.',off);
  const counts=Object.fromEntries(aspectCodes.map(a=>[a,Object.entries(grouped).filter(([c])=>cards[c].en.faction_code===a).reduce((n,[,q])=>n+q,0)]));
  if(spider){if(aspects.length!==2)issues.push('Spiderwoman requiere exactamente dos aspectos.');else if(counts[aspects[0]]!==counts[aspects[1]])issues.push('Spiderwoman requiere igual cantidad de cartas de sus dos aspectos.');}
  if(adam){const four=['aggression','justice','leadership','protection'];if(new Set(four.map(a=>counts[a])).size>1)issues.push('Adam Warlock requiere igual cantidad de cartas de los cuatro aspectos generales.');if(aspects.length!==4||!four.every(a=>aspects.includes(a)))issues.push('Selecciona los cuatro aspectos generales para Adam Warlock.');}
  return {byCard,issues,removable:Object.keys(byCard).filter(c=>!minimum[c])};
}
export function removeConstructionCards(deck,codes,cards){
  const report=constructionReport(deck,cards),allowed=new Set(report.removable);
  for(const key of Object.keys(deck.cards))if(allowed.has(canonical(cards[key],cards))&&codes.includes(canonical(cards[key],cards)))delete deck.cards[key];
  return deck;
}
