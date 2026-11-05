export function deckStatistics(deck,cards){
  const result={count:0,resources:{physical:0,mental:0,energy:0,wild:0},heroResources:{physical:0,mental:0,energy:0,wild:0},resourceCards:{physical:{},mental:{},energy:{},wild:{}},factions:{},costs:[],ignoredCosts:0,totalResources:0,resourcesPerCard:0},costs=new Map();
  for(const [code,n]of Object.entries(deck.cards)){
    const card=cards[code];if(!card||n<=0)continue;const data=card.en;result.count+=n;
    for(const key of Object.keys(result.resources)){const symbols=data['resource_'+key]||0;result.resources[key]+=symbols*n;if(data.faction_code==='hero')result.heroResources[key]+=symbols*n;if(symbols>0)result.resourceCards[key][symbols]=(result.resourceCards[key][symbols]||0)+n;}
    result.factions[data.faction_code]=(result.factions[data.faction_code]||0)+n;
    if(Number.isFinite(data.cost)&&data.cost>=0){const cost=String(data.cost);costs.set(cost,(costs.get(cost)||0)+n);}else result.ignoredCosts+=n;
  }
  const max=Math.max(-1,...[...costs.keys()].map(Number));result.costs=Array.from({length:max+1},(_,i)=>[String(i),costs.get(String(i))||0]);
  result.totalResources=Object.values(result.resources).reduce((n,q)=>n+q,0);result.resourcesPerCard=result.count?result.totalResources/result.count:0;return result;
}
