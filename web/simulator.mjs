export class DrawSimulator{
  constructor(quantities,random=Math.random){this.quantities={...quantities};this.random=random;this.reset();}
  shuffle(){for(let i=this.pile.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.pile[i],this.pile[j]]=[this.pile[j],this.pile[i]];}}
  reset(){this.hand=[];this.selected=new Set();this.pile=[];for(const [code,n]of Object.entries(this.quantities))for(let i=0;i<n;i++)this.pile.push({id:code+'#'+i,code});this.shuffle();}
  draw(count){if(!Number.isInteger(count)||count<0)throw Error('Cantidad de robo inválida.');const taken=this.pile.splice(0,count);this.hand.push(...taken);return taken.length;}
  toggle(id){if(!this.hand.some(c=>c.id===id))return;if(this.selected.has(id))this.selected.delete(id);else this.selected.add(id);}
  returnSelected(){const back=this.hand.filter(c=>this.selected.has(c.id));this.hand=this.hand.filter(c=>!this.selected.has(c.id));this.pile.push(...back);this.selected.clear();this.shuffle();return back.length;}
  redrawSelected(){
    const chosen=this.hand.filter(c=>this.selected.has(c.id)),back=chosen.slice(0,this.pile.length),ids=new Set(back.map(c=>c.id));
    this.hand=this.hand.filter(c=>!ids.has(c.id));this.draw(back.length);this.pile.push(...back);this.shuffle();this.selected.clear();return {requested:chosen.length,replaced:back.length};
  }
}
export function printedHandSizes(hero,cards){
  if(!hero)return {hero:null,alter:null};
  const direct=cards[hero?.links?.other_face],alter=direct?.en.type_code==='alter_ego'?direct:Object.values(cards).find(c=>c.role==='identity'&&c.en.type_code==='alter_ego'&&c.links.set===hero?.links?.set);
  const size=card=>Number.isInteger(card?.en.hand_size)&&card.en.hand_size>0?card.en.hand_size:null;
  return {hero:size(hero),alter:size(alter)};
}
