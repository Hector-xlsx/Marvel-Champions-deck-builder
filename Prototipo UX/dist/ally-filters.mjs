export const ALLY_STATS=[['attack','Ataque'],['thwart','Intervención'],['health','Vida'],['attack_cost','Daño derivado ATQ'],['thwart_cost','Daño derivado INT']];
export function allyStatValue(card,field){
  const value=card.en?.[field];
  if(value===-1||value==='X')return 'variable';
  return Number.isFinite(value)&&value>=0?String(value):'0';
}
export function allyStatOptions(records){
  const allies=records.filter(c=>c.role==='deck_card'&&c.en.type_code==='ally'&&!c.en.hidden);
  return Object.fromEntries(ALLY_STATS.map(([field])=>[field,[...new Set(allies.map(c=>allyStatValue(c,field)))].sort((a,b)=>a==='variable'?1:b==='variable'?-1:Number(a)-Number(b))]));
}
export function setAllyStatValues(filter,field,selected,available){
  if(!ALLY_STATS.some(([key])=>key===field))throw Error('Atributo de aliado desconocido.');
  const values=[...new Set(selected)];
  if(available.every(value=>values.includes(value)))delete filter.values[field];
  else filter.values[field]=values;
}
export function normalizeAllyFilter(value,options){
  const result={enabled:value?.enabled===true,values:{}};
  for(const [field]of ALLY_STATS)if(Array.isArray(value?.values?.[field]))result.values[field]=[...new Set(value.values[field].filter(v=>typeof v==='string'&&/^(?:\d+(?:\.\d+)?|variable)$/.test(v)))].slice(0,100);
  if(options)for(const [field]of ALLY_STATS)if(result.values[field]&&options[field])setAllyStatValues(result,field,result.values[field],options[field]);
  return result;
}
export function matchesAllyFilter(card,filter){
  if(!filter?.enabled||card.en.type_code!=='ally')return true;
  return ALLY_STATS.every(([field])=>!Array.isArray(filter.values?.[field])||filter.values[field].includes(allyStatValue(card,field)));
}
