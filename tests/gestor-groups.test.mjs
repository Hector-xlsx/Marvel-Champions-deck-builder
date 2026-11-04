import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeck, snapshot, addVersion, validateImport } from '../web/model.mjs';
import { initializeGroups, reservedGroupName, addCustomGroup, defaultGroup, listDeckGroups,
  moveToGroup, hideGroup, restoreGroup, deleteCustomGroup, clearCustomGroup } from '../web/groups.mjs';

const card = (code, type_code, faction_code, cost) => ({ code, role: 'deck_card', en: { type_code, faction_code, cost } });
const cards = { a: card('a', 'event', 'hero', 2), b: card('b', 'ally', 'justice', 0),
  c: card('c', 'support', 'basic', -1), d: card('d', 'upgrade', 'basic', null) };
const build = () => Object.assign(createDeck(), { cards: { a: 3, b: 1, c: 2, d: 1 } });
const location = (deck, code) => listDeckGroups(deck, cards).find(group => group.codes.includes(code));

test('limpiar desasocia solo el grupo elegido, conserva copias, otras asociaciones e historial y aplica fallback', () => {
  const deck = build(), first = addCustomGroup(deck, 'Motor'), second = addCustomGroup(deck, 'Final');
  moveToGroup(deck, 'a', first.id, cards);moveToGroup(deck, 'a', second.id, cards);
  moveToGroup(deck, 'b', second.id, cards);hideGroup(deck, 'default:type:ally');
  addVersion(deck);const historic=JSON.stringify(deck.versions),quantities=JSON.stringify(deck.cards);
  clearCustomGroup(deck, second.id);
  assert.deepEqual(second.codes, []);assert.deepEqual(first.codes, ['a']);
  assert.equal(deck.groups.includes(second),true);assert.equal(second.hidden,false);
  assert.equal(location(deck,'a').id,'default:type:event');assert.equal(location(deck,'b').id,'ungrouped');
  assert.equal(JSON.stringify(deck.cards),quantities);assert.equal(JSON.stringify(deck.versions),historic);
  const state=JSON.stringify(deck);clearCustomGroup(deck,second.id);assert.equal(JSON.stringify(deck),state);
  assert.throws(()=>clearCustomGroup(deck,'default:type:event'),/personalizado/);
});

test('nombres predeterminados reservados no dependen de acentos, mayúsculas ni singular/plural', () => {
  for (const name of ['Aliado', 'aliados', ' EVENTOS ', 'Apoyos', 'Mejoras', 'Recursos', 'Plan secundario',
    'Planes secundarios', 'BÁSICAS', 'Protección', 'Mazo heroe', 'Sin grupo', 'Sin coste', 'Coste 0',
    'coste 2.5', 'Coste -2', 'Coste X', 'X / variable']) assert.equal(reservedGroupName(name), true, name);
  assert.equal(reservedGroupName('Armas'), false);
  assert.equal(reservedGroupName('Coste del motor'), false);
  const deck = build();
  assert.throws(() => addCustomGroup(deck, 'Eventos'), /reservado/);
  addCustomGroup(deck, 'Armas');
  assert.throws(() => addCustomGroup(deck, ' ÁRMAS '), /existe/);
});

test('migración antigua es idempotente, conserva asociaciones y no cambia versiones guardadas', () => {
  const deck = build();
  delete deck.grouping;
  deck.groups = [{ id: 'one', name: 'Eventos', codes: ['a', 'b'] },
    { id: 'two', name: 'Eventos', codes: ['a'] }];
  deck.versions = [{ snapshot: { groups: [{ id: 'historic', name: 'Eventos', codes: ['c'] }] } }];
  const historic = JSON.stringify(deck.versions);
  assert.equal(initializeGroups(deck), true);
  assert.equal(initializeGroups(deck), false);
  assert.equal(deck.groups[0].name, 'Eventos (personalizado)');
  assert.equal(deck.groups[1].name, 'Eventos (personalizado) (2)');
  assert.deepEqual(deck.grouping.preferred, { a: 'one', b: 'one' });
  assert.deepEqual(deck.groups[1].codes, ['a']);
  assert.equal(JSON.stringify(deck.versions), historic);
});

test('cada carta aparece una vez; los defaults naturales continúan como destino aunque vacíos', () => {
  const deck = build(), custom = addCustomGroup(deck, 'Motor');
  moveToGroup(deck, 'a', custom.id, cards);
  const state = JSON.stringify(deck);
  const groups = listDeckGroups(deck, cards);
  assert.equal(JSON.stringify(deck), state);
  assert.equal(groups.find(group => group.id === 'default:type:event').codes.length, 0);
  assert.deepEqual(groups.find(group => group.id === custom.id).codes, ['a']);
  assert.deepEqual(groups.flatMap(group => group.codes).sort(), ['a', 'b', 'c', 'd']);
  const empty = addCustomGroup(deck, 'Vacío');
  assert.deepEqual(listDeckGroups(deck, cards).find(group => group.id === empty.id).codes, []);
});

test('ocultar hace fallback sin borrar preferencias; restaurar recupera el grupo preferido', () => {
  const deck = build(), custom = addCustomGroup(deck, 'Motor');
  moveToGroup(deck, 'a', custom.id, cards);
  hideGroup(deck, custom.id);
  assert.equal(location(deck, 'a').id, 'default:type:event');
  assert.equal(deck.grouping.preferred.a, custom.id);
  hideGroup(deck, 'default:type:event');
  assert.equal(location(deck, 'a').kind, 'ungrouped');
  restoreGroup(deck, custom.id);
  assert.equal(location(deck, 'a').id, custom.id);
  hideGroup(deck, custom.id);
  restoreGroup(deck, 'default:type:event');
  assert.equal(location(deck, 'a').id, 'default:type:event');
  assert.deepEqual(custom.codes, ['a']);
  assert.equal(deck.cards.a, 3);
});

test('mover conserva membresías previas y solo permite el default natural visible', () => {
  const deck = build(), first = addCustomGroup(deck, 'Motor'), second = addCustomGroup(deck, 'Finisher');
  moveToGroup(deck, 'a', first.id, cards);
  moveToGroup(deck, 'a', second.id, cards);
  assert.deepEqual(first.codes, ['a']);
  assert.deepEqual(second.codes, ['a']);
  assert.equal(location(deck, 'a').id, second.id);
  const state = JSON.stringify(deck);
  assert.throws(() => moveToGroup(deck, 'a', 'default:type:ally', cards), /predeterminado/);
  assert.throws(() => moveToGroup(deck, 'a', 'default:faction:hero', cards), /predeterminado/);
  assert.equal(JSON.stringify(deck), state);
  hideGroup(deck, 'default:type:event');
  assert.throws(() => moveToGroup(deck, 'a', 'default:type:event', cards), /predeterminado/);
  hideGroup(deck, second.id);
  assert.throws(() => moveToGroup(deck, 'b', second.id, cards), /Restaura/);
  restoreGroup(deck, 'default:type:event');
  moveToGroup(deck, 'a', 'default:type:event', cards);
  assert.equal(deck.grouping.preferred.a, 'default');
  assert.deepEqual(first.codes, ['a']);
  assert.deepEqual(deck.cards, { a: 3, b: 1, c: 2, d: 1 });
});

test('modos tipo/aspecto/coste preservan preferidos y eliminar custom devuelve a default', () => {
  const deck = build(), group = addCustomGroup(deck, 'Motor');
  moveToGroup(deck, 'a', group.id, cards);
  deck.grouping.mode = 'faction';
  assert.equal(location(deck, 'a').id, group.id);
  assert.equal(defaultGroup(cards.a, 'faction').label, 'Mazo héroe');
  assert.deepEqual(defaultGroup(cards.a, 'cost'), { id: 'default:cost:2', label: 'Coste 2' });
  assert.deepEqual(defaultGroup(cards.c, 'cost'), { id: 'default:cost:x', label: 'Coste X' });
  assert.deepEqual(defaultGroup(cards.d, 'cost'), { id: 'default:cost:unknown', label: 'Sin coste' });
  deleteCustomGroup(deck, group.id);
  assert.equal(deck.grouping.preferred.a, 'default');
  assert.equal(location(deck, 'a').id, 'default:faction:hero');
  assert.equal(deck.cards.a, 3);
});

test('snapshot y respaldo mantienen visibilidad, modo y preferencias; ids se remapean coherentemente', () => {
  let deck = build();
  const group = addCustomGroup(deck, 'Motor');
  moveToGroup(deck, 'a', group.id, cards);
  hideGroup(deck, group.id);
  hideGroup(deck, 'default:type:event');
  deck.grouping.mode = 'cost';
  deck = addVersion(deck);
  const first = snapshot(deck);
  restoreGroup(deck, group.id);
  assert.equal(first.groups[0].hidden, true);
  assert.equal(first.grouping.mode, 'cost');
  deck = addVersion(deck);
  const payload = JSON.parse(JSON.stringify({ format: 'marvel-decks-v1', decks: [deck, deck] }));
  const [imported, other] = validateImport(payload, cards);
  const newId = imported.groups[0].id;
  assert.notEqual(newId, group.id);
  assert.notEqual(newId, other.groups[0].id);
  assert.equal(imported.grouping.preferred.a, newId);
  for (const version of imported.versions) {
    assert.equal(version.snapshot.groups[0].id, newId);
    assert.equal(version.snapshot.grouping.preferred.a, newId);
    assert.equal(version.snapshot.grouping.mode, 'cost');
  }
  assert.equal(imported.versions[0].snapshot.groups[0].hidden, true);
  assert.equal(imported.versions[1].snapshot.groups[0].hidden, false);
  assert.deepEqual(imported.grouping.hiddenDefaults, ['default:type:event']);
  assert.equal(location(imported, 'a').id, newId);
});

test('backups anteriores migran con primer grupo asociado y admiten grupos ya eliminados en históricos', () => {
  let deck = build();
  delete deck.grouping;
  deck.groups = [{ id: 'old', name: 'Eventos', codes: ['a'] }];
  deck = addVersion(deck);
  deck.groups = [];
  const [imported] = validateImport({ format: 'marvel-decks-v1', decks: [deck] }, cards);
  const historic = imported.versions[0].snapshot;
  assert.equal(historic.grouping.preferred.a, historic.groups[0].id);
  assert.equal(historic.groups[0].name, 'Eventos (personalizado)');
  assert.equal(imported.groups.length, 0);
});

test('importación rechaza flags, modos, códigos e ids preferidos inválidos también en snapshots', () => {
  const deck = build();
  const check = (changes, historical = false) => {
    const invalid = { ...deck, ...changes };
    const input = historical ? { ...deck, versions: [{ label: '1', date: new Date().toISOString(), snapshot: invalid }] } : invalid;
    return validateImport({ format: 'marvel-decks-v1', decks: [input] }, cards);
  };
  for (const historical of [false, true]) {
    assert.throws(() => check({ grouping: { mode: 'custom' } }, historical), /modo/);
    assert.throws(() => check({ groups: [{ id: 'g', name: 'A', hidden: 'sí' }] }, historical), /visibilidad/);
    assert.throws(() => check({ grouping: { preferred: { a: 'missing' } } }, historical), /inexistente/);
    assert.throws(() => check({ groups: [{ id: 'g', name: 'Motor', codes: ['b'] }], grouping: { preferred: { a: 'g' } } }, historical), /no está asociada/);
    assert.throws(() => check({ grouping: { preferred: { missing: 'default' } } }, historical), /código/);
    assert.throws(() => check({ grouping: { hiddenDefaults: ['default:type:invalid'] } }, historical), /predeterminado/);
    assert.throws(() => check({ groups: [{ id: 'g' }, { id: 'g' }] }, historical), /duplicado/);
  }
});
