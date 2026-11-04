import test from 'node:test';
import assert from 'node:assert/strict';
import {specialRuleFor,specialRuleAllows,filterCards,canSetQuantity,shortage} from '../web/catalog.mjs';
import {constructionReport,removeConstructionCards} from '../web/construction.mjs';
import {AUXILIARY_GROUP,automaticAuxiliaries,auxiliaryCards,moveAuxiliary} from '../web/auxiliaries.mjs';
import {createDeck,addVersion,validateImport} from '../web/model.mjs';
import {addCustomGroup,moveToGroup,listDeckGroups,reservedGroupName} from '../web/groups.mjs';
import {deckStatistics} from '../web/statistics.mjs';
const card=(code,type='event',faction='basic',extra={})=>({code,role:'deck_card',en:{type_code:type,faction_code:faction,quantity:1,deck_limit:3,...extra},es:{name:code,text:'Inflige daño a un enemigo.',traits:''},links:{set:'normal'},printings:[{quantity:1,pack:'test'}]});
const hero=(code,set)=>({...card(code,'hero','hero'),role:'identity',links:{set}});
const deck=(h,entries={},aspects=['leadership'])=>({...createDeck(),hero:h,aspects,cards:entries});

test('reglas individuales de los cinco héroes reconocen tipo, rasgo e icono impreso sin admitir cartas de otro conjunto',()=>{
  const event=card('a','event','justice');event.es.traits='Ataque.';
  const ally=card('b','ally','justice');ally.en.traits='X-Men.';
  const support=card('c','support','justice');support.es.traits='S.H.I.E.L.D.';
  for(const [h,c]of [['18001a',event],['33001a',ally],['50001a',support],['40001a',card('p','player_side_scheme','justice')],['58001a',card('e','event','justice',{resource_energy:1})]]){
    const rule=specialRuleFor({code:h});assert.ok(rule);assert.equal(specialRuleAllows(c,rule),true);
    assert.equal(specialRuleAllows({...c,en:{...c.en,faction_code:'hero'}},rule),false);
  }
  const generated=card('g','event','justice');generated.es.text='Genera un recurso de energía.';assert.equal(specialRuleAllows(generated,specialRuleFor({code:'58001a'})),false);
  ally.en.traits='X-Force.';assert.equal(specialRuleAllows(ally,specialRuleFor({code:'33001a'})),false);
  assert.equal(specialRuleAllows(card('wrong','ally','justice'),specialRuleFor({code:'18001a'})),false);
});
test('Gamora limita seis copias totales elegibles, no seis nombres ni seis por rasgo',()=>{
  const h=hero('18001a','gamora'),a=card('a','event','justice'),b=card('b','event','protection'),c=card('c','event','aggression');a.es.traits='Ataque.';b.es.traits='Intervención.';c.es.traits='Ataque.';
  const cards={a,b,c,[h.code]:h},d=deck(h.code,{a:3,b:3});assert.deepEqual(constructionReport(d,cards).byCard,{});
  d.cards.c=1;const result=constructionReport(d,cards);assert.equal(result.issues.length,1);assert.equal(result.removable.length,3);assert.equal(result.byCard.a.direct,false);
});
test('Maria Hill limita nombres de apoyo, conservando sus límites de copias',()=>{
  const h=hero('50001a','hill'),cards={[h.code]:h};for(const code of ['a','b','c','d']){cards[code]=card(code,'support','justice');cards[code].en.traits='S.H.I.E.L.D.';}
  const d=deck(h.code,{a:3,b:3,c:3});assert.deepEqual(constructionReport(d,cards).byCard,{});d.cards.d=1;assert.equal(constructionReport(d,cards).issues.length,1);
  moveAuxiliary(d,'d',true,cards);assert.equal(constructionReport(d,cards).issues.length,0);assert.equal(d.auxiliaries.d,1);
});
test('Cable admite planes ajenos y señala eventos ajenos; limpieza solo retira cartas seleccionadas incompatibles',()=>{
  const h=hero('40001a','cable'),p=card('p','player_side_scheme','justice'),e=card('e','event','justice'),basic=card('basic'),mandatory=card('mandatory','event','hero',{quantity:2});mandatory.links.set='cable';
  const cards={[h.code]:h,p,e,basic,mandatory},d=deck(h.code,{p:1,e:2,basic:1,mandatory:2});d.versions=addVersion(d).versions;
  const before=structuredClone(d.versions);assert.deepEqual(constructionReport(d,cards).removable,['e']);
  removeConstructionCards(d,['e','basic','mandatory'],cards);assert.deepEqual(d.cards,{p:1,basic:1,mandatory:2});assert.deepEqual(d.versions,before);
});
test('Spiderwoman exige dos aspectos balanceados y Adam cuatro balanceados, singleton incluso para básicas',()=>{
  const sw=hero('04031a','spider_woman'),aw=hero('21031a','warlock'),cards={[sw.code]:sw,[aw.code]:aw,a:card('a','event','justice'),b:card('b','ally','leadership'),c:card('c','ally','aggression'),d:card('d','ally','protection'),basic:card('basic'),pool:card('pool','ally','pool')};
  const spider=deck(sw.code,{a:2,b:1},['justice','leadership']);assert.match(constructionReport(spider,cards).issues.join(' '),/igual/);spider.cards.b=2;assert.equal(constructionReport(spider,cards).issues.length,0);spider.aspects=['justice'];assert.match(constructionReport(spider,cards).issues[0],/dos/);
  const adam=deck(aw.code,{a:1,b:1,c:1,d:1,basic:2,pool:1},['justice','leadership','aggression','protection']);const result=constructionReport(adam,cards);assert.ok(result.byCard.basic);assert.ok(result.byCard.pool);assert.equal(canSetQuantity(adam,'basic',2,cards),false);assert.equal(canSetQuantity(adam,'basic',1,cards),true);assert.equal(result.issues.length,0);
});
test('auxiliares automáticos del héroe aparecen sin sumar al mazo ni a estadísticas ni a faltantes',()=>{
  const h=hero('storm','storm'),aux={...card('weather','support','hero',{quantity:4}),role:'hero_auxiliary',links:{set:'weather',parent_hero_set:'storm'}},cards={storm:h,weather:aux,a:card('a','event','basic',{resource_energy:2,cost:2})},d=deck('storm',{a:2});
  assert.deepEqual(automaticAuxiliaries(d,cards),{weather:4});assert.equal(listDeckGroups(d,cards).at(-1).id,AUXILIARY_GROUP);assert.deepEqual(d.cards,{a:2});
  const stats=deckStatistics(d,cards);assert.equal(stats.count,2);assert.equal(stats.totalResources,4);assert.equal(stats.resourcesPerCard,2);
  d.armed=true;assert.deepEqual(shortage([d],cards,{test:0}).map(x=>x.code),['a']);assert.throws(()=>moveAuxiliary(d,'weather',false,cards),/permanecen/);
});
test('arrastrar a Auxiliares conserva copias y asociaciones y puede volver a un grupo válido; obligatorias no se mueven',()=>{
  const h=hero('h','h'),a=card('a'),m=card('m','event','hero',{quantity:2});m.links.set='h';const cards={h,a,m},d=deck('h',{a:3,m:2}),g=addCustomGroup(d,'Motor');
  moveToGroup(d,'a',g.id,cards);moveToGroup(d,'a',AUXILIARY_GROUP,cards);assert.equal(d.cards.a,undefined);assert.equal(d.auxiliaries.a,3);assert.deepEqual(g.codes,['a']);
  assert.equal(constructionReport(d,cards).byCard.a,undefined);moveToGroup(d,'a',g.id,cards);assert.equal(d.cards.a,3);assert.equal(d.auxiliaries.a,undefined);assert.equal(d.grouping.preferred.a,g.id);
  assert.throws(()=>moveToGroup(d,'m',AUXILIARY_GROUP,cards),/obligatorias/);assert.equal(d.cards.m,2);assert.equal(reservedGroupName('Auxiliares'),true);
});
test('no se devuelve al mazo un auxiliar que supere sus límites; operación conserva datos al fallar',()=>{
  const h=hero('21031a','warlock'),cards={[h.code]:h,a:card('a')},d=deck(h.code);d.auxiliaries.a=3;
  assert.throws(()=>moveAuxiliary(d,'a',false,cards),/supera/);assert.equal(d.auxiliaries.a,3);assert.deepEqual(d.cards,{});
});
test('respaldo y versiones conservan auxiliares manuales; importación rechaza roles, cantidades, caras y duplicación',()=>{
  const h=hero('h','h'),a=card('a'),b=card('b'),back={...card('back'),en:{hidden:true},links:{other_face:'a'}},m=card('m','event','hero');m.links.set='h';const cards={h,a,b,back,m},d=deck('h',{b:1});d.auxiliaries.a=2;const version=addVersion(d),payload={format:'marvel-decks-v1',decks:[version]};
  const restored=validateImport(payload,cards)[0];assert.equal(restored.auxiliaries.a,2);assert.equal(restored.versions[0].snapshot.auxiliaries.a,2);assert.equal(restored.cards.a,undefined);
  for(const extra of [{h:1},{back:1},{a:-1},{a:100},{b:1},{m:1}])assert.throws(()=>validateImport({...payload,decks:[{...d,auxiliaries:extra}]},cards),/inválida/);
  const old={...d};delete old.auxiliaries;assert.deepEqual(validateImport({format:'marvel-decks-v1',decks:[old]},cards)[0].auxiliaries,{});
});
test('búsqueda parcial respeta orden LIKE, nombre/subtítulo y texto por separado en ambos idiomas',()=>{
  const a=card('a');a.es.name='Nombre del héroe';a.es.subname='Identidad secreta';a.en.name='Hero name';a.en.text='Draw two cards';
  const d=deck('');assert.equal(filterCards([a],{search:'nombre héroe',searchFields:{name:true,text:false}},d,{}).length,1);
  assert.equal(filterCards([a],{search:'identidad',searchFields:{name:true,text:false}},d,{}).length,1);
  assert.equal(filterCards([a],{search:'héroe nombre',searchFields:{name:true,text:false}},d,{}).length,0);
  assert.equal(filterCards([a],{search:'daño',searchFields:{name:true,text:false}},d,{}).length,0);
  assert.equal(filterCards([a],{search:'daño',searchFields:{name:false,text:true}},d,{}).length,1);
  assert.equal(filterCards([a],{search:'draw cards',language:'both',searchFields:{name:false,text:true}},d,{}).length,1);
});
test('estadísticas distinguen símbolos del héroe y cartas de 1/2/3 símbolos; costes solo numéricos con huecos cero',()=>{
  const cards={a:card('a','event','hero',{resource_physical:1,cost:2}),b:card('b','resource','basic',{resource_energy:2}),c:card('c','resource','basic',{resource_wild:3,cost:-1}),z:card('z','event','justice',{cost:0})},d=deck('',{a:2,b:1,c:1,z:3});d.auxiliaries.b=20;
  const result=deckStatistics(d,cards);assert.equal(result.count,7);assert.deepEqual(result.costs,[['0',3],['1',0],['2',2]]);assert.equal(result.ignoredCosts,2);assert.equal(result.heroResources.physical,2);assert.equal(result.resourceCards.energy[2],1);assert.equal(result.resourceCards.wild[3],1);assert.equal(result.totalResources,7);assert.equal(result.resourcesPerCard,1);assert.equal(result.factions.justice,3);
});
