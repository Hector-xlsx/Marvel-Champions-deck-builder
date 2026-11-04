import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { resolveDuplicates, classify, normalize, fingerprint, validateImage, imageDecoder, cdnUrls, resolveArtwork, overlayArtwork, applyLocalCorrection, createLocalVerifier, hash } from '../scripts/lib/biblioteca.mjs';

test('reimpresiones heredan atributos sin perder codigo, producto, cantidad ni valores X', () => {
  const raw = new Map([
    ['01001', { code: '01001', name: 'Example', cost: -1, quantity: 3, faction_code: 'basic', type_code: 'event' }],
    ['02001', { code: '02001', duplicate_of: '01001', pack_code: 'second', quantity: 1 }],
  ]);
  const card = resolveDuplicates(raw).get('02001');
  assert.equal(card.cost, -1); assert.equal(card.name, 'Example');
  assert.equal(card.code, '02001'); assert.equal(card.pack_code, 'second'); assert.equal(card.quantity, 1);
});

test('referencias de reimpresion rotas y ciclos bloquean una importacion incompleta', () => {
  assert.throws(() => resolveDuplicates(new Map([['a', { duplicate_of: 'b' }]])), /sin original/);
  assert.throws(() => resolveDuplicates(new Map([['a', { duplicate_of: 'b' }], ['b', { duplicate_of: 'a' }]])), /Ciclo/);
});

test('campaña y encuentros no entran; auxiliares no se mezclan con mazo normal', () => {
  const sets = new Map([['labor', { card_set_type_code: 'hero_special', parent_code: 'hercules' }]]);
  assert.equal(classify({ faction_code: 'campaign', type_code: 'ally' }, sets).role, 'excluded');
  assert.equal(classify({ faction_code: 'encounter', type_code: 'support' }, sets).role, 'excluded');
  assert.equal(classify({ faction_code: 'hero', type_code: 'attachment', set_code: 'labor' }, sets).role, 'hero_auxiliary');
  assert.equal(classify({ faction_code: 'hero', type_code: 'alter_ego', hidden: true }, sets).role, 'identity');
  assert.equal(classify({ faction_code: 'basic', type_code: 'player_side_scheme' }, sets).role, 'deck_card');
  assert.equal(classify({ faction_code: 'basic', type_code: 'side_scheme' }, sets).role, 'review');
});

test('traduccion heredada conserva original y producto localizado de la impresion elegida', () => {
  const raw = new Map([['a', { code: 'a', name: 'English', text: 'Rules', type_code: 'event', faction_code: 'basic' }], ['b', { code: 'b', duplicate_of: 'a' }]]);
  const translations = new Map([['a', { name: 'Español', text: 'Reglas' }]]);
  const en = new Map([['a', { pack_name: 'First' }], ['b', { pack_name: 'Second' }]]);
  const es = new Map([['a', { pack_name: 'Primero' }], ['b', { pack_name: 'Segundo' }]]);
  const card = normalize('b', raw, resolveDuplicates(raw), translations, en, es, new Map(), 'commit');
  assert.equal(card.en.name, 'English'); assert.equal(card.es.name, 'Español');
  assert.equal(card.es.pack_name, 'Segundo'); assert.equal(card.translation_coverage.name.source, 'git_es:a');
  assert.equal(card.source.git_record.code, 'b'); assert.equal(card.source.api_en.pack_name, 'Second');
});

test('un cambio de commit sin cambios en carta no crea una correccion ficticia', () => {
  const a = { code: 'a', en: { cost: 0 }, source: { git_commit: 'old', git_record: { cost: 0 } } };
  const b = structuredClone(a); b.source.git_commit = 'new';
  assert.equal(fingerprint(a), fingerprint(b));
  b.en.cost = 1; assert.notEqual(fingerprint(a), fingerprint(b));
});

test('detecta y decodifica JPEG por bytes aunque la URL termine en png', async () => {
  const bytes = await imageDecoder()({ create: { width: 3, height: 4, channels: 3, background: '#aa0011' } }).jpeg().toBuffer();
  assert.deepEqual(await validateImage(bytes), { width: 3, height: 4, format: 'jpeg', extension: 'jpg' });
  await assert.rejects(validateImage(bytes.subarray(0, Math.floor(bytes.length / 2))));
  await assert.rejects(validateImage(Buffer.from('<html>unavailable</html>')));
});

test('CDN usa identificador confirmado del producto y distingue cara A/B; no adivina otras formas', () => {
  assert.deepEqual(cdnUrls({ code: '01001a', position: 1 }, 'front', { cgdb_id: 1 }), ['https://lcgcdn.s3.amazonaws.com/mc/MC01en_1A.jpg', 'https://lcgcdn.s3.amazonaws.com/mc/MC01en_1.jpg']);
  assert.deepEqual(cdnUrls({ code: '01001b', position: 1 }, 'front', { cgdb_id: 1 }), ['https://lcgcdn.s3.amazonaws.com/mc/MC01en_1B.jpg']);
  assert.deepEqual(cdnUrls({ code: '47007c', position: 7 }, 'front', { cgdb_id: 47 }), []);
  assert.deepEqual(cdnUrls({ code: '01001a', position: 1 }, 'front', {}), []);
});

test('manifiesto de escaneos exige codigo, hash y miembro y detecta alias ciclicos', () => {
  const sha = 'a'.repeat(64), member = `cards/${sha}.jpg`;
  const manifest = { cards: { a: { sha256: sha, bytes: 3, format: 'jpg', pack_id: 'pack' } }, aliases: { b: 'a' }, packs: { pack: { files: ['a'], members: { [member]: { sha256: sha, bytes: 3 } } } } };
  const result = resolveArtwork(manifest, 'b');
  assert.equal(result.alias, true); assert.equal(result.mapped_code, 'a'); assert.equal(result.member, member);
  assert.equal(resolveArtwork(manifest, 'unknown'), null);
  manifest.aliases.a = 'b'; assert.throws(() => resolveArtwork(manifest, 'b'), /Ciclo/);
  delete manifest.aliases.a; manifest.packs.pack.members[member].bytes = 4;
  assert.throws(() => resolveArtwork(manifest, 'b'), /inconsistente/);
});

test('complemento visual conserva imagen propia y distingue referencia de otra impresion', () => {
  const original = { code: 'b', face: 'front', status: 'ok', file: 'original.jpg' };
  const extra = { status: 'ok', kind: 'own_scan', file: 'community.jpg' };
  assert.equal(overlayArtwork(original, extra), original);
  const missing = { code: 'b', face: 'front', status: 'missing_url' };
  assert.equal(overlayArtwork(missing, extra).file, 'community.jpg');
  const reference = overlayArtwork(missing, { ...extra, kind: 'reprint_reference', reference_code: 'a', sha256: 'hash' });
  assert.equal(reference.status, 'reference_only'); assert.equal(reference.reference_image.code, 'a');
  assert.equal(reference.original_status, 'missing_url');
});

test('correccion local mantiene datos originales y evidencia de discrepancia', () => {
  const card = { en: { faction_code: 'justice' }, es: { faction_code: 'justice' }, source: { git_record: { faction_code: 'justice' }, api_en: { faction_code: 'aggression' } } };
  const correction = { fields: { en: { faction_code: 'aggression' }, es: { faction_code: 'aggression' } }, evidence: ['printed card'] };
  const fixed = applyLocalCorrection(card, correction);
  assert.equal(fixed.en.faction_code, 'aggression'); assert.equal(fixed.es.faction_code, 'aggression');
  assert.equal(fixed.source.git_record.faction_code, 'justice'); assert.equal(card.en.faction_code, 'justice');
  assert.equal(fixed.local_correction.evidence[0], 'printed card');
});

test('reutilizacion rechaza archivos ausentes o corruptos aunque el indice diga ok', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'marvel-library-test-'));
  const bytes = await imageDecoder()({ create: { width: 2, height: 2, channels: 3, background: '#123456' } }).png().toBuffer();
  const resource = { file: 'card.png', sha256: hash(bytes), status: 'ok' };
  try {
    await fs.writeFile(path.join(dir, resource.file), bytes);
    assert.equal(await createLocalVerifier(dir)(resource, true), true);
    await fs.writeFile(path.join(dir, resource.file), Buffer.from('corrupt'));
    assert.equal(await createLocalVerifier(dir)(resource), false);
    assert.equal(await createLocalVerifier(dir)({ ...resource, file: 'missing.png' }), false);
    assert.equal(await createLocalVerifier(dir)({ ...resource, file: '../outside.png' }), false);
  } finally { await fs.unlink(path.join(dir, resource.file)); await fs.rmdir(dir); }
});
