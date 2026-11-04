import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
import { VERSION, hash, fingerprint, normalize, resolveDuplicates, validateImage, cdnUrls, overlayArtwork, applyLocalCorrection, classify, createLocalVerifier } from './lib/biblioteca.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const verifyLocal = createLocalVerifier(ROOT);
const SOURCE = path.join(ROOT, 'sources/marvelsdb-json-data');
const args = new Set(process.argv.slice(2));
const ALLOWED = ['--solo-datos', '--offline', '--sincronizar', '--imagenes', '--revalidar-imagenes', '--solo-cdn', '--usar-cdn'];
for (const arg of args) if (!ALLOWED.includes(arg) && !/^--(?:interval-ms|concurrency)=\d+$/.test(arg)) throw new Error(`Opcion desconocida: ${arg}`);
const interval = Number([...args].find(a => a.startsWith('--interval-ms='))?.split('=')[1] ?? 1000);
if (interval < 250) throw new Error('El intervalo minimo local es 250 ms');
const concurrency = Number([...args].find(a => a.startsWith('--concurrency='))?.split('=')[1] ?? 1);
if (concurrency < 1 || concurrency > 4) throw new Error('Concurrencia permitida: 1 a 4');
const offline = args.has('--offline');
const imagesEnabled = !args.has('--solo-datos');
const sync = args.has('--sincronizar');
const revalidateImages = sync || args.has('--revalidar-imagenes');
const now = () => new Date().toISOString();
const git = (...a) => execFileSync('git', ['-C', SOURCE, ...a], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
const revision = git('rev-parse', 'HEAD');
if (git('status', '--porcelain', '--untracked-files=no')) throw new Error('La fuente Git tiene cambios locales; no se importara una revision ambigua');
const runId = `${now().replace(/[:.]/g, '-')}-${process.pid}`;
const rel = (...p) => p.join('/');
const absolute = p => path.join(ROOT, p);
async function read(p, fallback) { try { return JSON.parse(await fs.readFile(absolute(p), 'utf8')); } catch (e) { if (e.code === 'ENOENT' && fallback !== undefined) return fallback; throw e; } }
async function write(p, value) {
  const target = absolute(p);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`);
  await fs.rename(temp, target);
}
async function exists(p) { try { await fs.access(absolute(p)); return true; } catch { return false; } }
const networkSources = [];
let lastRequest = 0;
let rateQueue = Promise.resolve();
let cooldownUntil = 0;
let networkStopped = null;
async function request(url, headers = {}, optionalCdnCandidate = false) {
  if (networkStopped) throw new Error(networkStopped);
    if (!['marvelcdb.com', 'es.marvelcdb.com', 'lcgcdn.s3.amazonaws.com'].includes(new URL(url).hostname)) throw new Error(`Origen no autorizado: ${url}`);
  for (let attempt = 0; attempt < 4; attempt++) {
    rateQueue = rateQueue.then(async () => {
      await pause(Math.max(0, interval - (Date.now() - lastRequest), cooldownUntil - Date.now()));
      while (Date.now() < cooldownUntil) await pause(Math.min(60000, cooldownUntil - Date.now()));
      lastRequest = Date.now();
    });
    await rateQueue;
    if (networkStopped) throw new Error(networkStopped);
    let response;
    try { response = await fetch(url, { headers: { 'User-Agent': 'Marvel20-local-library/1.0 (personal card library; cached requests)', 'Connection': 'close', ...headers }, signal: AbortSignal.timeout(45000) }); }
    catch (e) { if (attempt === 3) throw e; await pause(1000 * 2 ** attempt); continue; }
    // A derived S3 candidate can be absent/non-public (S3 returns 403 without ListBucket).
    // Do not retry that object or attempt authentication; keep its status and use
    // a different documented candidate / the independent public API reference.
    if (response.status === 403 && optionalCdnCandidate && new URL(url).hostname === 'lcgcdn.s3.amazonaws.com') return response;
    if ([401, 403].includes(response.status)) { networkStopped = `Acceso detenido: HTTP ${response.status} en ${url}`; throw new Error(networkStopped); }
    if (response.status === 429 || response.status >= 500) {
      if (attempt === 3) throw new Error(`HTTP ${response.status}: ${url}`);
      const retry = response.headers.get('retry-after');
      const retryMs = retry ? (/^\d+$/.test(retry) ? Number(retry) * 1000 : Math.max(0, Date.parse(retry) - Date.now())) : 1000 * 2 ** attempt;
      if (response.status === 429) cooldownUntil = Math.max(cooldownUntil, Date.now() + Math.max(1000, retryMs));
      console.log(`Espera HTTP ${response.status}: ${Math.ceil(retryMs / 1000)} s`);
      await response.body?.cancel(); await pause(Math.max(1000, retryMs)); continue;
    }
    return response;
  }
}

async function jsonSource(url) {
  const cachePath = `data/cache/${hash(url)}.json`;
  const cache = await read(cachePath, null);
  if (offline || (args.has('--imagenes') && cache)) {
    if (!cache) throw new Error(`Sin cache para ${url}`);
    const value = await read(cache.body);
    if (hash(Buffer.from(await fs.readFile(absolute(cache.body)))) !== cache.sha256) throw new Error(`Cache alterada: ${url}`);
    networkSources.push({ ...cache, used: offline ? 'offline' : 'image_resume_cache' }); return value;
  }
  if (cache && Date.now() < cache.fresh_until) {
    const bytes = await fs.readFile(absolute(cache.body));
    if (hash(bytes) !== cache.sha256) throw new Error(`Cache alterada: ${url}`);
    networkSources.push({ ...cache, used: 'fresh_cache' }); return JSON.parse(bytes);
  }
  const headers = {};
  if (cache?.etag) headers['If-None-Match'] = cache.etag;
  if (cache?.last_modified) headers['If-Modified-Since'] = cache.last_modified;
  const response = await request(url, headers);
  const age = Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] ?? 600);
  if (response.status === 304 && cache) {
    const bytes = await fs.readFile(absolute(cache.body));
    if (hash(bytes) !== cache.sha256) throw new Error('Cache 304 alterada');
    const updated = { ...cache, checked_at: now(), fresh_until: Date.now() + age * 1000 };
    await write(cachePath, updated); networkSources.push({ ...updated, used: '304' }); return JSON.parse(bytes);
  }
  if (!response.ok || !response.headers.get('content-type')?.includes('json')) throw new Error(`Respuesta JSON invalida ${response.status} ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const value = JSON.parse(bytes.toString('utf8'));
  if (!Array.isArray(value) || value.length === 0) throw new Error(`Catalogo vacio/invalido: ${url}`);
  const sha256 = hash(bytes), body = `data/raw/api/${sha256}.json`;
  await fs.mkdir(path.dirname(absolute(body)), { recursive: true });
  if (!(await exists(body))) await fs.writeFile(absolute(body), bytes);
  const metadata = { url, body, sha256, fetched_at: now(), checked_at: now(), fresh_until: Date.now() + age * 1000, last_modified: response.headers.get('last-modified'), etag: response.headers.get('etag'), content_language: response.headers.get('content-language') };
  await write(cachePath, metadata); networkSources.push({ ...metadata, used: '200' }); return value;
}

function indexed(cards, label) {
  const result = new Map();
  for (const card of cards) {
    if (typeof card.code !== 'string' || !card.code || result.has(card.code)) throw new Error(`Codigo invalido/duplicado: ${label} ${card.code}`);
    result.set(card.code, card);
  }
  return result;
}
async function gitCards(dir) {
  const result = [], files = [];
  for (const file of (await fs.readdir(path.join(SOURCE, dir))).filter(x => x.endsWith('.json')).sort()) {
    const bytes = await fs.readFile(path.join(SOURCE, dir, file));
    const value = JSON.parse(bytes);
    if (!Array.isArray(value)) throw new Error(`JSON fuente invalido: ${dir}/${file}`);
    result.push(...value); files.push({ path: `${dir}/${file}`, sha256: hash(bytes), count: value.length });
  }
  return { map: indexed(result, dir), files };
}

console.log(`Importacion ${runId}; Git ${revision}; modo ${sync ? 'sincronizar' : 'solo altas'}; imagenes ${imagesEnabled}`);
const base = await gitCards('pack');
const spanish = await gitCards('translations/es/pack');
const resolved = resolveDuplicates(base.map);
const taxonomies = {};
for (const name of ['packs', 'types', 'factions', 'sets', 'settypes', 'subtypes', 'packtypes']) {
  taxonomies[name] = { en: JSON.parse(await fs.readFile(path.join(SOURCE, `${name}.json`))), es: JSON.parse(await fs.readFile(path.join(SOURCE, `translations/es/${name}.json`))) };
}
const sets = indexed(taxonomies.sets.en, 'sets');
const packsByCode = indexed(taxonomies.packs.en, 'packs');
const apiEn = indexed(await jsonSource('https://marvelcdb.com/api/public/cards/'), 'api_en');
const apiEs = indexed(await jsonSource('https://es.marvelcdb.com/api/public/cards/'), 'api_es');
const apiPacks = await jsonSource('https://marvelcdb.com/api/public/packs/');
const previousPointer = await read('data/current.json', null);
const previous = previousPointer ? await read(previousPointer.catalog) : { cards: [] };
const old = indexed(previous.cards, 'previous');
const localCorrections = await read('data/overrides/cards.json', { cards: {} });
const incoming = new Map(), excluded = [], review = [], sourceDifferences = [], sourceFieldConflicts = [];
for (const code of [...new Set([...resolved.keys(), ...apiEn.keys(), ...apiEs.keys()])].sort()) {
  const card = applyLocalCorrection(normalize(code, base.map, resolved, spanish.map, apiEn, apiEs, sets, revision), localCorrections.cards[code]);
  card.classification = classify(card.en, sets); card.role = card.classification.role;
  if (card.role === 'excluded') { excluded.push({ code, reason: card.classification.reason }); continue; }
  if (card.role === 'review') { review.push({ code, reason: card.classification.reason, name: card.en.name }); continue; }
  incoming.set(code, card);
  for (const field of ['type_code', 'faction_code', 'quantity', 'cost', 'health', 'attack', 'thwart', 'defense', 'deck_limit', 'hand_size']) {
    const g = resolved.get(code), a = apiEn.get(code);
    if (g && a && Object.hasOwn(g, field) && Object.hasOwn(a, field) && g[field] !== a[field]) sourceFieldConflicts.push({ code, field, git: g[field], api: a[field], selected_source: localCorrections.cards[code]?.fields.en?.[field] !== undefined ? 'reviewed_local_correction' : 'git', selected_value: card.en[field] });
  }
  if (!base.map.has(code) || !apiEn.has(code)) sourceDifferences.push({ code, git: base.map.has(code), api_en: apiEn.has(code), api_es: apiEs.has(code) });
}
if (!incoming.size || review.length) { await write(`data/reports/${runId}-blocked.json`, { review, incoming: incoming.size }); throw new Error(`Clasificacion incompleta: ${review.length} registros por revisar`); }
for (const card of incoming.values()) {
  const other = incoming.get(card.links.other_face);
  if (other && !other.links.other_face) other.links.other_face = card.code;
}
for (const card of incoming.values()) card.content_hash = fingerprint(card);
const added = [], changed = [], retainedMissing = [];
const cards = [];
for (const [code, candidate] of incoming) {
  const existing = old.get(code);
  if (!existing) { added.push(code); cards.push(candidate); }
  else if (existing.content_hash !== candidate.content_hash) { changed.push(code); cards.push(sync ? candidate : existing); }
  else cards.push(existing);
}
for (const [code, existing] of old) if (!incoming.has(code)) { retainedMissing.push(code); cards.push(existing); }
cards.sort((a, b) => a.code.localeCompare(b.code));
const byCode = indexed(cards, 'catalog');
const unresolved = [];
for (const card of cards) for (const relation of ['other_face', 'duplicate_of']) {
  const target = card.links[relation];
  if (target && !byCode.has(target)) unresolved.push({ code: card.code, relation, target, reason: excluded.find(c => c.code === target)?.reason ?? 'missing' });
}

const imageIndex = await read('data/images/index.json', { version: VERSION, entries: {} });
const journalPath = 'data/images/downloads.jsonl';
if (await exists(journalPath)) {
  for (const line of (await fs.readFile(absolute(journalPath), 'utf8')).split('\n').filter(Boolean)) {
    try { const item = JSON.parse(line); imageIndex.entries[item.url] = item; }
    catch { throw new Error('Diario de imagenes incompleto; conservar y revisar antes de reanudar'); }
  }
}
const unavailableCdnCandidates = new Map();
for (const item of Object.values(imageIndex.entries)) {
  for (const candidate of item.candidate_results ?? []) if ([403, 404].includes(candidate.status)) unavailableCdnCandidates.set(candidate.url, candidate.status);
  const oldDenied = item.error?.match(/HTTP 403 en (https:\/\/lcgcdn\.s3\.amazonaws\.com\/\S+)/)?.[1];
  if (oldDenied) unavailableCdnCandidates.set(oldDenied, 403);
}
let downloaded = 0, reused = 0, attempted = 0;
let consecutiveImageFailures = 0;
let persistence = Promise.resolve(), completed = 0;
let blobPersistence = Promise.resolve();
async function storeBlob(file, bytes, sha256) {
  blobPersistence = blobPersistence.then(async () => {
    await fs.mkdir(path.dirname(absolute(file)), { recursive: true });
    if (await exists(file) && hash(await fs.readFile(absolute(file))) !== sha256) {
      const quarantine = `data/images/corrupt/${path.basename(file)}.${runId}`;
      await fs.mkdir(path.dirname(absolute(quarantine)), { recursive: true });
      await fs.rename(absolute(file), absolute(quarantine));
    }
    if (!(await exists(file))) {
      const temp = `${absolute(file)}.${process.pid}.tmp`;
      await fs.writeFile(temp, bytes); await fs.rename(temp, absolute(file));
    }
  });
  await blobPersistence;
}
async function saveImage(entry) {
  persistence = persistence.then(async () => {
    await fs.mkdir(path.dirname(absolute(journalPath)), { recursive: true });
    await fs.appendFile(absolute(journalPath), `${JSON.stringify(entry)}\n`);
    if (++completed % 25 === 0) await write('data/images/index.json', imageIndex);
  });
  await persistence;
}
const imageQueue = new Map();
const community = await read('data/images/community-index.json', { entries: {} });
for (const card of cards) for (const image of card.images) imageQueue.set(image.url, { ...image, code: card.code });
function originalCdnUrls(url) {
  const job = imageQueue.get(url), card = byCode.get(job.code);
  const pack = packsByCode.get(card.en.pack_code);
  return cdnUrls(card.en, job.face, pack);
}
console.log(`Catalogo: ${cards.length}; altas ${added.length}; cambios detectados ${changed.length}; excluidos ${excluded.length}; imagenes URL ${imageQueue.size}`);
if (imagesEnabled) {
  const jobs = [...imageQueue.keys()]; let nextJob = 0;
  async function worker() {
  while (nextJob < jobs.length && !networkStopped) {
    const url = jobs[nextJob++];
    const cached = imageIndex.entries[url];
    let localValid = false;
    if (cached?.status === 'ok' && await exists(cached.file)) {
      try {
        const bytes = await fs.readFile(absolute(cached.file));
        if (hash(bytes) === cached.sha256) {
          await validateImage(bytes); localValid = true;
          if (!revalidateImages || offline) { reused++; continue; }
        }
      } catch { /* corrupt resources are retried, never accepted by filename alone */ }
    }
    const job = imageQueue.get(url);
    const supplement = community.entries[`${job.code}:${job.face}`];
    if (supplement?.status === 'ok' && (!revalidateImages || offline) && await exists(supplement.file)) {
      const bytes = await fs.readFile(absolute(supplement.file));
      if (hash(bytes) === supplement.sha256) { await validateImage(bytes); reused++; continue; }
    }
    if (offline) {
      if (cached?.status === 'ok') {
        imageIndex.entries[url] = { ...cached, status: 'failed', error: 'Archivo local ausente o corrupto', attempted_at: now() };
        await saveImage(imageIndex.entries[url]);
      }
      continue;
    }
    attempted++;
    const candidateResults = [];
    try {
      const headers = {};
      if (localValid && cached.etag) headers['If-None-Match'] = cached.etag;
      if (localValid && cached.last_modified) headers['If-Modified-Since'] = cached.last_modified;
      let response;
      let downloadedFrom = url;
      // Public upstream mapping: ImportImagesCommand.php + packs.cgdb_id.
      // Revalidation stays on the URL which actually supplied the cached bytes.
      if (localValid) downloadedFrom = cached.final_url ?? url;
      else if (args.has('--solo-cdn') || args.has('--usar-cdn')) {
        for (const candidate of originalCdnUrls(url)) {
          if (unavailableCdnCandidates.has(candidate)) { candidateResults.push({ url: candidate, status: unavailableCdnCandidates.get(candidate), reused: true }); continue; }
          const attempt = await request(candidate, {}, true);
          if ([403, 404].includes(attempt.status)) {
            unavailableCdnCandidates.set(candidate, attempt.status); candidateResults.push({ url: candidate, status: attempt.status });
            await attempt.body?.cancel(); continue;
          }
          response = attempt; downloadedFrom = candidate; break;
        }
      }
      if (!response && !localValid && args.has('--solo-cdn')) {
        const error = new Error('Sin candidato CDN publico; pendiente consultar URL original de la API');
        error.pendingOrigin = true; throw error;
      }
      response ??= await request(downloadedFrom, headers);
      if (response.status === 304 && localValid) {
        imageIndex.entries[url] = { ...cached, checked_at: now() }; reused++;
        consecutiveImageFailures = 0;
      } else {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.headers.get('content-type')?.startsWith('image/')) throw new Error('MIME no es imagen');
      const bytes = Buffer.from(await response.arrayBuffer());
      const dimensions = await validateImage(bytes);
      const sha256 = hash(bytes), file = `data/images/sha256/${sha256}.${dimensions.extension}`;
      await storeBlob(file, bytes, sha256);
      imageIndex.entries[url] = { url, final_url: response.url, downloaded_from: downloadedFrom, mapping_source: downloadedFrom === url ? 'marvelcdb_api' : 'marvelsdb_ImportImagesCommand+packs.cgdb_id', candidate_results: candidateResults, file, sha256, bytes: bytes.length, ...dimensions, mime: response.headers.get('content-type'), status: 'ok', requested_locale: 'en', verified_language: 'unknown', fetched_at: now(), last_modified: response.headers.get('last-modified'), etag: response.headers.get('etag') };
      downloaded++;
      consecutiveImageFailures = 0;
      }
    } catch (e) {
      imageIndex.entries[url] = { ...(cached ?? {}), url, status: e.pendingOrigin ? 'pending_download' : 'failed', error: e.message, candidate_results: candidateResults, attempted_at: now() };
      console.log(`Imagen pendiente ${url}: ${e.message}`);
      if (!e.pendingOrigin && ++consecutiveImageFailures >= 3) networkStopped ??= 'Descarga pausada tras tres imagenes fallidas consecutivas (incluidos sus reintentos)';
    }
    await saveImage(imageIndex.entries[url]);
    if (completed % 25 === 0) console.log(`Imagenes: ${completed} terminadas; ${downloaded} descargadas; ${reused} reutilizadas; total URLs ${imageQueue.size}`);
    if (networkStopped) break;
  }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
}
await write('data/images/index.json', imageIndex);
const images = [];
for (const card of cards) {
  if (!card.images.length) {
    let original = byCode.get(card.links.duplicate_of);
    const visited = new Set([card.code]);
    while (original && !original.images.length && !visited.has(original.code)) {
      visited.add(original.code); original = byCode.get(original.links.duplicate_of);
    }
    const image = original?.images.find(i => i.face === 'front');
    const resource = image && imageIndex.entries[image.url];
    images.push({ code: card.code, face: 'front', status: 'missing_url', reference_image: resource?.status === 'ok' && await verifyLocal(resource) ? { code: original.code, file: resource.file, sha256: resource.sha256, label: 'Otra impresion; falta escaneo de esta impresion' } : null });
  }
  for (const image of card.images) {
    let cached = imageIndex.entries[image.url];
    if (cached?.status === 'ok' && !(await verifyLocal(cached))) cached = { ...cached, status: 'failed', error: 'Archivo local ausente o corrupto' };
    images.push({ code: card.code, ...image, ...(cached ?? { status: 'pending_download' }) });
  }
}
for (let i = 0; i < images.length; i++) {
  const entry = images[i];
  const supplement = community.entries[`${entry.code}:${entry.face}`];
  if (supplement?.status === 'ok' && !(await verifyLocal(supplement))) {
    images[i] = entry.status === 'ok' ? entry : { ...entry, status: 'failed', error: 'Archivo comunitario ausente o corrupto' };
  } else images[i] = overlayArtwork(entry, supplement);
}
const frontImages = new Map(images.filter(i => i.face === 'front').map(i => [i.code, i]));
for (const entry of images) {
  if (entry.status === 'ok') continue;
  if (!entry.reference_image && entry.face === 'front') {
    let originalCode = byCode.get(entry.code)?.links.duplicate_of;
    const seen = new Set([entry.code]);
    while (originalCode && !seen.has(originalCode)) {
      seen.add(originalCode);
      const original = frontImages.get(originalCode);
      if (original?.status === 'ok') { entry.reference_image = { code: originalCode, file: original.file, sha256: original.sha256, label: 'Otra impresion; relacion duplicate_of' }; break; }
      if (original?.reference_image) { entry.reference_image = original.reference_image; break; }
      originalCode = byCode.get(originalCode)?.links.duplicate_of;
    }
  }
  if (entry.reference_image && entry.status !== 'reference_only') { entry.original_status = entry.status; entry.status = 'reference_only'; }
}
const counts = key => cards.reduce((a, c) => (a[c[key]] = (a[c[key]] ?? 0) + 1, a), {});
const imageCounts = images.reduce((a, c) => (a[c.status] = (a[c.status] ?? 0) + 1, a), {});
const coverage = {};
for (const card of cards) for (const [field, value] of Object.entries(card.translation_coverage)) {
  coverage[field] ??= {}; coverage[field][value.status] = (coverage[field][value.status] ?? 0) + 1;
}
if (git('rev-parse', 'HEAD') !== revision || git('status', '--porcelain', '--untracked-files=no')) throw new Error('La fuente cambio durante la importacion');
const report = {
  version: VERSION, run_id: runId, created_at: now(), mode: sync ? 'sync' : 'add_only', git_commit: revision,
  counts: { total: cards.length, roles: counts('role'), images: imageCounts, with_reference_image: images.filter(i => i.reference_image).length, unique_image_urls: imageQueue.size, downloaded, reused, excluded: excluded.length, source_review: review.length },
  added, changed_existing_detected: changed, changed_existing_applied: sync ? changed : [], retained_missing: retainedMissing,
  translation_coverage: coverage, source_differences: sourceDifferences, source_field_conflicts: sourceFieldConflicts, unresolved_relations: unresolved,
  images_without_url: cards.filter(c => !c.images.length).map(c => c.code), failed_images: images.filter(i => i.status === 'failed'),
  excluded, review, network_stopped: networkStopped,
};
const catalogPath = `data/catalog/${runId}/cards.json`;
await write(catalogPath, { version: VERSION, revision: runId, scope: 'player_deckbuilding', cards });
await write(`data/catalog/${runId}/images.json`, images);
await write(`data/catalog/${runId}/taxonomies.json`, { ...taxonomies, api_packs: apiPacks });
await write(`data/catalog/${runId}/index.json`, {
  identities: cards.filter(c => c.role === 'identity').map(c => c.code),
  deck_cards: cards.filter(c => c.role === 'deck_card').map(c => c.code),
  hero_auxiliaries: cards.filter(c => c.role === 'hero_auxiliary').map(c => c.code),
});
await write(`data/reports/${runId}.json`, report);
await write(`data/manifests/${runId}.json`, { version: VERSION, run_id: runId, created_at: now(), git_commit: revision, git_files: [...base.files, ...spanish.files], sources: networkSources, community_artwork: community.source ?? null, catalog: catalogPath, catalog_sha256: hash(await fs.readFile(absolute(catalogPath))), report: `data/reports/${runId}.json`, previous: previousPointer });
await write('data/current.json', { version: VERSION, revision: runId, catalog: catalogPath, images: `data/catalog/${runId}/images.json`, index: `data/catalog/${runId}/index.json`, taxonomies: `data/catalog/${runId}/taxonomies.json`, manifest: `data/manifests/${runId}.json`, report: `data/reports/${runId}.json` });
console.log(JSON.stringify({ revision: runId, ...report.counts, translation_coverage: coverage, unresolved_relations: unresolved, network_stopped: networkStopped }, null, 2));
if (networkStopped || (imagesEnabled && images.some(i => ['failed', 'pending_download'].includes(i.status)))) process.exitCode = 2;
