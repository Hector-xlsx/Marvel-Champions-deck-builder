import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { hash, fingerprint, classify, validateImage } from './lib/biblioteca.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = async p => JSON.parse(await fs.readFile(path.join(root, p), 'utf8'));
const pointer = await read('data/current.json');
const catalog = await read(pointer.catalog);
const images = await read(pointer.images);
const index = await read(pointer.index);
const manifest = await read(pointer.manifest);
const report = await read(pointer.report);
const taxonomy = await read(pointer.taxonomies);
assert.equal(hash(await fs.readFile(path.join(root, pointer.catalog))), manifest.catalog_sha256, 'Hash del catalogo');
const cards = new Map(catalog.cards.map(c => [c.code, c]));
assert.equal(cards.size, catalog.cards.length, 'Codigos unicos');
const sets = new Map(taxonomy.sets.en.map(s => [s.code, s]));
for (const card of cards.values()) {
  assert(!['encounter', 'campaign'].includes(card.en.faction_code), `Fuera de alcance: ${card.code}`);
  assert.equal(classify(card.en, sets).role, card.role, `Clasificacion ${card.code}`);
  assert.equal(fingerprint(card), card.content_hash, `Huella ${card.code}`);
  assert.equal(card.en.code, card.code); assert.equal(card.es.code, card.code);
  for (const field of Object.keys(card.source.git_record ?? {})) assert(Object.hasOwn(card.en, field), `Campo Git perdido ${card.code}.${field}`);
  for (const relation of ['other_face', 'duplicate_of']) if (card.links[relation]) assert(cards.has(card.links[relation]), `Relacion rota ${card.code}`);
  if (card.links.other_face) assert.equal(cards.get(card.links.other_face).links.other_face, card.code, `Relacion asimetrica ${card.code}`);
}
assert.deepEqual([...index.identities, ...index.deck_cards, ...index.hero_auxiliaries].sort(), [...cards.keys()].sort(), 'Indices cubren catalogo');
const verified = new Set(); let bytes = 0;
for (const resource of images) {
  assert(cards.has(resource.code));
  const file = resource.status === 'ok' ? resource.file : resource.reference_image?.file;
  const sha = resource.status === 'ok' ? resource.sha256 : resource.reference_image?.sha256;
  if (!file || verified.has(file)) continue;
  assert(file.startsWith('data/images/sha256/') && !file.includes('..'), 'Ruta de imagen fuera del almacen');
  const data = await fs.readFile(path.join(root, file));
  assert.equal(hash(data), sha, `Hash de imagen ${file}`);
  await validateImage(data); verified.add(file); bytes += data.length;
}
const unavailable = images.filter(i => i.status !== 'ok' && !i.reference_image);
assert.equal(report.counts.total, cards.size);
const summary = {
  verified_at: new Date().toISOString(), revision: pointer.revision, cards: cards.size,
  roles: report.counts.roles, unique_image_files_verified: verified.size, image_bytes: bytes,
  image_records: report.counts.images, reprint_references: report.counts.with_reference_image,
  without_visual_reference: unavailable.length, failed_downloads: report.failed_images.length,
  pending_downloads: images.filter(i => i.status === 'pending_download').length,
  checks: ['catalog_sha256', 'unique_codes', 'player_scope', 'classification', 'all_git_fields', 'card_fingerprints', 'relations', 'indices', 'image_sha256', 'pixel_decoding'],
};
await fs.mkdir(path.join(root, 'data/validation'), { recursive: true });
await fs.writeFile(path.join(root, 'data/validation/latest.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
if (summary.failed_downloads || summary.pending_downloads) process.exitCode = 2;
