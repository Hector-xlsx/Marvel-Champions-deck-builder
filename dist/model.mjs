import { initializeGroups, validDefaultGroupId } from './groups.mjs';
import { canonical,requiredHeroCards } from './catalog.mjs';

const PREFIX = 'marvel.deck.';
const clone = value => JSON.parse(JSON.stringify(value));
const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function createDeck(name = 'Nuevo mazo') {
  return { id: uid(), name, autoName: name.toLowerCase()==='nuevo mazo', hero: '', aspects: [], cards: {}, auxiliaries: {}, artwork: {}, groups: [], grouping: { mode: 'type', hiddenDefaults: [], preferred: {} }, notes: '', armed: false, versions: [] };
}

export function snapshot(deck) {
  const { name, autoName, hero, aspects, cards, auxiliaries = {}, artwork = {}, groups, grouping, notes, armed } = deck;
  const result = clone({ name, autoName, hero, aspects, cards, auxiliaries, artwork, groups, grouping, notes, armed });
  initializeGroups(result);
  return result;
}

export function diffCards(before = {}, after = {}) {
  const result = { added: [], removed: [] };
  for (const code of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
    const delta = (after[code] ?? 0) - (before[code] ?? 0);
    if (delta) result[delta > 0 ? 'added' : 'removed'].push({ code, quantity: Math.abs(delta) });
  }
  return result;
}

export const nextVersionNumber = deck => deck.versions.length ? `1.${deck.versions.length}` : '1';

export function addVersion(deck) {
  const current = snapshot(deck);
  const previous = deck.versions.at(-1)?.snapshot.cards ?? {};
  return { ...clone(deck), versions: [...clone(deck.versions), {
    id: uid(), label: nextVersionNumber(deck), date: new Date().toISOString(), snapshot: current,
    diff: diffCards(previous, current.cards),
  }] };
}

export class DeckStore {
  constructor(storage) { this.storage = storage; }
  load(id) {
    const raw = this.storage.getItem(PREFIX + id);
    if (raw === null) return null;
    const record = JSON.parse(raw);
    if (!Number.isSafeInteger(record.revision) || record.revision < 1 || record.deck?.id !== id) {
      throw new Error('Registro de mazo dañado.');
    }
    return record;
  }
  list() {
    const records = [];
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      try { const record = this.load(key.slice(PREFIX.length)); if (record) records.push(record); } catch { /* Preserve unreadable records. */ }
    }
    return records;
  }
  save(deck, expectedRevision = null) {
    if (typeof deck?.id !== 'string' || !deck.id) throw new Error('Mazo sin identificador.');
    const previous = this.load(deck.id);
    if (previous ? previous.revision !== expectedRevision : expectedRevision !== null) {
      throw new Error('Conflicto de revisión: vuelve a abrir el mazo antes de guardar.');
    }
    const record = { deck: clone(deck), revision: (previous?.revision ?? 0) + 1 };
    this.storage.setItem(PREFIX + deck.id, JSON.stringify(record));
    return clone(record);
  }
}

const invalid = message => { throw new Error(`Importación inválida: ${message}`); };
function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(label);
  return value;
}
function text(value, max, label, fallback = '') {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || value.length > max) invalid(label);
  return value;
}
function array(value, max, label) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max) invalid(label);
  return value;
}

/** Return sanitized, independent decks; render all returned strings as text, never HTML. */
export function validateImport(payload, cards) {
  object(payload, 'archivo');
  if (payload.format !== 'marvel-decks-v1') invalid('formato no compatible');
  if (!Array.isArray(payload.decks) || !payload.decks.length || payload.decks.length > 100) invalid('lista de mazos');
  const source = cards?.cards ?? cards;
  const known = source instanceof Set ? source : source instanceof Map ? new Set(source.keys())
    : new Set(Array.isArray(source) ? source.map(card => typeof card === 'string' ? card : card.code) : Object.keys(source ?? {}));
  const record = value => source instanceof Map ? source.get(value)
    : Array.isArray(source) ? source.find(card => card?.code === value) : source?.[value];
  const typedCards = Object.fromEntries([...known].map(key => [key, record(key)]).filter(([, value]) => value?.en && value?.links).map(([key, value]) => [key, { ...value, code: key }]));
  function code(value) {
    if (typeof value !== 'string' || !known.has(value) || ['__proto__', 'constructor', 'prototype'].includes(value)) invalid('código desconocido');
    return value;
  }
  function deckCode(value) {
    code(value);
    if (record(value)?.role && record(value).role !== 'deck_card') invalid('identidad o auxiliar entre las cartas del mazo');
    return value;
  }
  function content(raw, groupIds) {
    object(raw, 'contenido de mazo');
    const quantities = object(raw.cards, 'cartas');
    if (Object.keys(quantities).length > 3000) invalid('demasiadas cartas');
    const cleanCards = {};
    for (const [key, quantity] of Object.entries(quantities)) {
      deckCode(key);
      if (!Number.isInteger(quantity) || quantity < 0 || quantity > 99) invalid('cantidad fuera de rango');
      if (quantity) cleanCards[key] = quantity;
    }
    const auxiliaries={};
    const extra=Object.entries(object(raw.auxiliaries??{},'auxiliares'));if(extra.length>3000)invalid('demasiados auxiliares');
    for(const [key,n]of extra){code(key);const c=record(key);if(c?.role&&!['deck_card','hero_auxiliary'].includes(c.role))invalid('tipo de auxiliar');if(c?.en?.hidden)invalid('cara oculta en auxiliares');if(!Number.isInteger(n)||n<1||n>99)invalid('cantidad auxiliar fuera de rango');const root=typedCards[key]?canonical(typedCards[key],typedCards):key;auxiliaries[root]=(auxiliaries[root]||0)+n;if(auxiliaries[root]>99)invalid('demasiadas copias auxiliares');}
    for(const key of Object.keys(cleanCards)){const root=typedCards[key]?canonical(typedCards[key],typedCards):key;if(auxiliaries[root])invalid('carta simultáneamente en mazo y auxiliares');}
    const hero = text(raw.hero, 100, 'héroe');
    if (hero) {
      code(hero);
      const identity = record(hero);
      if ((identity?.role && identity.role !== 'identity') || (identity?.en?.type_code && identity.en.type_code !== 'hero')) invalid('la identidad elegida no es un héroe');
    }
    const mandatory=requiredHeroCards({hero},typedCards);for(const key of Object.keys(auxiliaries))if(mandatory[key])invalid('carta obligatoria del héroe en auxiliares');
    if (raw.armed !== undefined && typeof raw.armed !== 'boolean') invalid('estado de armado');
    if (raw.autoName !== undefined && typeof raw.autoName !== 'boolean') invalid('nombre automático');
    const artwork = {};
    const choices = Object.entries(object(raw.artwork ?? {}, 'ilustraciones preferidas'));
    if (choices.length > 3000) invalid('demasiadas ilustraciones preferidas');
    for (const [key, printing] of choices) {
      deckCode(key);
      deckCode(printing);
      if (record(printing)?.en?.hidden) invalid('la ilustración elegida pertenece a una cara oculta');
      let root = key;
      if (typedCards[key] && typedCards[printing]) {
        root = canonical(typedCards[key], typedCards);
        if (canonical(typedCards[printing], typedCards) !== root) invalid('la ilustración elegida pertenece a otra familia');
      }
      if (Object.hasOwn(artwork, root) && artwork[root] !== printing) invalid('ilustraciones contradictorias para la misma familia');
      artwork[root] = printing;
    }
    const seenIds = new Set();
    const groups = array(raw.groups, 100, 'grupos').map(group => {
      object(group, 'grupo');
      const codes = [...new Set(array(group.codes, 3000, 'cartas del grupo').map(deckCode))];
      const originalId = group.id === undefined ? uid() : text(group.id, 200, 'identificador de grupo');
      if (!originalId || originalId === 'default' || originalId === 'ungrouped' || originalId.startsWith('default:') || originalId.startsWith('reserved:') || seenIds.has(originalId)) invalid('identificador de grupo duplicado o reservado');
      seenIds.add(originalId);
      if (!groupIds.has(originalId)) groupIds.set(originalId, uid());
      if (group.hidden !== undefined && typeof group.hidden !== 'boolean') invalid('visibilidad del grupo');
      return { id: groupIds.get(originalId), name: text(group.name, 200, 'nombre del grupo'), codes, hidden: group.hidden ?? false };
    });
    let grouping;
    if (raw.grouping !== undefined) {
      object(raw.grouping, 'organización de grupos');
      const mode = raw.grouping.mode ?? 'type';
      if (!['type', 'faction', 'cost'].includes(mode)) invalid('modo de agrupación');
      const hiddenDefaults = [...new Set(array(raw.grouping.hiddenDefaults, 1000, 'grupos predeterminados ocultos').map(id => {
        if (!validDefaultGroupId(id)) invalid('identificador de grupo predeterminado');
        return id;
      }))];
      const preferred = {};
      const entries = Object.entries(object(raw.grouping.preferred ?? {}, 'grupos preferidos'));
      if (entries.length > 3000) invalid('demasiadas preferencias de grupo');
      for (const [key, target] of entries) {
        deckCode(key);
        if (target !== 'default' && (typeof target !== 'string' || !seenIds.has(target))) invalid('grupo preferido inexistente');
        if (target !== 'default' && !groups.find(group => group.id === groupIds.get(target))?.codes.includes(key)) invalid('la carta preferida no está asociada al grupo');
        preferred[key] = target === 'default' ? target : groupIds.get(target);
      }
      grouping = { mode, hiddenDefaults, preferred };
    }
    const clean = {
      name: text(raw.name, 200, 'nombre', 'Mazo importado'), hero,
      autoName: raw.autoName ?? false,
      aspects: [...new Set(array(raw.aspects, 10, 'aspectos').map(value => text(value, 100, 'aspecto')))],
      cards: cleanCards, auxiliaries, artwork,
      groups, ...(grouping ? { grouping } : {}),
      notes: text(raw.notes, 50000, 'notas'), armed: raw.armed ?? false,
    };
    initializeGroups(clean);
    return clean;
  }
  return payload.decks.map(raw => {
    object(raw, 'mazo');
    const groupIds = new Map();
    const clean = { id: uid(), ...content(raw, groupIds), versions: [] };
    let previous = {};
    clean.versions = array(raw.versions, 100, 'versiones').map(version => {
      object(version, 'versión');
      const saved = content(version.snapshot, groupIds);
      const date = text(version.date, 50, 'fecha');
      if (!date || !Number.isFinite(Date.parse(date))) invalid('fecha de versión');
      const result = { id: uid(), label: text(version.label, 200, 'etiqueta'),
        date: new Date(date).toISOString(), snapshot: saved, diff: diffCards(previous, saved.cards) };
      previous = saved.cards;
      return result;
    });
    return clean;
  });
}

