import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { execFileSync } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { hash, validateImage, runtimeDependency, resolveArtwork, createLocalVerifier } from './lib/biblioteca.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const verifyLocal = createLocalVerifier(ROOT);
const PIN = '253a9df03ec0d10e26493df631a5293bdd8d7f5a';
const MANIFEST_URL = `https://raw.githubusercontent.com/sdolle1775/marvel-lcg/${PIN}/data/artwork-manifest.json`;
const offline = process.argv.includes('--offline');
if (process.argv.slice(2).some(a => a !== '--offline')) throw new Error('Opcion desconocida');
const Zip = runtimeDependency('jszip');
const abs = p => path.join(ROOT, p);
const exists = async p => { try { await fs.access(abs(p)); return true; } catch { return false; } };
async function read(p, fallback) { try { return JSON.parse(await fs.readFile(abs(p), 'utf8')); } catch (e) { if (e.code === 'ENOENT' && fallback !== undefined) return fallback; throw e; } }
async function write(p, data) {
  await fs.mkdir(path.dirname(abs(p)), { recursive: true });
  const temp = `${abs(p)}.${randomUUID()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(data, null, 2) + '\n'); await fs.rename(temp, abs(p));
}
async function fetchPublic(url) {
  if (!/^https:\/\/(?:raw\.githubusercontent\.com\/sdolle1775\/marvel-lcg\/|github\.com\/sdolle1775\/marvel-lcg\/releases\/download\/)/.test(url)) throw new Error('Origen de imagen no autorizado');
  for (let n = 0; n < 3; n++) {
    let r;
    try { r = await fetch(url, { signal: AbortSignal.timeout(180000), headers: { 'User-Agent': 'Marvel20-local-player-library/1.0' } }); }
    catch (e) { if (n === 2) throw e; await pause(1000 * 2 ** n); continue; }
    if ([401, 403].includes(r.status)) throw new Error(`Acceso no disponible: HTTP ${r.status} ${url}`);
    if (r.status === 429 || r.status >= 500) {
      if (n === 2) throw new Error(`HTTP ${r.status}`);
      const wait = r.headers.get('retry-after');
      await r.body?.cancel();
      await pause(wait && /^\d+$/.test(wait) ? Number(wait) * 1000 : 2000 * 2 ** n); continue;
    }
    if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
    return r;
  }
}
const manifestPath = 'data/raw/community/artwork-manifest.json';
if (!(await exists(manifestPath))) {
  if (offline) throw new Error('No hay manifiesto comunitario local para ejecutar sin red');
  const bytes = await (await fetchPublic(MANIFEST_URL)).arrayBuffer();
  await fs.mkdir(path.dirname(abs(manifestPath)), { recursive: true });
  await fs.writeFile(abs(manifestPath), Buffer.from(bytes));
}
const manifestBytes = await fs.readFile(abs(manifestPath));
const manifest = JSON.parse(manifestBytes);
if (!manifest.release_ready || manifest.catalog_id !== 'artwork-2026-10-18-1') throw new Error('Manifiesto no corresponde a la revision fijada');
const provenance = { manifest_url: MANIFEST_URL, git_commit: PIN, manifest_sha256: hash(manifestBytes), catalog_id: manifest.catalog_id, attribution: manifest.provenance.source_pin.attribution };
await write('data/raw/community/source.json', provenance);
const pointer = await read('data/current.json');
const cards = (await read(pointer.catalog)).cards;
const existing = await read(pointer.images);
const additions = await read('data/images/community-index.json', { version: 1, source: provenance, entries: {} });
if (additions.source.manifest_sha256 !== provenance.manifest_sha256) throw new Error('Manifiesto comunitario distinto; conservar indice anterior antes de actualizar');
const jobs = new Map(), missing = [], requested = [];
let reused = 0, extracted = 0;
for (const card of cards) {
  const faces = card.images.length ? card.images : [{ face: 'front', url: null }];
  for (const face of faces) {
    const key = `${card.code}:${face.face}`;
    const current = existing.find(i => i.code === card.code && i.face === face.face);
    const local = current?.status === 'ok' ? current : current?.reference_image;
    if (await verifyLocal(local)) { reused++; continue; }
    if (additions.entries[key]?.status === 'ok' && await exists(additions.entries[key].file)) {
      const saved = additions.entries[key];
      const bytes = await fs.readFile(abs(saved.file));
      if (hash(bytes) === saved.sha256) { await validateImage(bytes); reused++; continue; }
    }
    // The API explicitly identifies 26002a/26002b images for the single card 26002.
    const apiImageCode = face.url && new URL(face.url).pathname.match(/\/([0-9]{5}[a-f]?)\.(?:png|jpe?g|webp)$/i)?.[1];
    const lookup = face.face === 'back' ? apiImageCode : (manifest.cards[card.code] || manifest.aliases[card.code] ? card.code : apiImageCode ?? card.code);
    const resolved = lookup && resolveArtwork(manifest, lookup);
    if (!resolved) { missing.push({ code: card.code, face: face.face, manifest_code: lookup ?? null }); continue; }
    const job = { key, code: card.code, face: face.face, api_url: face.url, ...resolved };
    jobs.set(resolved.image.pack_id, [...(jobs.get(resolved.image.pack_id) ?? []), job]);
    requested.push({ code: card.code, face: face.face, mapped_code: resolved.mapped_code, alias: resolved.alias, pack_id: resolved.image.pack_id });
  }
}
console.log(JSON.stringify({ source: provenance.catalog_id, player_records: cards.length, packs: jobs.size, image_requests: requested.length, archives_MB: [...jobs.keys()].reduce((s, id) => s + manifest.packs[id].bytes, 0) / 1e6, already_available: reused, unmapped: missing }, null, 2));
let saveQueue = Promise.resolve(), blobQueue = Promise.resolve();
async function save() { saveQueue = saveQueue.then(() => write('data/images/community-index.json', additions)); await saveQueue; }
async function store(file, bytes) {
  blobQueue = blobQueue.then(async () => {
    await fs.mkdir(path.dirname(abs(file)), { recursive: true });
    if (await exists(file)) {
      if (hash(await fs.readFile(abs(file))) === hash(bytes)) return;
      const quarantine = `data/images/corrupt/${path.basename(file)}.${randomUUID()}`;
      await fs.mkdir(path.dirname(abs(quarantine)), { recursive: true }); await fs.rename(abs(file), abs(quarantine));
    }
    const temp = `${abs(file)}.${randomUUID()}.tmp`;
    await fs.writeFile(temp, bytes); await fs.rename(temp, abs(file));
  });
  await blobQueue;
}
const queue = [...jobs], failures = [], archives = [];
let next = 0, finished = 0, stopped = false;
async function worker() {
  while (next < queue.length && !stopped) {
    const [id, members] = queue[next++], pack = manifest.packs[id];
    try {
      if (!/^[a-f0-9]{64}$/.test(pack.sha256)) throw new Error('Hash de paquete invalido');
      const archivePath = `data/raw/community/packs/${pack.sha256}.zip`;
      let bytes;
      if (await exists(archivePath)) {
        bytes = await fs.readFile(abs(archivePath));
        if (hash(bytes) !== pack.sha256) throw new Error(`Archivo ZIP local corrupto: ${archivePath}`);
      } else {
        if (offline) throw new Error(`ZIP pendiente sin red: ${id}`);
        const response = await fetchPublic(pack.url);
        await fs.mkdir(path.dirname(abs(archivePath)), { recursive: true });
        const temp = `${abs(archivePath)}.${randomUUID()}.tmp`;
        let size = 0;
        const limiter = new Transform({ transform(chunk, encoding, done) { size += chunk.length; done(size > pack.bytes ? new Error('Paquete supera tamaño declarado') : null, chunk); } });
        await pipeline(Readable.fromWeb(response.body), limiter, createWriteStream(temp));
        bytes = await fs.readFile(temp);
        if (size !== pack.bytes || hash(bytes) !== pack.sha256) throw new Error(`Hash/tamaño ZIP no coincide: ${id}`);
        await fs.rename(temp, abs(archivePath));
      }
      if (bytes.length !== pack.bytes) throw new Error('Tamaño ZIP invalido');
      const zip = await Zip.loadAsync(bytes);
      // Extract only exact player members; never extract a directory or run code.
      for (const job of members) {
        const entry = zip.file(job.member);
        if (!entry) throw new Error(`Miembro ausente ${job.member}`);
        const data = await entry.async('nodebuffer');
        if (data.length !== job.image.bytes || hash(data) !== job.image.sha256) throw new Error(`Hash de carta no coincide: ${job.code}`);
        const info = await validateImage(data);
        if (info.width !== job.image.width || info.height !== job.image.height) throw new Error(`Dimensiones no coinciden: ${job.code}`);
        const file = `data/images/sha256/${job.image.sha256}.${info.extension}`;
        await store(file, data);
        additions.entries[job.key] = {
          code: job.code, face: job.face, status: 'ok', kind: job.alias ? 'reprint_reference' : 'own_scan',
          mapped_code: job.mapped_code, reference_code: job.alias ? job.mapped_code : null,
          source: 'sdolle1775/marvel-lcg community artwork', catalog_id: manifest.catalog_id,
          manifest_url: MANIFEST_URL, manifest_sha256: provenance.manifest_sha256,
          archive_url: pack.url, archive_sha256: pack.sha256, member: job.member,
          file, sha256: job.image.sha256, bytes: data.length, ...info,
          requested_locale: 'en', verified_language: 'unknown', imported_at: new Date().toISOString(),
        };
        extracted++;
      }
      archives.push({ id, path: archivePath, sha256: pack.sha256, bytes: bytes.length, extracted_player_faces: members.length });
      await save();
      console.log(`Paquetes ${++finished}/${queue.length}; caras de jugador extraidas ${extracted}; ultimo ${id}`);
    } catch (e) { failures.push({ pack: id, error: e.message }); stopped = true; console.log(`Detenido ${id}: ${e.message}`); }
  }
}
await Promise.all([worker(), worker()]);
await save();
const report = { source: provenance, completed_at: new Date().toISOString(), requested, extracted, reused, unmapped: missing, failures, archives };
await write(`data/reports/community/${report.completed_at.replace(/[:.]/g, '-')}.json`, report);
await write('data/reports/community-artwork.json', report);
execFileSync(process.execPath, ['scripts/importar-biblioteca.mjs', '--solo-datos', '--offline'], { cwd: ROOT, stdio: 'inherit' });
if (failures.length) process.exitCode = 2;
