import { factions, types, normalize } from './catalog.mjs';
import {AUXILIARY_GROUP,auxiliaryCards,moveAuxiliary} from './auxiliaries.mjs';

const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const nameKey = value => normalize(value).trim().replace(/\s+/g, ' ');
const typeLabels = { ally: 'Aliados', event: 'Eventos', support: 'Apoyos', upgrade: 'Mejoras', resource: 'Recursos', player_side_scheme: 'Planes secundarios' };
const reserved = new Set([
  ...Object.values(types), ...Object.values(typeLabels), ...Object.values(factions),
  'Básico', 'Básicos', 'Básicas', 'Héroes', 'Mazo héroe', 'Mazos héroe', 'Mazos héroes',
  'Auxiliar','Auxiliares','Sin grupo', 'Sin grupos', 'Sin coste', 'Sin costes', 'Coste X', 'X / variable', 'Sin tipo', 'Sin aspecto',
].map(nameKey));

export function reservedGroupName(name) {
  const key = nameKey(name);
  if (reserved.has(key)) return true;
  const match = /^coste\s+([+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?)$/.exec(key);
  return Boolean(match && Number.isFinite(Number(match[1].replace(',', '.'))));
}

/** Upgrade a draft in place. Historic snapshots remain untouched. */
export function initializeGroups(deck) {
  const before = JSON.stringify({ groups: deck.groups, grouping: deck.grouping });
  deck.groups ??= [];
  const legacy = !deck.grouping;
  deck.grouping ??= { mode: 'type', hiddenDefaults: [], preferred: {} };
  if (!['type', 'faction', 'cost'].includes(deck.grouping.mode)) deck.grouping.mode = 'type';
  deck.grouping.hiddenDefaults ??= [];
  deck.grouping.preferred ??= {};
  const occupied = new Set();
  for (const group of deck.groups) {
    group.id ??= uid();
    group.codes ??= [];
    group.hidden ??= false;
    const original = String(group.name ?? '').trim() || 'Grupo';
    let candidate = original;
    if (reservedGroupName(candidate) || occupied.has(nameKey(candidate))) {
      const base = original.slice(0, 175) + ' (personalizado)';
      candidate = base;
      let number = 2;
      while (reservedGroupName(candidate) || occupied.has(nameKey(candidate))) candidate = `${base} (${number++})`;
    }
    group.name = candidate;
    occupied.add(nameKey(candidate));
    if (legacy) for (const code of group.codes) {
      if (!Object.hasOwn(deck.grouping.preferred, code)) deck.grouping.preferred[code] = group.id;
    }
  }
  return before !== JSON.stringify({ groups: deck.groups, grouping: deck.grouping });
}

export function addCustomGroup(deck, name) {
  if (typeof name !== 'string' || !name.trim()) throw new Error('Escribe un nombre para el grupo.');
  const clean = name.trim();
  if (clean.length > 200) throw new Error('El nombre del grupo no puede superar 200 caracteres.');
  if (reservedGroupName(clean)) throw new Error('Ese nombre está reservado para un grupo predeterminado.');
  if ((deck.groups ?? []).some(group => nameKey(group.name) === nameKey(clean))) throw new Error('Ya existe un grupo con ese nombre.');
  if ((deck.groups?.length ?? 0) >= 100) throw new Error('Se alcanzó el límite de 100 grupos personalizados.');
  initializeGroups(deck);
  const group = { id: uid(), name: clean, codes: [], hidden: false };
  deck.groups.push(group);
  return group;
}

export function defaultGroup(card, mode = 'type') {
  const data = card?.en ?? {};
  if (mode === 'faction') {
    const code = Object.hasOwn(factions, data.faction_code) ? data.faction_code : 'unknown';
    return { id: `default:faction:${code}`, label: code === 'hero' ? 'Mazo héroe' : factions[code] ?? 'Sin aspecto' };
  }
  if (mode === 'cost') {
    const cost = data.cost;
    const code = typeof cost !== 'number' || !Number.isFinite(cost) ? 'unknown' : cost === -1 ? 'x' : String(cost);
    return { id: `default:cost:${code}`, label: code === 'unknown' ? 'Sin coste' : code === 'x' ? 'Coste X' : `Coste ${cost}` };
  }
  const code = Object.hasOwn(typeLabels, data.type_code) ? data.type_code : 'unknown';
  return { id: `default:type:${code}`, label: typeLabels[code] ?? 'Sin tipo' };
}

export function listDeckGroups(deck, cards) {
  const mode = deck.grouping?.mode ?? 'type';
  const hidden = new Set(deck.grouping?.hiddenDefaults ?? []);
  const preferred = deck.grouping?.preferred ?? {};
  const defaults = new Map();
  const codes = Object.keys(deck.cards).filter(code => deck.cards[code] > 0);
  for (const code of codes) {
    const group = defaultGroup(cards[code], mode);
    if (!hidden.has(group.id) && !defaults.has(group.id)) defaults.set(group.id, { ...group, kind: 'default', codes: [] });
  }
  const customs = (deck.groups ?? []).filter(group => !group.hidden).map(group => ({ id: group.id, label: group.name, kind: 'custom', codes: [] }));
  const customById = new Map(customs.map(group => [group.id, group]));
  const ungrouped = { id: 'ungrouped', label: 'Sin grupo', kind: 'ungrouped', codes: [] };
  for (const code of codes) {
    const natural = defaultGroup(cards[code], mode);
    const target = customById.get(preferred[code]) ?? defaults.get(natural.id) ?? ungrouped;
    target.codes.push(code);
  }
  const order = mode === 'faction' ? Object.keys(factions) : Object.keys(types);
  const sortedDefaults = [...defaults.values()].sort((a, b) => {
    if (mode === 'cost') {
      const rank = id => id.endsWith(':unknown') ? Infinity : id.endsWith(':x') ? -1 : Number(id.split(':').at(-1));
      return rank(a.id) - rank(b.id);
    }
    const rank = id => { const n = order.indexOf(id.split(':').at(-1)); return n < 0 ? order.length : n; };
    return rank(a.id) - rank(b.id);
  });
  const aux=Object.keys(auxiliaryCards(deck,cards));
  return [...sortedDefaults, ...customs, ...(ungrouped.codes.length ? [ungrouped] : []),...(aux.length?[{id:AUXILIARY_GROUP,label:'Auxiliares',kind:'auxiliary',codes:aux}]:[])];
}

export function moveToGroup(deck, code, targetId, cards) {
  if(targetId===AUXILIARY_GROUP){moveAuxiliary(deck,code,true,cards);return;}
  if(deck.auxiliaries?.[code]){
    const group=(deck.groups||[]).find(g=>g.id===targetId&&!g.hidden),natural=defaultGroup(cards[code],deck.grouping?.mode||'type');
    if(!group&&(targetId!==natural.id||deck.grouping?.hiddenDefaults?.includes(targetId)))throw Error('Destino de grupo no válido.');
    moveAuxiliary(deck,code,false,cards);
  }
  if (!cards[code] || !(deck.cards[code] > 0)) throw new Error('La carta no está en el mazo.');
  const group = (deck.groups ?? []).find(value => value.id === targetId);
  if (group) {
    if (group.hidden) throw new Error('Restaura el grupo antes de mover cartas a él.');
  } else {
    const natural = defaultGroup(cards[code], deck.grouping?.mode ?? 'type');
    if (targetId !== natural.id || deck.grouping?.hiddenDefaults?.includes(targetId)) throw new Error('Solo puedes devolver la carta a su grupo predeterminado visible.');
  }
  initializeGroups(deck);
  if (group) {
    if (!group.codes.includes(code)) group.codes.push(code);
    deck.grouping.preferred[code] = targetId;
  } else deck.grouping.preferred[code] = 'default';
}

export function hideGroup(deck, id) {
  const group = (deck.groups ?? []).find(value => value.id === id);
  if (!group && !validDefaultGroupId(id)) throw new Error('El grupo no existe.');
  initializeGroups(deck);
  if (group) group.hidden = true;
  else if (!deck.grouping.hiddenDefaults.includes(id)) deck.grouping.hiddenDefaults.push(id);
}

export function restoreGroup(deck, id) {
  const group = (deck.groups ?? []).find(value => value.id === id);
  if (!group && !validDefaultGroupId(id)) throw new Error('El grupo no existe.');
  initializeGroups(deck);
  if (group) group.hidden = false;
  else deck.grouping.hiddenDefaults = deck.grouping.hiddenDefaults.filter(value => value !== id);
}

export function deleteCustomGroup(deck, id) {
  if (!(deck.groups ?? []).some(group => group.id === id)) throw new Error('El grupo personalizado no existe.');
  initializeGroups(deck);
  deck.groups = deck.groups.filter(group => group.id !== id);
  for (const code of Object.keys(deck.grouping.preferred)) if (deck.grouping.preferred[code] === id) deck.grouping.preferred[code] = 'default';
}

export function clearCustomGroup(deck, id) {
  const group = (deck.groups ?? []).find(group => group.id === id);
  if (!group) throw new Error('El grupo personalizado no existe.');
  initializeGroups(deck);
  group.codes = [];
  for (const code of Object.keys(deck.grouping.preferred)) if (deck.grouping.preferred[code] === id) deck.grouping.preferred[code] = 'default';
}

/** Used by backup validation; default ids never refer to custom groups. */
export function validDefaultGroupId(id) {
  if (typeof id !== 'string' || id.length > 100) return false;
  if (id === 'default:type:unknown' || id === 'default:faction:unknown') return true;
  if (Object.keys(types).some(code => id === `default:type:${code}`)) return true;
  if (Object.keys(factions).some(code => id === `default:faction:${code}`)) return true;
  if (id === 'default:cost:unknown' || id === 'default:cost:x') return true;
  const value = id.startsWith('default:cost:') ? id.slice('default:cost:'.length) : '';
  return value !== '' && Number.isFinite(Number(value)) && String(Number(value)) === value;
}
