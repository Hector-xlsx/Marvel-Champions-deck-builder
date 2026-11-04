import test from 'node:test';
import assert from 'node:assert/strict';
import {ALLY_STATS,allyStatValue,allyStatOptions,normalizeAllyFilter,matchesAllyFilter,setAllyStatValues} from '../web/ally-filters.mjs';
import {filterCards} from '../web/catalog.mjs';
import {presetCriteria,createPreset,presetResults,FilterPresetStore} from '../web/filter-presets.mjs';
const card=(code,type,stats={})=>({code,role:'deck_card',en:{type_code:type,faction_code:'basic',...stats},es:{name:code},links:{}});
const a=card('a','ally',{health:2,attack:1,thwart:2,attack_cost:1,thwart_cost:2}),b=card('b','ally',{health:6,attack:3,thwart:0,attack_cost:2}),event=card('event','event'),support=card('support','support'),deck={cards:{},aspects:[]};
const codes=result=>result.map(c=>c.code),stats=values=>({enabled:true,values});

test('opciones derivadas usan solo aliados visibles y los valores existentes, sin fijar un máximo de cuatro',()=>{
  const hidden={...card('hidden','ally',{health:99}),en:{type_code:'ally',health:99,hidden:true}};
  const options=allyStatOptions([a,b,event,{...card('aux','ally',{health:100}),role:'hero_auxiliary'},hidden]);
  assert.deepEqual(options.health,['2','6']);assert.deepEqual(options.attack_cost,['1','2']);assert.deepEqual(options.thwart_cost,['0','2']);
  assert.equal(Object.keys(options).length,ALLY_STATS.length);
});

test('guion, cero y ausencia comparten cero; variable no se confunde con cero',()=>{
  for(const value of [undefined,null,0,'—'])assert.equal(allyStatValue(card('x','ally',{thwart:value}),'thwart'),'0');
  for(const value of [-1,'X'])assert.equal(allyStatValue(card('x','ally',{thwart:value}),'thwart'),'variable');
  assert.deepEqual(allyStatOptions([a,card('x','ally',{thwart:-1})]).thwart,['2','variable']);
});

test('filtro de aliados combina O dentro de un atributo y Y entre atributos sin afectar a eventos ni apoyos',()=>{
  const filter={types:['ally','event','support'],allyStats:stats({health:['2','6'],attack:['1'],thwart_cost:['2']})};
  assert.deepEqual(codes(filterCards([a,b,event,support],filter,deck,{})),['a','event','support']);
  assert.deepEqual(codes(filterCards([a,b,event,support],{...filter,allyStats:stats({health:[]})},deck,{})),['event','support']);
  assert.deepEqual(codes(filterCards([a,b,event,support],{...filter,types:['ally']},deck,{})),['a']);
});

test('desactivar conserva valores y deja de restringir; los otros filtros generales siguen vigentes',()=>{
  const config=stats({health:['2']}),before=JSON.stringify(config);assert.equal(matchesAllyFilter(b,config),false);assert.equal(JSON.stringify(config),before);
  const off={...config,enabled:false};assert.equal(matchesAllyFilter(b,off),true);assert.deepEqual(off.values,config.values);
  assert.deepEqual(codes(filterCards([a,b,event],{types:['event'],allyStats:off},deck,{})),['event']);
});

test('presets antiguos no activan el filtro; copiar y guardar conserva criterios independientes y combinación O',()=>{
  assert.deepEqual(presetCriteria({}).allyStats,{enabled:false,values:{}});
  const first=createPreset({allyStats:stats({health:['2']})},'Vida 2'),copy=createPreset(first.criteria,'Copia',first);
  copy.criteria.allyStats.values.health.push('6');assert.deepEqual(first.criteria.allyStats.values.health,['2']);
  const entries=new Map(),storage={getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,v)},store=new FilterPresetStore(storage,{});store.save(first);
  assert.deepEqual(store.load(first.id).criteria.allyStats,stats({health:['2']}));
  assert.deepEqual(codes(presetResults([a,b,event],[first,copy],deck,{})),['a','b','event']);
  assert.deepEqual(normalizeAllyFilter({enabled:true,values:{health:['2','2','oops',3],unknown:['9']}}),stats({health:['2']}));
});

test('todos los valores equivalen a ausencia de restricción, incluso para valores futuros no presentes en las opciones',()=>{
  const filter=stats({attack_cost:['1']}),future=card('future','ally',{attack_cost:4}),options=['0','1','2'];
  assert.equal(matchesAllyFilter(future,filter),false);
  setAllyStatValues(filter,'attack_cost',options,options);
  assert.equal(Object.hasOwn(filter.values,'attack_cost'),false);assert.equal(matchesAllyFilter(future,filter),true);
  const saved=presetCriteria({allyStats:filter}).allyStats;
  assert.equal(matchesAllyFilter(future,saved),true);
  assert.deepEqual(allyStatOptions([a,b,future]).attack_cost,['1','2','4']);
  setAllyStatValues(filter,'attack_cost',[],options);assert.equal(matchesAllyFilter(future,filter),false);assert.equal(matchesAllyFilter(event,filter),true);
  setAllyStatValues(filter,'attack_cost',['1'],options);assert.equal(matchesAllyFilter(a,filter),true);assert.equal(matchesAllyFilter(b,filter),false);
});

test('selecciones completas anteriores se normalizan sin restringir y el orden de atributos coincide con la interfaz',()=>{
  const options=allyStatOptions([a,b]);
  const legacy=normalizeAllyFilter(stats({health:['2','6'],attack:['1']}),options);
  assert.equal(Object.hasOwn(legacy.values,'health'),false);assert.deepEqual(legacy.values.attack,['1']);
  assert.deepEqual(ALLY_STATS.map(([field])=>field),['attack','thwart','health','attack_cost','thwart_cost']);
});
