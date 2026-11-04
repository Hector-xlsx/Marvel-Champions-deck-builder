import { canonical } from './catalog.mjs';

const visualKey = card => JSON.stringify([card.image ?? '', card.backImage ?? '']);

/** Visible printing records, deduplicated by both card faces within one family. */
export function artworkOptions(code, cards) {
  const input = cards[code];
  if (!input) return [];
  const rootCode = canonical(input, cards), root = cards[rootCode];
  if (!root || root.role !== 'deck_card' || root.en.hidden) return [];
  const candidates = Object.values(cards).filter(card => card.role === 'deck_card' && !card.en.hidden
    && canonical(card, cards) === rootCode && (card.code === rootCode || card.image || card.backImage));
  candidates.sort((a, b) => Number(b.code === rootCode) - Number(a.code === rootCode)
    || Number(Boolean(a.imageReference)) - Number(Boolean(b.imageReference)) || a.code.localeCompare(b.code));
  const seen = new Set();
  return candidates.filter(card => {
    const key = visualKey(card);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function selectedArtwork(code, deck, cards) {
  const input = cards[code];
  if (!input) return undefined;
  const rootCode = canonical(input, cards), root = cards[rootCode];
  const preferred = cards[deck.artwork?.[rootCode]];
  if (!preferred || preferred.role !== 'deck_card' || preferred.en.hidden || canonical(preferred, cards) !== rootCode) return root;
  return artworkOptions(rootCode, cards).find(card => visualKey(card) === visualKey(preferred)) ?? root;
}

/** Expand visual variants after filtering families; selection quantities remain on the deck. */
export function galleryArtworks(filteredRoots, deck, cards, showVariants = false) {
  const families = new Set(), result = [];
  for (const card of filteredRoots) {
    const rootCode = canonical(card, cards);
    if (families.has(rootCode)) continue;
    families.add(rootCode);
    if (showVariants) result.push(...artworkOptions(rootCode, cards));
    else {
      const selected = selectedArtwork(rootCode, deck, cards);
      if (selected) result.push(selected);
    }
  }
  return result;
}
