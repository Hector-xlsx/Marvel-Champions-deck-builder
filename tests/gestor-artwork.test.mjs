import test from 'node:test';
import assert from 'node:assert/strict';
import { artworkOptions, selectedArtwork, galleryArtworks } from '../web/artwork.mjs';
import { createDeck, snapshot, addVersion, validateImport } from '../web/model.mjs';

const card = (code, image, duplicate, extra = {}) => ({ code, role: 'deck_card', en: {}, links: duplicate ? { duplicate_of: duplicate } : {}, image, ...extra });
const cards = {
  root: card('root', 'original.jpg', null, { imageReference: 'source' }),
  alias: card('alias', 'original.jpg', 'root', { imageReference: 'root' }),
  reference: card('reference', 'phoenix.jpg', 'root', { imageReference: 'phoenix' }),
  phoenix: card('phoenix', 'phoenix.jpg', 'root'),
  copy: card('copy', 'phoenix.jpg', 'root'),
  missing: card('missing', null, 'root'),
  hidden: card('hidden', 'back.jpg', null, { en: { hidden: true }, links: { other_face: 'root' } }),
  auxiliary: card('auxiliary', 'aux.jpg', 'root', { role: 'hero_auxiliary' }),
  other: card('other', 'original.jpg'),
};

test('opciones deduplican imágenes dentro de una familia; raíz primero y escaneo propio antes de referencia', () => {
  assert.deepEqual(artworkOptions('alias', cards).map(card => card.code), ['root', 'copy']);
  assert.equal(artworkOptions('root', cards).some(card => card.code === 'other'), false);
  assert.deepEqual(artworkOptions('hidden', cards).map(card => card.code), ['root', 'copy']);
  assert.deepEqual(artworkOptions('unknown', cards), []);
});

test('deduplicación considera anverso y reverso; conserva raíz aunque no tenga imagen', () => {
  const double = { a: card('a', 'front.jpg', null, { backImage: 'back-a.jpg' }),
    b: card('b', 'front.jpg', 'a', { backImage: 'back-b.jpg' }),
    c: card('c', 'front.jpg', 'a', { backImage: 'back-b.jpg', imageReference: 'b' }) };
  assert.deepEqual(artworkOptions('a', double).map(card => card.code), ['a', 'b']);
  const blank = { a: card('a', null), b: card('b', null, 'a'), c: card('c', 'image.jpg', 'a') };
  assert.deepEqual(artworkOptions('a', blank).map(card => card.code), ['a', 'c']);
  assert.deepEqual(artworkOptions('a', { a: blank.a, b: blank.b }).map(card => card.code), ['a']);
});

test('preferencia devuelve representante de la misma imagen; inválidas y otra familia vuelven a raíz', () => {
  const deck = createDeck();
  deck.artwork.root = 'reference';
  assert.equal(selectedArtwork('alias', deck, cards).code, 'copy');
  for (const invalid of ['other', 'hidden', 'auxiliary', 'unknown', 'missing']) {
    deck.artwork.root = invalid;
    assert.equal(selectedArtwork('root', deck, cards).code, 'root', invalid);
  }
  assert.equal(selectedArtwork('root', { artwork: {} }, cards).code, 'root');
});

test('galería expande variantes tras filtrar raíces, sin mezclar familias ni cambiar cantidades', () => {
  const deck = createDeck();deck.cards = { root: 2 };deck.artwork.root = 'phoenix';
  const before = JSON.stringify(deck);
  assert.deepEqual(galleryArtworks([cards.root], deck, cards, false).map(card => card.code), ['copy']);
  assert.deepEqual(galleryArtworks([cards.root, cards.alias], deck, cards, true).map(card => card.code), ['root', 'copy']);
  assert.deepEqual(galleryArtworks([cards.root, cards.other], deck, cards, true).map(card => card.code), ['root', 'copy', 'other']);
  assert.equal(JSON.stringify(deck), before);
  assert.equal(deck.cards.root, 2);
});

test('snapshot e importación conservan impresión elegida aunque no se haya añadido carta al mazo', () => {
  let deck = createDeck();deck.artwork.root = 'phoenix';
  deck = addVersion(deck);
  const saved = snapshot(deck);
  deck.artwork.root = 'root';
  assert.equal(saved.artwork.root, 'phoenix');
  assert.equal(deck.versions[0].snapshot.artwork.root, 'phoenix');
  const [imported] = validateImport(JSON.parse(JSON.stringify({ format: 'marvel-decks-v1', decks: [deck] })), cards);
  assert.deepEqual(imported.cards, {});
  assert.equal(imported.artwork.root, 'root');
  assert.equal(imported.versions[0].snapshot.artwork.root, 'phoenix');
});

test('importación canonicaliza claves de impresión conservando el código real elegido', () => {
  const deck = createDeck();deck.artwork = { alias: 'reference' };
  const [imported] = validateImport({ format: 'marvel-decks-v1', decks: [deck] }, cards);
  assert.deepEqual(imported.artwork, { root: 'reference' });
  assert.equal(selectedArtwork('root', imported, cards).code, 'copy');
});

test('importación rechaza otra familia, códigos ausentes, caras ocultas y aliases contradictorios, también históricos', () => {
  const deck = createDeck();
  const check = (artwork, historical = false) => validateImport({ format: 'marvel-decks-v1', decks: [historical
    ? { ...deck, versions: [{ label: '1', date: new Date().toISOString(), snapshot: { ...snapshot(deck), artwork } }] }
    : { ...deck, artwork }] }, cards);
  for (const historical of [false, true]) {
    assert.throws(() => check({ root: 'other' }, historical), /otra familia/);
    assert.throws(() => check({ root: 'unknown' }, historical), /código/);
    assert.throws(() => check({ unknown: 'root' }, historical), /código/);
    assert.throws(() => check({ root: 'hidden' }, historical), /oculta/);
    assert.throws(() => check({ root: 'auxiliary' }, historical), /auxiliar/);
    assert.throws(() => check({ root: 'root', alias: 'phoenix' }, historical), /contradictorias/);
    assert.throws(() => check([], historical), /ilustraciones/);
  }
});

test('respaldos antiguos usan mapa vacío y catálogos Set solo validan existencia', () => {
  const deck = createDeck();delete deck.artwork;
  const [legacy] = validateImport({ format: 'marvel-decks-v1', decks: [deck] }, cards);
  assert.deepEqual(legacy.artwork, {});
  assert.deepEqual(snapshot(deck).artwork, {});
  deck.artwork = { root: 'other' };
  const [untyped] = validateImport({ format: 'marvel-decks-v1', decks: [deck] }, new Set(['root', 'other']));
  assert.deepEqual(untyped.artwork, { root: 'other' });
});
