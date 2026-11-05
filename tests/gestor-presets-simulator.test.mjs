import test from 'node:test';
import assert from 'node:assert/strict';
import {FilterPresetStore,createPreset,presetCriteria,presetMatches,presetResults} from '../web/filter-presets.mjs';
import {DrawSimulator,printedHandSizes} from '../web/simulator.mjs';
const card=(code,type='ally',faction='basic')=>({code,role:'deck_card',en:{type_code:type,faction_code:faction},es:{name:code,text:'',traits:''},links:{},printings:[]});
const cards={a:card('a'),b:card('b','upgrade'),c:card('c','event','justice'),copy:card('copy'),hidden:{...card('hidden'),en:{hidden:true}},aux:{...card('aux'),role:'hero_auxiliary'}};cards.copy.links.duplicate_of='a';
const deck={cards:{a:1},aspects:['leadership']};
function storage(){const data=new Map();return {get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}
const codes=result=>result.map(c=>c.code);

test('presets combinan con O, deduplican y el ojo oculto excluye solo su contribución',()=>{
  const ally=createPreset({types:['ally']},'Aliados X-Force'),upgrade=createPreset({types:['upgrade']},'Mejoras aliados'),all=createPreset({},'Otros');
  assert.deepEqual(codes(presetResults([cards.a,cards.b,cards.c],[ally,upgrade],deck,{})),['a','b']);
  ally.enabled=false;assert.deepEqual(codes(presetResults([cards.a,cards.b],[ally,upgrade],deck,{})),['b']);
  all.enabled=false;assert.deepEqual(codes(presetResults([cards.a],[ally,all],deck,{})),[]);
  ally.enabled=true;all.enabled=true;assert.deepEqual(codes(presetResults([cards.a,cards.b],[ally,all],deck,{})),['a','b']);
});
test('el nombre no altera criterios y cada copia conserva configuración, fijados y UI independientes',()=>{
  const original=createPreset({types:['ally'],traits:['Mutante']},'Mejoras');original.pins=['a'];original.onlyPinned=true;original.ui={single:{type:true}};
  const copy=createPreset(original.criteria,'Nuevo',original);copy.criteria.types.push('event');copy.pins.push('b');copy.ui.single.type=false;
  assert.deepEqual(original.criteria.types,['ally']);assert.deepEqual(original.pins,['a']);assert.equal(original.ui.single.type,true);assert.equal(copy.onlyPinned,true);
  const noTrait=createPreset({types:['ally']},'Eventos');assert.deepEqual(codes(presetResults([cards.a,cards.c],[noTrait],deck,{})),['a']);
});
test('fijados persisten fuera de criterios y Mostrar solo fijados recupera el conjunto guardado',()=>{
  const p=createPreset({types:['ally'],factions:['leadership'],sameAspect:true,hideHero:true},'Pool');p.pins=['c'];
  assert.equal(presetMatches(cards.c,p,deck,{}),false);assert.deepEqual(codes(presetResults([cards.a,cards.c],[p],deck,{})),[]);assert.deepEqual(p.pins,['c']);
  p.onlyPinned=true;assert.deepEqual(codes(presetResults([cards.a,cards.c],[p],deck,{})),['c']);
  assert.deepEqual(codes(presetResults([cards.a,cards.c],[p],deck,{}, {selected:true})),[]);
});
test('orden y Solo cartas del mazo se aplican globalmente después de unir filtros',()=>{
  const p=createPreset({});assert.deepEqual(codes(presetResults([cards.c,cards.b,cards.a],[p],deck,{}, {sorts:['name']})),['a','b','c']);
  assert.deepEqual(codes(presetResults([cards.c,cards.b,cards.a],[p],deck,{}, {selected:true})),['a']);
});
test('cartas de héroes y colección también limitan los resultados fijados',()=>{
  const signature={...card('hero-aspect','event','justice'),heroSetCard:true,printings:[{pack:'hero-pack'}]};
  const basic={...card('regular'),printings:[{pack:'basic-pack'}]};
  const p=createPreset({hideHero:true,owned:false});p.pins=[signature.code,basic.code];
  for(const onlyPinned of [false,true]){
    p.onlyPinned=onlyPinned;
    assert.deepEqual(codes(presetResults([signature,basic],[p],deck,{})),[basic.code]);
    p.criteria.hideHero=false;
    assert.deepEqual(codes(presetResults([signature,basic],[p],deck,{'basic-pack':0},{owned:true})),[signature.code]);
    p.criteria.hideHero=true;
  }
});
test('criterios guardados no capturan héroe, orden ni restricciones globales de la galería',()=>{
  const c=presetCriteria({search:'abc',specialRule:{id:'cable'},sorts:['cost'],selected:true,searchFields:{name:false,text:false}});
  assert.equal(c.specialRule,undefined);assert.equal(c.sorts,undefined);assert.equal(c.selected,undefined);assert.equal(c.searchFields.name,true);
});
test('la regla especial se evalúa con el héroe actual y no queda congelada en un preset global',()=>{
  const scheme=card('s','player_side_scheme','justice'),p=createPreset({factions:['special'],sameAspect:true,hideHero:true});
  assert.deepEqual(codes(presetResults([scheme],[p],deck,{}, {specialRule:{id:'cable_side_schemes'}})),['s']);
  assert.deepEqual(codes(presetResults([scheme],[p],deck,{})),[]);
});
test('store carga globalmente por código canónico y preserva registros dañados sin tocar mazos',()=>{
  const mem=storage(),one=new FilterPresetStore(mem,cards),p=createPreset({types:['ally']});p.pins=['copy','a','hidden','aux','desconocido'];one.save(p);mem.setItem('marvel.filter.v1.damaged','{');mem.setItem('marvel.deck.demo','original');
  const two=new FilterPresetStore(mem,cards);assert.deepEqual(two.load(p.id).pins,['a']);assert.equal(two.list().length,1);assert.equal(mem.getItem('marvel.filter.v1.damaged'),'{');assert.equal(mem.getItem('marvel.deck.demo'),'original');
});
test('actualizaciones parciales desde dos stores conservan criterios y fijados de otras operaciones',async()=>{
  const mem=storage(),one=new FilterPresetStore(mem,cards),two=new FilterPresetStore(mem,cards),p=createPreset({types:['ally']});one.save(p);
  await Promise.all([one.update(p.id,r=>{r.name='Mis aliados';}),two.update(p.id,r=>{r.pins.push('a');})]);
  const found=one.load(p.id);assert.equal(found.name,'Mis aliados');assert.deepEqual(found.pins,['a']);assert.deepEqual(found.criteria.types,['ally']);
});
test('quitar fijados de un filtro deja los otros; quitar una carta globalmente deja las otras cartas',async()=>{
  const store=new FilterPresetStore(storage(),cards),p=createPreset({}),q=createPreset({});p.pins=['a','b'];q.pins=['a','c'];store.save(p);store.save(q);
  await store.update(p.id,r=>{r.pins=[];});assert.deepEqual(store.load(q.id).pins,['a','c']);
  await store.update(q.id,r=>{r.pins=r.pins.filter(code=>code!=='a');});assert.deepEqual(store.load(q.id).pins,['c']);
});
test('eliminar un preset espera las escrituras previas y no lo recrea después',async()=>{
  const store=new FilterPresetStore(storage(),cards),p=createPreset({});store.save(p);const saving=store.update(p.id,r=>{r.name='Edición pendiente';}),removing=store.remove(p.id);await Promise.all([saving,removing]);assert.equal(store.load(p.id),null);
});
test('fallo de almacenamiento conserva el preset anterior y la cola puede volver a guardar',async()=>{
  const mem=storage(),store=new FilterPresetStore(mem,cards),p=createPreset({});store.save(p);const save=mem.setItem;mem.setItem=()=>{throw Error('Cuota');};
  await assert.rejects(store.update(p.id,r=>{r.name='No guardado';}),/Cuota/);assert.equal(store.load(p.id).name,p.name);mem.setItem=save;await store.update(p.id,r=>{r.name='Recuperado';});assert.equal(store.load(p.id).name,'Recuperado');
});

function assertConservation(sim,total){const all=[...sim.hand,...sim.pile];assert.equal(all.length,total);assert.equal(new Set(all.map(c=>c.id)).size,total);}
test('simulador roba copias físicas sin duplicarlas, limita al mazo restante y no altera cantidades de entrada',()=>{
  const input={a:3,b:2},sim=new DrawSimulator(input,()=>.3);assert.equal(sim.draw(1),1);assert.equal(sim.draw(2),2);assert.equal(sim.draw(6),2);assert.equal(sim.hand.length,5);assert.equal(sim.pile.length,0);assert.deepEqual(input,{a:3,b:2});assertConservation(sim,5);
  assert.throws(()=>sim.draw(-1));assert.throws(()=>sim.draw(1.5));
});
test('volver a robar reemplaza seleccionadas antes de devolverlas y mantiene las no seleccionadas',()=>{
  const sim=new DrawSimulator({a:3,b:3},()=>.4);sim.draw(3);const chosen=sim.hand.slice(0,2).map(c=>c.id),kept=sim.hand[2].id;for(const id of chosen)sim.toggle(id);
  assert.deepEqual(sim.redrawSelected(),{requested:2,replaced:2});assert.equal(sim.hand.some(c=>chosen.includes(c.id)),false);assert.ok(sim.hand.some(c=>c.id===kept));assert.equal(sim.selected.size,0);assertConservation(sim,6);
});
test('si no alcanzan las restantes, reemplaza las disponibles sin perder ni reducir la mano',()=>{
  const sim=new DrawSimulator({a:4},()=>.5);sim.draw(3);for(const c of sim.hand)sim.toggle(c.id);assert.deepEqual(sim.redrawSelected(),{requested:3,replaced:1});assert.equal(sim.hand.length,3);assertConservation(sim,4);
});
test('devolver seleccionadas baraja; Reset recupera todo el mazo y vacía selección y mano',()=>{
  const sim=new DrawSimulator({a:4,b:2},()=>.7);sim.draw(6);sim.toggle(sim.hand[0].id);sim.toggle(sim.hand[1].id);assert.equal(sim.returnSelected(),2);assert.equal(sim.hand.length,4);assert.equal(sim.pile.length,2);assertConservation(sim,6);
  sim.toggle(sim.hand[0].id);sim.reset();assert.equal(sim.hand.length,0);assert.equal(sim.selected.size,0);assert.equal(sim.pile.length,6);assertConservation(sim,6);
});
test('mano vacía y mazo vacío son estados válidos sin excepciones ni cartas inventadas',()=>{
  const sim=new DrawSimulator({});assert.equal(sim.draw(6),0);assert.equal(sim.returnSelected(),0);assert.deepEqual(sim.redrawSelected(),{requested:0,replaced:0});sim.toggle('ausente');assert.equal(sim.selected.size,0);assertConservation(sim,0);
});
test('tamaños impresos usan alter ego por conjunto si el reverso del héroe no es alter ego',()=>{
  const h={code:'h',role:'identity',links:{other_face:'support',set:'spdr'},en:{type_code:'hero',hand_size:3}},support={role:'deck_card',en:{type_code:'support'},links:{set:'spdr'}},a={role:'identity',links:{set:'spdr'},en:{type_code:'alter_ego',hidden:true,hand_size:4}};
  assert.deepEqual(printedHandSizes(h,{h,support,a}),{hero:3,alter:4});assert.deepEqual(printedHandSizes(undefined,{h,a}),{hero:null,alter:null});
});
