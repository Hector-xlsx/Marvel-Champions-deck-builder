import test from 'node:test';
import assert from 'node:assert/strict';
import {ruleTextParts,identityPreviewCards} from '../web/card-presentation.mjs';
import {singleVisiblePreset} from '../web/filter-presets.mjs';

test('reglas muestran rasgos en mayúscula y conservan el resto del texto',()=>{
  assert.deepEqual(ruleTextParts('Un [[Élite]] y [[mutante]]!'),[{text:'Un ',bold:false},{text:'ÉLITE',bold:true},{text:' y ',bold:false},{text:'MUTANTE',bold:true},{text:'!',bold:false}]);
  assert.deepEqual(ruleTextParts('[[Ataque]][[defensa]]'),[{text:'ATAQUE',bold:true},{text:'DEFENSA',bold:true}]);
  assert.deepEqual(ruleTextParts('Texto [[incompleto'),[{text:'Texto [[incompleto',bold:false}]);
  assert.deepEqual(ruleTextParts(null),[]);
  assert.equal(ruleTextParts('<b>[[Mutante]]</b>').find(p=>p.bold).text,'MUTANTE');
});
test('previsualización incluye héroe y alter ego, incluso cuando el enlace lleva a otro héroe',()=>{
  const hero={code:'h',role:'identity',en:{type_code:'hero'},links:{set:'set',other_face:'a'}},alter={code:'a',role:'identity',en:{type_code:'alter_ego'},links:{set:'set'}};
  assert.deepEqual(identityPreviewCards(hero,{h:hero,a:alter}),[hero,alter]);
  const alternate={...hero,code:'h2'},multi={...hero,links:{set:'set',other_face:'h2'}};
  assert.deepEqual(identityPreviewCards(multi,{h:multi,h2:alternate,a:alter}),[multi,alter]);
  assert.deepEqual(identityPreviewCards(undefined,{}),[]);
  assert.deepEqual(identityPreviewCards({...hero,links:{}},{a:{...alter,links:{}}}),[{...hero,links:{}}]);
});
test('fijado directo usa el único filtro visible y conserva la selección con varios visibles',()=>{
  const a={id:'a',enabled:true},b={id:'b',enabled:false};
  assert.equal(singleVisiblePreset([a,b],true,'b'),a);
  assert.equal(singleVisiblePreset([a,{...b,enabled:true}],true,'a'),null);
  assert.equal(singleVisiblePreset([{...a,enabled:false},b],true,'a'),null);
  assert.equal(singleVisiblePreset([a,b],false,'b'),b);
  assert.equal(singleVisiblePreset([],false,'a'),null);
});
