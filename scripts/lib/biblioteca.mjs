import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';

export const VERSION = 1;
export const PLAYER_FACTIONS = new Set(['hero', 'basic', 'aggression', 'justice', 'leadership', 'protection', 'pool']);
export const DECK_TYPES = new Set(['ally', 'event', 'support', 'upgrade', 'resource', 'player_side_scheme']);
const LABEL_FIELDS = ['type_name', 'faction_name', 'pack_name', 'card_set_name'];
export const TEXT_FIELDS = ['name', 'subname', 'text', 'traits', 'flavor', 'back_name', 'back_text', 'back_flavor', 'errata', ...LABEL_FIELDS];
export const hash = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : stable(value)).digest('hex');
export function cdnUrls(card, face, pack) {
  if (!Number.isInteger(pack?.cgdb_id) || !Number.isInteger(card.position)) return [];
  const base = `https://lcgcdn.s3.amazonaws.com/mc/MC${String(pack.cgdb_id).padStart(2, '0')}en_${card.position}`;
  const suffix = card.code.match(/[a-f]$/)?.[0]?.toUpperCase();
  if (face === 'back') return [`${base}B.jpg`];
  if (suffix && !['A', 'B'].includes(suffix)) return [];
  if (suffix) return [`${base}${suffix}.jpg`, ...(suffix === 'A' ? [`${base}.jpg`] : [])];
  return [`${base}.jpg`, `${base}A.jpg`];
}
export function fingerprint(record) {
  const { content_hash, ...content } = record;
  return hash({ ...content, source: { ...content.source, git_commit: undefined } });
}
export function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function resolveDuplicates(raw) {
  const resolved = new Map();
  function resolve(code, trail = []) {
    if (resolved.has(code)) return resolved.get(code);
    if (trail.includes(code)) throw new Error(`Ciclo de reimpresion: ${[...trail, code].join(' -> ')}`);
    const card = raw.get(code);
    if (!card) throw new Error(`Reimpresion sin original: ${code}`);
    const base = card.duplicate_of ? resolve(card.duplicate_of, [...trail, code]) : {};
    const result = { ...base, ...card };
    resolved.set(code, result);
    return result;
  }
  for (const code of raw.keys()) resolve(code);
  return resolved;
}

export function classify(card, sets) {
  if (['encounter', 'campaign'].includes(card.faction_code)) return { role: 'excluded', reason: card.faction_code };
  if (!PLAYER_FACTIONS.has(card.faction_code)) return { role: 'review', reason: 'unknown_faction' };
  const set = sets.get(card.set_code ?? card.card_set_code);
  if (set?.card_set_type_code === 'hero_special') return { role: 'hero_auxiliary', parent_hero_set: set.parent_code ?? null };
  if (['hero', 'alter_ego'].includes(card.type_code)) return { role: 'identity' };
  if (DECK_TYPES.has(card.type_code)) return { role: 'deck_card' };
  return { role: 'review', reason: 'unknown_player_type' };
}

export function normalize(code, rawGit, resolvedGit, translations, apiEn, apiEs, sets, revision) {
  const git = resolvedGit.get(code);
  const remote = apiEn.get(code);
  const en = { ...(remote ?? {}), ...(git ?? {}) };
  delete en.linked_card;
  const classification = classify(en, sets);
  const coverage = {};
  const es = { ...en };
  function translated(field, current = code, trail = []) {
    if (trail.includes(current)) throw new Error(`Ciclo de traduccion ${current}`);
    const t = translations.get(current);
    if (t && Object.hasOwn(t, field)) return { value: t[field], status: 'present', source: `git_es:${current}` };
    const original = rawGit.get(current)?.duplicate_of;
    if (original && !LABEL_FIELDS.includes(field)) {
      const inherited = translated(field, original, [...trail, current]);
      if (inherited) return inherited;
    }
    const a = apiEs.get(current);
    const aEn = apiEn.get(current);
    if (a && Object.hasOwn(a, field) && a[field] != null && a[field] !== aEn?.[field]) {
      return { value: a[field], status: 'present_unreviewed', source: `api_es:${current}` };
    }
    return null;
  }
  for (const field of TEXT_FIELDS) {
    const result = translated(field);
    if (result) { es[field] = result.value; coverage[field] = { status: result.status, source: result.source }; }
    else if (Object.hasOwn(en, field)) coverage[field] = { status: 'fallback_en', source: 'en' };
    else coverage[field] = { status: 'not_available', source: null };
  }
  const setCode = en.set_code ?? en.card_set_code;
  const links = {
    other_face: git?.back_link ?? remote?.linked_to_code ?? null,
    duplicate_of: rawGit.get(code)?.duplicate_of ?? remote?.duplicate_of_code ?? null,
    set: setCode ?? null,
    parent_hero_set: classification.parent_hero_set ?? sets.get(setCode)?.parent_code ?? null,
  };
  const images = [];
  for (const [field, face] of [['imagesrc', 'front'], ['backimagesrc', 'back']]) {
    if (remote?.[field]) images.push({ face, url: new URL(remote[field], 'https://marvelcdb.com').href, requested_locale: 'en', verified_language: 'unknown' });
  }
  const source = {
    git_commit: git ? revision : null,
    git_record: rawGit.get(code) ?? null,
    git_translation_es: translations.get(code) ?? null,
    api_en: remote ? { ...remote } : null,
    api_es: apiEs.get(code) ? { ...apiEs.get(code) } : null,
  };
  const record = { code, role: classification.role, classification, en, es, translation_coverage: coverage, links, images, source };
  // A new source commit alone is not a card correction.
  return { ...record, content_hash: fingerprint(record) };
}

let decoder;
export function runtimeDependency(name) {
  try { return createRequire(import.meta.url)(name); }
  catch { return createRequire(process.execPath)(name); }
}
export function imageDecoder() {
  if (!decoder) {
    decoder = runtimeDependency('sharp');
  }
  return decoder;
}

export function resolveArtwork(manifest, code) {
  const seen = new Set(), requested = code;
  while (manifest.aliases[code]) {
    if (seen.has(code)) throw new Error(`Ciclo de alias de imagen: ${code}`);
    seen.add(code); code = manifest.aliases[code];
  }
  const image = manifest.cards[code];
  if (!image) return null;
  if (!/^[a-f0-9]{64}$/.test(image.sha256) || !['jpg', 'jpeg', 'png', 'webp'].includes(image.format)) throw new Error(`Imagen del manifiesto invalida: ${code}`);
  const pack = manifest.packs[image.pack_id];
  const member = `cards/${image.sha256}.${image.format}`;
  if (!pack || !pack.files.includes(code) || pack.members[member]?.sha256 !== image.sha256 || pack.members[member]?.bytes !== image.bytes) throw new Error(`Miembro de paquete inconsistente: ${code}`);
  return { requested, mapped_code: code, alias: requested !== code, image, pack, member };
}
export function overlayArtwork(base, artwork) {
  if (base.status === 'ok' || artwork?.status !== 'ok') return base;
  if (artwork.kind === 'reprint_reference') return {
    ...base, original_status: base.status, status: 'reference_only',
    reference_image: { code: artwork.reference_code, file: artwork.file, sha256: artwork.sha256, source: artwork.source, label: 'Otra impresion; referencia documentada en manifiesto de escaneos' },
  };
  return { ...base, ...artwork, original_status: base.status, status: 'ok' };
}
export function applyLocalCorrection(card, correction) {
  if (!correction) return card;
  const result = structuredClone(card);
  for (const locale of ['en', 'es']) Object.assign(result[locale], correction.fields[locale] ?? {});
  result.local_correction = correction;
  result.content_hash = fingerprint(result);
  return result;
}
export function createLocalVerifier(root) {
  const cache = new Map();
  return async (resource, decode = false) => {
    if (!resource?.file || !resource.sha256) return false;
    const key = `${resource.file}:${resource.sha256}:${decode}`;
    if (!cache.has(key)) cache.set(key, (async () => {
      try {
        const target = path.resolve(root, resource.file);
        if (!target.startsWith(path.resolve(root) + path.sep)) return false;
        const bytes = await fs.readFile(target);
        if (hash(bytes) !== resource.sha256) return false;
        if (decode) await validateImage(bytes);
        return true;
      } catch { return false; }
    })());
    return cache.get(key);
  };
}
export async function validateImage(bytes) {
  const image = imageDecoder()(bytes, { failOn: 'warning', limitInputPixels: 40_000_000 });
  const metadata = await image.metadata();
  if (!['png', 'jpeg', 'webp'].includes(metadata.format)) throw new Error(`Formato no admitido: ${metadata.format}`);
  // Force pixel decoding: metadata/header inspection alone accepts truncated files.
  await image.raw().toBuffer();
  return { width: metadata.width, height: metadata.height, format: metadata.format, extension: metadata.format === 'jpeg' ? 'jpg' : metadata.format };
}
