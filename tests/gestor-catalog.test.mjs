import {test} from 'node:test';
import assert from 'node:assert/strict';
import {specialRuleFor,traitCounts} from '../web/catalog.mjs';
import {canonical,limit,filterCards,shortage,traits,cardTraits,automaticName,allowedFactions,requiredHeroCards,ensureHeroCards,canSetQuantity,selectionState,toggleSelection,filterDecks,compareCards,CARD_SORT_DEFAULTS,paginateCards} from '../web/catalog.mjs';
const card=(code,extra={})=>({code,en:{name:'New strike',text:'Draw a card',deck_limit:1,pack_code:'core',quantity:2,...extra},es:{name:'Golpe nuevo',text:'Roba una carta'},links:{},printings:[{code,pack:'core',quantity:2}]});
test('regla de Cable admite planes de otros aspectos, respeta los otros filtros y excluye conjuntos de otros héroes',()=>{
  const hero=card('h');hero.links.set='cable';const rule=specialRuleFor(hero);
  assert.equal(rule.source,'40001b');assert.equal(specialRuleFor(card('otro')),null);
  const list=[card('a',{type_code:'player_side_scheme',faction_code:'justice',cost:2}),card('b',{type_code:'player_side_scheme',faction_code:'aggression',cost:3}),card('c',{type_code:'event',faction_code:'aggression',cost:2}),card('d',{type_code:'player_side_scheme',faction_code:'hero',cost:2}),card('e',{type_code:'ally',faction_code:'leadership',cost:2})];
  const deck={aspects:['leadership'],cards:{}},filter={factions:['special'],specialRule:rule,sameAspect:true,hideHero:true};
  assert.deepEqual(filterCards(list,filter,deck,{}).map(c=>c.code),['a','b']);
  assert.deepEqual(filterCards(list,{...filter,costs:['2']},deck,{}).map(c=>c.code),['a']);
  assert.deepEqual(filterCards(list,{...filter,factions:['special','leadership']},deck,{}).map(c=>c.code),['a','b','e']);
  assert.equal(filterCards(list,{...filter,types:['event']},deck,{}).length,0);
});
test('recursos impresos combinan símbolos con O y separan cartas sin recurso',()=>{
  const list=[card('a',{resource_energy:1,resource_mental:1}),card('b',{resource_physical:1}),card('c',{resource_wild:1}),card('d',{})],deck={cards:{},aspects:[]};
  assert.deepEqual(filterCards(list,{resources:['energy','physical']},deck,{}).map(c=>c.code),['a','b']);
  assert.deepEqual(filterCards(list,{resources:['none']},deck,{}).map(c=>c.code),['d']);
  assert.equal(filterCards(list,{resources:[]},deck,{}).length,0);
});
test('contadores de rasgos cuentan familias distintas, no reimpresiones ni rasgos repetidos',()=>{
  const a=card('a'),b=card('b'),copy=card('copy');a.es.traits='Mutante. Mutante.';b.es.traits='Mutante. Arma.';copy.es.traits='Mutante.';copy.links.duplicate_of='a';
  const cards={a,b,copy};assert.deepEqual(traitCounts([a,b,copy],c=>canonical(c,cards)),[{name:'Mutante',count:2},{name:'Arma',count:1}]);
});
test('el selector de búsqueda separa español e inglés y combina ambos',()=>{
  const c=card('1');const f={language:'es',search:'new strike',cost:''};
  assert.equal(filterCards([c],f,{cards:{}},{}).length,0);
  assert.equal(filterCards([c],{...f,language:'en'},{cards:{}},{}).length,1);
  assert.equal(filterCards([c],{...f,language:'both'},{cards:{}},{}).length,1);
  assert.equal(filterCards([c],{...f,search:'golpe'},{cards:{}},{}).length,1);
});
test('reimpresiones y reversos comparten familia; límites ausentes usan tres y los explícitos se conservan',()=>{
  const a=card('a'),b=card('b'),back=card('back',{hidden:true});b.links.duplicate_of='a';back.links.other_face='b';
  assert.equal(canonical(back,{a,b,back}),'a');assert.equal(limit(a),1);delete a.en.deck_limit;assert.equal(limit(a),3);
});
test('faltantes suman solo mazos armados y copias de productos poseídos',()=>{
  const a=card('a'),b=card('b');b.links.duplicate_of='a';a.printings.push({code:'b',pack:'exp',quantity:1});
  const decks=[{name:'Uno',armed:true,cards:{a:2}},{name:'Dos',armed:true,cards:{b:2}},{name:'Prueba',armed:false,cards:{a:10}}];
  assert.deepEqual(shortage(decks,{a,b},{core:1,exp:0}).map(x=>[x.quantity,x.available,x.missing]),[[4,2,2]]);
  assert.equal(shortage(decks,{a,b},{core:2,exp:0}).length,0);
});
test('casillas combinan valores con O en cada familia y familias con Y; ninguna seleccionada no muestra cartas',()=>{
  const cards=[card('a',{type_code:'ally',faction_code:'basic',cost:0}),card('b',{type_code:'event',faction_code:'justice',cost:2}),card('c',{type_code:'upgrade',faction_code:'justice',cost:2})];
  const f={types:['ally','event'],factions:['basic','justice'],costs:['0','2']};
  assert.deepEqual(filterCards(cards,f,{cards:{},aspects:[]},{}).map(c=>c.code),['a','b']);
  assert.equal(filterCards(cards,{...f,types:[]},{cards:{},aspects:[]},{}).length,0);
  assert.equal(filterCards(cards,{...f,costs:[]},{cards:{},aspects:[]},{}).length,0);
});
test('ocultar héroe y limitar aspectos son controles independientes y no alteran el mazo',()=>{
  const deck={aspects:['justice'],cards:{a:3}};
  assert.deepEqual(allowedFactions({sameAspect:true,hideHero:true},deck),['basic','justice']);
  assert.deepEqual(allowedFactions({sameAspect:true,hideHero:false},deck),['hero','basic','justice']);
  const cards=[card('a',{faction_code:'hero'}),card('b',{faction_code:'basic'}),card('c',{faction_code:'justice'}),card('d',{faction_code:'aggression'})];
  assert.deepEqual(filterCards(cards,{sameAspect:true,hideHero:true},deck,{}).map(c=>c.code),['b','c']);
  assert.deepEqual(deck.cards,{a:3});
  assert.deepEqual(allowedFactions({sameAspect:true,hideHero:true},{aspects:[]}),['basic']);
});
test('rasgos son coincidencias completas con O y conservan abreviaturas',()=>{
  assert.deepEqual(traits('S.H.I.E.L.D. Espía.'),['S.H.I.E.L.D','Espía']);
  const a=card('a'),b=card('b'),c=card('c');a.es.traits='Mutante. Patrulla-X.';b.es.traits='Vengador.';c.es.traits='Guerrero araña.';
  assert.deepEqual(cardTraits(a),['Mutante','Patrulla-X']);
  assert.deepEqual(filterCards([a,b,c],{traits:['mutante','Vengador']},{cards:{},aspects:[]},{}).map(c=>c.code),['a','b']);
  assert.equal(filterCards([c],{traits:['Araña']},{cards:{},aspects:[]},{}).length,0);
});
test('nombre automático usa héroe, aspectos, evita duplicados y omite los cuatro aspectos generales',()=>{
  const hero=card('h');hero.es.name='Adam Warlock';
  const deck={id:'one',name:'Nuevo mazo',aspects:['justice','leadership']};
  assert.equal(automaticName(deck,hero),'Adam Warlock - Justicia / Liderazgo');
  const other={id:'two',name:'Adam Warlock - Justicia / Liderazgo'};
  assert.equal(automaticName(deck,hero,[other]),'Adam Warlock - Justicia / Liderazgo (2)');
  assert.equal(automaticName({...deck,aspects:['aggression','justice','leadership','protection']},hero),'Adam Warlock');
});
test('las copias obligatorias del héroe se protegen también usando otra impresión',()=>{
  const h=card('h'),a=card('a',{faction_code:'hero',quantity:2,deck_limit:2}),copy=card('copy'),other=card('other',{faction_code:'hero'});
  h.role='identity';h.links.set='my-hero';a.role='deck_card';a.links.set='my-hero';copy.role='deck_card';copy.links.duplicate_of='a';other.role='deck_card';other.links.set='other-hero';
  const cards={h,a,copy,other},deck={hero:'h',cards:{a:2,other:1},versions:[]};
  assert.deepEqual(requiredHeroCards(deck,cards),{a:2});
  for(const n of [0,1,-1,1.5,3])assert.equal(canSetQuantity(deck,'copy',n,cards),false);
  assert.equal(canSetQuantity(deck,'copy',2,cards),true);assert.equal(canSetQuantity(deck,'other',0,cards),true);
});
test('restaurar obligatorias completa solo el borrador sin alterar su historial ni duplicar reimpresiones',()=>{
  const h=card('h'),a=card('a',{faction_code:'hero',quantity:2}),copy=card('copy');h.links.set='hero';a.role='deck_card';a.links.set='hero';copy.links.duplicate_of='a';
  const deck={hero:'h',cards:{copy:1},versions:[{snapshot:{cards:{copy:1}}}]};
  assert.equal(ensureHeroCards(deck,{h,a,copy}),1);assert.deepEqual(deck.cards,{copy:1,a:1});assert.deepEqual(deck.versions[0].snapshot.cards,{copy:1});
  assert.equal(ensureHeroCards(deck,{h,a,copy}),0);
});
test('selector de tres estados cambia solo opciones visibles y completa la selección parcial',()=>{
  const values=['a','b'];let selected=new Set(['hidden']);assert.equal(selectionState(values,selected),'none');
  selected=toggleSelection(values,selected);assert.equal(selectionState(values,selected),'all');assert.equal(selected.has('hidden'),true);
  selected.delete('a');assert.equal(selectionState(values,selected),'partial');selected=toggleSelection(values,selected);assert.equal(selectionState(values,selected),'all');
  selected=toggleSelection(values,selected);assert.deepEqual([...selected],['hidden']);
});
test('la biblioteca filtra por héroe/aspecto, ordena texto y números y conserva desmarcados de la sesión',()=>{
  const a={id:'a',name:'Zeta',hero:'h1',aspects:['justice'],cards:{x:10},versions:[],armed:true};
  const b={id:'b',name:'Alfa',hero:'h2',aspects:['protection'],cards:{x:2},versions:[],armed:false};
  assert.deepEqual(filterDecks([a,b],{sortKey:'name',direction:1}).map(d=>d.id),['b','a']);
  assert.deepEqual(filterDecks([a,b],{sortKey:'name',direction:-1}).map(d=>d.id),['a','b']);
  assert.deepEqual(filterDecks([a,b],{sortKey:'count',direction:1}).map(d=>d.id),['b','a']);
  assert.deepEqual(filterDecks([a,b],{sortKey:'name',direction:0}).map(d=>d.id),['a','b']);
  assert.deepEqual(filterDecks([a,b],{hero:'h2',aspect:'protection'}).map(d=>d.id),['b']);
  assert.deepEqual(filterDecks([a,b],{armedOnly:true,retained:new Set(['b'])}).map(d=>d.id),['a','b']);
  assert.deepEqual(filterDecks([a,b],{armedOnly:true}).map(d=>d.id),['a']);
});
test('la galería ordena aspecto, tipo y coste respetando prioridades y desempata por nombre',()=>{
  const make=(code,faction,type,cost)=>card(code,{faction_code:faction,type_code:type,cost});
  const list=[make('j2','justice','ally',2),make('b3','basic','event',3),make('j0','justice','ally',0),make('b1','basic','ally',4),make('jn','justice','resource',null),make('jx','justice','ally',-1)];
  const deck={cards:{},aspects:[]};
  assert.deepEqual(CARD_SORT_DEFAULTS,['faction','type','cost']);
  assert.deepEqual(filterCards(list,{sorts:CARD_SORT_DEFAULTS},deck,{}).map(c=>c.code),['b1','b3','j0','j2','jx','jn']);
  assert.deepEqual(filterCards(list,{sorts:['cost','faction','type']},deck,{}).map(c=>c.code),['j0','j2','b3','b1','jx','jn']);
  assert.equal(compareCards(list[4],list[5],['cost']),-1); // Both non-numeric costs have a stable name/code tie-break.
  assert.deepEqual(filterCards(list,{sorts:['type','type','']},deck,{}).map(c=>c.code),['b1','j0','j2','jx','b3','jn']);
});
test('paginación usa filas por columnas, limita páginas y cero muestra todas las cartas',()=>{
  const cards=Array.from({length:25},(_,i)=>({code:String(i)}));
  const page=paginateCards(cards,{rows:2,columns:5,page:2});assert.equal(page.pages,3);assert.equal(page.items.length,10);assert.equal(page.items[0].code,'10');
  const last=paginateCards(cards,{rows:2,columns:5,page:99});assert.equal(last.page,3);assert.equal(last.items.length,5);
  const unlimited=paginateCards(cards,{rows:0,columns:2,page:5});assert.equal(unlimited.pages,1);assert.equal(unlimited.items.length,25);
  assert.equal(paginateCards([],{rows:3,columns:2}).pages,1);
});
test('agrupar selección prioriza solo cartas filtradas y conserva su orden relativo',()=>{
  const cards=['a','b','c','d','e'].map(code=>({code}));const selectedCodes=new Set(['c','e','fuera-del-filtro']);
  const result=paginateCards(cards,{rows:1,columns:3,selectedFirst:true,selectedCodes});
  assert.deepEqual(result.items.map(c=>c.code),['c','e','a']);assert.equal(result.total,5);
  assert.deepEqual(cards.map(c=>c.code),['a','b','c','d','e']);
});
