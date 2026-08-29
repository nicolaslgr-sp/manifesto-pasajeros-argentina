import { NAT } from '../lib/constants.js';
import { foldKey } from '../lib/dates.js';

export const NAT_WORDS = {
  BRASIL: 'BRA', BRAZIL: 'BRA', BRAZILIAN: 'BRA', BRASILEIRA: 'BRA', BRASILEIRO: 'BRA',
  BRASILENA: 'BRA',
  ARGENTINA: 'ARG', ARGENTINE: 'ARG', ARGENTINO: 'ARG', ARGENTINIAN: 'ARG',
  PARAGUAY: 'PRY', PARAGUAYA: 'PRY', PARAGUAYO: 'PRY', PARAGUAYAN: 'PRY',
  URUGUAY: 'URY', URUGUAYA: 'URY', URUGUAYO: 'URY', URUGUAYAN: 'URY',
  CHILE: 'CHL', CHILENA: 'CHL', CHILENO: 'CHL', CHILEAN: 'CHL',
  BOLIVIA: 'BOL', BOLIVIANA: 'BOL', BOLIVIANO: 'BOL', BOLIVIAN: 'BOL',
  PERU: 'PER', PERUANA: 'PER', PERUANO: 'PER', PERUVIAN: 'PER',
  COLOMBIA: 'COL', COLOMBIANA: 'COL', COLOMBIANO: 'COL', COLOMBIAN: 'COL',
  VENEZUELA: 'VEN', VENEZOLANA: 'VEN', VENEZOLANO: 'VEN', VENEZUELAN: 'VEN',
  ECUADOR: 'ECU', ECUATORIANA: 'ECU', ECUATORIANO: 'ECU',
  ITALIA: 'ITA', ITALY: 'ITA', ITALIANA: 'ITA', ITALIANO: 'ITA', ITALIAN: 'ITA',
  ESPANA: 'ESP', SPAIN: 'ESP', ESPANOLA: 'ESP', ESPANOL: 'ESP', SPANISH: 'ESP',
  PORTUGAL: 'PRT', PORTUGUESA: 'PRT', PORTUGUES: 'PRT', PORTUGUESE: 'PRT',
  GERMANY: 'DEU', ALEMANA: 'DEU', ALEMAN: 'DEU', ALEMANHA: 'DEU', GERMAN: 'DEU',
  FRANCE: 'FRA', FRANCESA: 'FRA', FRANCES: 'FRA', FRENCH: 'FRA',
  USA: 'USA', AMERICAN: 'USA', ESTADOUNIDENSE: 'USA', UNITEDSTATES: 'USA',
  JAPAN: 'JPN', JAPONESA: 'JPN', JAPONES: 'JPN', JAPANESE: 'JPN',
  CHINA: 'CHN', CHINESE: 'CHN',
  MEXICO: 'MEX', MEXICANA: 'MEX', MEXICANO: 'MEX', MEXICAN: 'MEX',
  CANADA: 'CAN', CANADIENSE: 'CAN', CANADIAN: 'CAN',
  BRITISH: 'GBR', BRITANICA: 'GBR', INGLESA: 'GBR', ENGLISH: 'GBR'
};

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
  const keys = Object.keys(NAT_WORDS).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (k.length < 4) continue;
    if (folded.includes(k)) {
      const code = NAT_WORDS[k];
      if (NAT[code]) return { code, word: NAT[code], matched: k, fromWord: true };
    }
  }
  if (folded.length >= 3 && NAT[folded.slice(0, 3)]) {
    const code = folded.slice(0, 3);
    return { code, word: NAT[code], matched: code, fromWord: false };
  }
  return null;
}

export function nationalityAfterLabel(text) {
  const u = String(text || '').toUpperCase();
  const labels = ['NACIONALIDADE', 'NACIONALIDAD', 'NATIONALITY', 'NATIONALITE'];
  for (const label of labels) {
    const idx = u.indexOf(label);
    if (idx < 0) continue;
    const rest = u.slice(idx + label.length).replace(/^[\s:.\-\/]+/, '');
    const lines = rest.split(/\n+/);
    let chunk = '';
    for (let j = 0; j < Math.min(3, lines.length); j++) chunk += ' ' + lines[j];
    const resolved = resolveNatPhrase(chunk.slice(0, 80));
    if (resolved) {
      resolved.fromLabel = true;
      return resolved;
    }
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
