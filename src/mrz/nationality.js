import { NAT } from '../lib/constants.js';
import { foldKey } from '../lib/dates.js';
import { NATIONALITY_LABELS, restAfterLabel, normalizeSearch } from './viz-labels.js';
import { buildNatWords } from './nat-lexicon.js';

/**
 * Palavras de nacionalidade / país (vários idiomas) → código ICAO.
 * Saída no manifesto é sempre a forma em espanhol de NAT[code].
 */
export const NAT_WORDS = buildNatWords();

// Forma espanhola do manifesto também resolve (BRASILEÑA → BRA, etc.)
for (const code of Object.keys(NAT)) {
  const folded = foldKey(NAT[code]);
  if (folded && folded.length >= 4 && !NAT_WORDS[folded]) NAT_WORDS[folded] = code;
}

export function natLabel(code, word) {
  const c = String(code || '').toUpperCase();
  const w = word || NAT[c] || '';
  if (c && w && w !== c) return `${c} · ${w}`;
  return w || c || '';
}

export function resolveNatPhrase(phrase) {
  const folded = foldKey(phrase);
  if (!folded) return null;
  // Código ICAO isolado (ex.: "BRA") — nunca substring (SUR em SURNAME)
  if (folded.length === 3 && NAT[folded]) {
    return { code: folded, word: NAT[folded], matched: folded, fromWord: false };
  }
  const keys = Object.keys(NAT_WORDS).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (k.length < 4) continue;
    if (folded.includes(k)) {
      const code = NAT_WORDS[k];
      if (NAT[code]) return { code, word: NAT[code], matched: k, fromWord: true };
    }
  }
  return null;
}

export function nationalityAfterLabel(text) {
  const rest = restAfterLabel(text, NATIONALITY_LABELS);
  if (!rest) return null;
  // primeiras linhas / tokens após o rótulo
  const chunk = rest.split(/\n+/).slice(0, 3).join(' ').slice(0, 120);
  const resolved = resolveNatPhrase(chunk);
  if (resolved) {
    resolved.fromLabel = true;
    return resolved;
  }
  // código ICAO isolado (BRA, USA…)
  const m = normalizeSearch(chunk).match(/\b([A-Z]{3})\b/);
  if (m && NAT[m[1]]) {
    return { code: m[1], word: NAT[m[1]], matched: m[1], fromWord: false, fromLabel: true };
  }
  return null;
}

export function nationalityFromViz(text) {
  const labeled = nationalityAfterLabel(text);
  if (labeled) return labeled;
  const keys = Object.keys(NAT_WORDS).sort((a, b) => b.length - a.length);
  const folded = foldKey(text);
  for (const k of keys) {
    if (k.length < 5) continue;
    if (folded.includes(k)) {
      const code = NAT_WORDS[k];
      if (NAT[code]) return { code, word: NAT[code], matched: k, fromWord: true, fromLabel: false };
    }
  }
  return null;
}
