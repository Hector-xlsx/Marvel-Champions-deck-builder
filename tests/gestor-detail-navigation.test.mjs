import test from 'node:test';
import assert from 'node:assert/strict';
import {DetailNavigation} from '../web/detail-navigation.mjs';

test('navegación circular mantiene el origen y el orden, sin pasar del mazo a la galería',()=>{
  const gallery=new DetailNavigation('gallery',['a','b','c'],'a'),deck=new DetailNavigation('deck',['c','a'],'c');
  assert.equal(gallery.step(-1),'c');assert.equal(gallery.step(1),'a');assert.equal(gallery.step(1),'b');
  assert.equal(deck.step(-1),'a');assert.equal(deck.step(1),'c');assert.equal(deck.source,'deck');
  assert.equal(gallery.step(1),'c');assert.equal(gallery.source,'gallery');
});

test('recorrido copia y deduplica la lista para conservar posición al editar cantidades o cambiar grupos',()=>{
  const visible=['a','b','a','c'],nav=new DetailNavigation('deck',visible,'b');visible.splice(0,visible.length,'x');
  assert.deepEqual(nav.codes,['a','b','c']);assert.equal(nav.step(1),'c');assert.equal(nav.step(1),'a');
  nav.select('b');assert.equal(nav.step(-1),'a');
});

test('cambiar una impresión fuera de la lista no pierde la posición; listas vacías o unitarias no habilitan controles',()=>{
  const nav=new DetailNavigation('gallery',['a','b','c'],'b');nav.select('alternate-b');assert.equal(nav.step(1),'c');assert.equal(nav.step(-1),'alternate-b');
  const empty=new DetailNavigation('gallery',[],'a');assert.equal(empty.canNavigate,false);assert.equal(empty.step(1),null);
  const one=new DetailNavigation('deck',['a'],'a');assert.equal(one.canNavigate,false);assert.equal(one.step(-1),'a');
  const independent=new DetailNavigation(null,['a','b'],'a');assert.equal(independent.canNavigate,false);
});
