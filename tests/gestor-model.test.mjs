import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeck, snapshot, addVersion, nextVersionNumber, diffCards, DeckStore, validateImport } from '../web/model.mjs';

function memoryStorage() {
  const values = new Map();
  return { get length() { return values.size; }, key: i => [...values.keys()][i] ?? null,
    getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('versiones se numeran 1, 1.1, 1.2 sin tratar el número como decimal ni renumerar el historial',()=>{
  let deck=createDeck();assert.equal(nextVersionNumber(deck),'1');
  for(let i=0;i<13;i++)deck=addVersion(deck);
  assert.deepEqual(deck.versions.map(v=>v.label),['1','1.1','1.2','1.3','1.4','1.5','1.6','1.7','1.8','1.9','1.10','1.11','1.12']);
  deck.versions[0].label='Nombre anterior';assert.equal(nextVersionNumber(deck),'1.13');
  assert.equal(addVersion(deck).versions[0].label,'Nombre anterior');
});

test('dos pestañas no sobrescriben una revisión más reciente', () => {
  const storage = memoryStorage();
  const tabA = new DeckStore(storage), tabB = new DeckStore(storage);
  const deck = createDeck('Original');
  assert.equal(tabA.save(deck).revision, 1);
  const old = tabB.load(deck.id);
  tabA.save({ ...deck, name: 'Actual' }, 1);
  assert.throws(() => tabB.save({ ...old.deck, name: 'Viejo' }, old.revision), /Conflicto/);
  assert.throws(() => tabB.save(deck), /Conflicto/);
  assert.equal(tabA.load(deck.id).deck.name, 'Actual');
  storage.setItem('marvel.deck.roto', '{');
  assert.equal(tabA.list().length, 1);
  assert.equal(storage.getItem('marvel.deck.roto'), '{');
});

test('versiones conservan instantáneas independientes y diferencias de cantidades', () => {
  let deck = createDeck();
  deck.cards = { a: 3, b: 1 };
  deck = addVersion(deck, 'Inicio');
  deck.cards.a = 1;
  delete deck.cards.b;
  deck.cards.c = 2;
  deck = addVersion(deck, 'Cambio');
  assert.deepEqual(deck.versions[0].snapshot.cards, { a: 3, b: 1 });
  assert.deepEqual(deck.versions[1].diff, { added: [{ code: 'c', quantity: 2 }], removed: [{ code: 'a', quantity: 2 }, { code: 'b', quantity: 1 }] });
  assert.equal('versions' in snapshot(deck), false);
  assert.deepEqual(diffCards({ a: 1 }, { a: 1 }), { added: [], removed: [] });
});

test('importación crea copias nuevas y recalcula diferencias sin confiar en campos externos', () => {
  let original = createDeck('<img src=x>');
  original.cards = { a: 2 };
  original.groups = [{ id: 'grupo', name: 'Prueba', codes: ['a'] }];
  original = addVersion(original, 'Primera');
  original.versions[0].diff = { fake: true };
  const payload = { format: 'marvel-decks-v1', decks: [original] };
  const [imported] = validateImport(payload, new Set(['a']));
  assert.notEqual(imported.id, original.id);
  assert.notEqual(imported.groups[0].id, 'grupo');
  assert.notEqual(imported.versions[0].id, original.versions[0].id);
  assert.equal(imported.name, '<img src=x>'); // UI must use textContent.
  assert.deepEqual(imported.versions[0].diff.added, [{ code: 'a', quantity: 2 }]);
  imported.cards.a = 1;
  assert.equal(original.cards.a, 2);
});

test('importación rechaza códigos desconocidos, cantidades inválidas y estructuras malformadas', () => {
  const deck = createDeck();
  const check = changes => validateImport({ format: 'marvel-decks-v1', decks: [{ ...deck, ...changes }] }, { a: {} });
  for (const quantity of [-1, 1.5, 100, '2']) assert.throws(() => check({ cards: { a: quantity } }), /cantidad/);
  assert.throws(() => check({ cards: { desconocido: 1 } }), /código/);
  assert.throws(() => check({ groups: [{ codes: ['desconocido'] }] }), /código/);
  assert.throws(() => check({ versions: [{ snapshot: { ...snapshot(deck), cards: { a: 999 } } }] }), /cantidad/);
  assert.throws(() => check({ armed: 'sí' }), /armado/);
  assert.throws(() => check({ notes: 'x'.repeat(50001) }), /notas/);
  assert.throws(() => check({ cards: JSON.parse('{"__proto__":1}') }), /código/);
});

test('importación valida papeles de cartas e identidad también dentro de versiones históricas', () => {
  const catalog = { a: { role: 'deck_card', en: { type_code: 'event' } },
    h: { role: 'identity', en: { type_code: 'hero' } },
    alter: { role: 'identity', en: { type_code: 'alter_ego' } },
    aux: { role: 'hero_auxiliary' } };
  const deck = createDeck();
  const check = d => validateImport({ format: 'marvel-decks-v1', decks: [d] }, catalog);
  assert.throws(() => check({ ...deck, hero: 'a' }), /héroe/);
  assert.throws(() => check({ ...deck, hero: 'alter' }), /héroe/);
  assert.throws(() => check({ ...deck, cards: { aux: 1 } }), /auxiliar/);
  const versioned = addVersion({ ...deck, hero: 'h', cards: { h: 1 } }, 'Inválida');
  versioned.cards = { a: 1 };
  assert.throws(() => check(versioned), /identidad/);
  assert.equal(check({ ...deck, hero: 'h', cards: { a: 1 } })[0].hero, 'h');
});
test('nombre automático se conserva en versiones y respaldos nuevos, sin activarse en respaldos anteriores',()=>{
  const d=createDeck();assert.equal(d.autoName,true);assert.equal(createDeck('Mi nombre').autoName,false);
  const versioned=addVersion(d,'Base');assert.equal(versioned.versions[0].snapshot.autoName,true);
  assert.equal(validateImport({format:'marvel-decks-v1',decks:[versioned]},new Set())[0].autoName,true);
  delete d.autoName;
  assert.equal(validateImport({format:'marvel-decks-v1',decks:[d]},new Set())[0].autoName,false);
});
