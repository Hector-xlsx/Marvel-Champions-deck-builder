import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTraitReferenceIndex,scopedTraits,filterCards,traitCounts,traitSourceOptions} from '../web/catalog.mjs';
import {presetCriteria,createPreset,FilterPresetStore} from '../web/filter-presets.mjs';

const card=(code,own='',text='',ownEn='',textEn='',role='deck_card')=>({code,role,es:{name:code,traits:own,text},en:{name:code,traits:ownEn,text:textEn,faction_code:'basic'},links:{}});
const source=[
  card('attack','Ataque.','','Attack.'),
  card('mutant','Mutante.','','Mutant.','','identity'),
  card('tech','Tecnología.','','Tech.','','hero_auxiliary'),
  card('elite','Élite.','','Elite.','','encounter'),
  card('viv','Androide.','Elige un Esbirro que no sea de [[Élite]], excepto sus [[Rasgos]].','Android.','Choose a non-[[Elite]] minion except its [[Traits]].'),
  card('mention','','Usa [[ATAQUE]] y [[Mutante]]; [[Ataque]] otra vez. No [[Superataque]].','', 'Use [[Attack]] and [[Mutant]].'),
  card('both','Ataque.','Requiere [[Ataque]].','Attack.','Requires [[Attack]].'),
  card('plain','','Esta frase dice Ataque pero no está marcada.'),
];
const indexed=()=>{const index=buildTraitReferenceIndex(source);return source.map(c=>({...c,...index[c.code]}));};
const deck={cards:{},aspects:[]},codes=cards=>cards.map(c=>c.code);

test('indexación preserva originales, conserva referencias crudas y admite solo rasgos propios de cartas de jugador',()=>{
  const before=JSON.stringify(source),index=buildTraitReferenceIndex(source);
  assert.equal(JSON.stringify(source),before);
  assert.deepEqual(index.viv.textReferences.es,['Élite','Rasgos']);assert.deepEqual(index.viv.traitReferences.es,[]);
  assert.deepEqual(index.mention.traitReferences.es,['Ataque','Mutante']);assert.deepEqual(index.mention.traitReferences.en,['Attack','Mutant']);
  assert.deepEqual(index.plain.traitReferences.es,[]);
  assert.deepEqual(buildTraitReferenceIndex([source[2],card('ref','','[[Tecnología]]')]).ref.traitReferences.es,['Tecnología']);
});

test('atributo, texto y ambos son alcances diferentes; rasgos y alcances se combinan con O',()=>{
  const records=indexed().filter(c=>['attack','mention','both','plain'].includes(c.code)),filter={traits:['Ataque']};
  assert.deepEqual(codes(filterCards(records,filter,deck,{})),['attack','both']);
  assert.deepEqual(codes(filterCards(records,{...filter,traitSources:{attribute:false,text:true}},deck,{})),['both','mention']);
  assert.deepEqual(codes(filterCards(records,{...filter,traitSources:{attribute:true,text:true}},deck,{})),['attack','both','mention']);
  assert.deepEqual(codes(filterCards(records,{traits:['Tecnología','Mutante'],traitSources:{attribute:false,text:true}},deck,{})),['mention']);
  assert.deepEqual(codes(filterCards(records,{traits:['Attack'],traitSources:{attribute:false,text:true}},deck,{})),['both','mention']);
  assert.deepEqual(codes(filterCards(indexed().filter(c=>c.role==='deck_card'),{traits:['Élite'],traitSources:{attribute:true,text:true}},deck,{})),[]);
});

test('contadores deduplican familias y referencias repetidas y siguen el alcance seleccionado',()=>{
  const records=indexed(),mention=records.find(c=>c.code==='mention'),copy={...mention,code:'copy'};
  const count=scope=>traitCounts([records.find(c=>c.code==='attack'),mention,records.find(c=>c.code==='both'),copy],c=>c.code==='copy'?'mention':c.code,scope);
  assert.deepEqual(count({attribute:false,text:true}),[{name:'Ataque',count:2},{name:'Mutante',count:1}]);
  assert.deepEqual(count({attribute:true,text:true}),[{name:'Ataque',count:3},{name:'Mutante',count:1}]);
});

test('rasgos con puntos se reconocen completos; no se buscan subcadenas dentro de los marcadores',()=>{
  const records=[card('shield','S.H.I.E.L.D.'),card('mention','','[[S.H.I.E.L.D.]] y [[super S.H.I.E.L.D.]]')];
  const index=buildTraitReferenceIndex(records);
  assert.deepEqual(index.mention.traitReferences.es,['S.H.I.E.L.D']);
  assert.deepEqual(scopedTraits({...records[1],...index.mention},{attribute:false,text:true}),['S.H.I.E.L.D']);
});

test('presets conservan el alcance, mantienen el comportamiento anterior y nunca aceptan ambos desactivados',()=>{
  assert.deepEqual(traitSourceOptions(),{attribute:true,text:false});
  assert.deepEqual(presetCriteria({traitSources:{attribute:false,text:false}}).traitSources,{attribute:true,text:false});
  const original=createPreset({traitSources:{attribute:false,text:true}},'Texto'),copy=createPreset(original.criteria,'Copia',original);
  copy.criteria.traitSources.attribute=true;assert.equal(original.criteria.traitSources.attribute,false);
  const entries=new Map(),storage={getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,v)};
  const store=new FilterPresetStore(storage,{});store.save(original);
  assert.deepEqual(store.load(original.id).criteria.traitSources,{attribute:false,text:true});
  delete original.criteria.traitSources;store.save(original);
  assert.deepEqual(store.load(original.id).criteria.traitSources,{attribute:true,text:false});
});

test('planes secundarios se indexan sin corchetes en singular, plural, con formato e inglés, sin convertirse en rasgo propio',()=>{
  const records=[card('singular','','Elige un Plan secundario.'),card('plural','','Derrota planes <b>secundarios</b>.'),card('english','','','','Choose a player side scheme, then side-schemes.'),card('no','','Un plan principal; una tarea secundaria.')];
  const before=JSON.stringify(records),index=buildTraitReferenceIndex(records);
  assert.equal(JSON.stringify(records),before);
  for(const code of ['singular','plural']){assert.deepEqual(index[code].textTopics.es,['side_scheme']);assert.deepEqual(index[code].traitReferences.es,[]);assert.deepEqual(index[code].textReferences.es,[]);}
  assert.deepEqual(index.english.textTopics.en,['side_scheme']);assert.deepEqual(index.no.textTopics.es,[]);
  const cards=records.map(c=>({...c,...index[c.code]})),filter={traits:['Plan secundario']};
  assert.deepEqual(codes(filterCards(cards,filter,deck,{})),[]);
  assert.deepEqual(codes(filterCards(cards,{...filter,traitSources:{attribute:false,text:true}},deck,{})),['english','plural','singular']);
  assert.deepEqual(scopedTraits(cards[2],{attribute:false,text:true}),['Plan secundario']);
});

test('el tipo plan secundario no implica mención en texto y los contadores no duplican idiomas ni referencias',()=>{
  const records=[{...card('typeOnly','Táctica.','Quita amenaza.'),en:{type_code:'player_side_scheme',faction_code:'basic',text:''}},card('ref','','Plan secundario y planes secundarios.','','Side scheme and side schemes.')];
  const index=buildTraitReferenceIndex(records),cards=records.map(c=>({...c,...index[c.code]}));
  assert.deepEqual(codes(filterCards(cards,{traits:['Plan secundario'],traitSources:{attribute:true,text:true}},deck,{})),['ref']);
  assert.deepEqual(traitCounts([cards[1],{...cards[1],code:'copy'}],()=> 'same-family',{attribute:false,text:true}),[{name:'Plan secundario',count:1}]);
});
