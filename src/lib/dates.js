import { BIRTH_LABELS, restAfterLabel, normalizeSearch } from '../mrz/viz-labels.js';

export function isValidIsoDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const p = iso.split('-').map(Number);
  const d = new Date(p[0], p[1] - 1, p[2]);
  return d.getFullYear() === p[0] && (d.getMonth() + 1) === p[1] && d.getDate() === p[2];
}

export function normalizeBirthDigits(field) {
  const BIRTH_DIGIT_OCR = {
    O: '0', D: '0', Q: '0', U: '0',
    I: '1', L: '1', T: '1',
    Z: '2', A: '4', S: '5', G: '6', C: '6', B: '8', E: '8'
  };
  return String(field || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/[A-Z]/g, ch =>
    BIRTH_DIGIT_OCR[ch] || ch
  ).slice(0, 6);
}

export function yymmddToIso(yymmdd) {
  const raw = normalizeBirthDigits(yymmdd);
  if (!/^\d{6}$/.test(raw)) return '';
  const yy = parseInt(raw.slice(0, 2), 10);
  const mm = parseInt(raw.slice(2, 4), 10);
  const dd = parseInt(raw.slice(4, 6), 10);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return '';
  const today = new Date();
  const nowY = today.getFullYear();
  let year = 2000 + yy;
  if (year > nowY) year = 1900 + yy;
  const mmS = (mm < 10 ? '0' : '') + mm;
  const ddS = (dd < 10 ? '0' : '') + dd;
  let iso = `${year}-${mmS}-${ddS}`;
  if (!isValidIsoDate(iso)) return '';
  const born = new Date(year, mm - 1, dd);
  const endToday = new Date(nowY, today.getMonth(), today.getDate());
  if (born > endToday) {
    iso = `${year - 100}-${mmS}-${ddS}`;
    if (!isValidIsoDate(iso)) return '';
    if (new Date(year - 100, mm - 1, dd) > endToday) return '';
  }
  if (nowY - year > 120) return '';
  return iso;
}

export function toStoredNacimiento(val) {
  if (val == null || val === '') return '';
  const s = String(val).trim();
  if (isValidIsoDate(s.slice(0, 10))) return s.slice(0, 10);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const p = s.split('/');
    const iso = `${p[2]}-${p[1]}-${p[0]}`;
    return isValidIsoDate(iso) ? iso : '';
  }
  return yymmddToIso(s);
}

export function fmtDateBR(iso) {
  if (iso == null || iso === '') return '';
  let s = String(iso).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  if (/^[A-Z0-9]{6}$/i.test(s)) {
    const fromMrz = yymmddToIso(s);
    if (fromMrz) s = fromMrz;
  }
  const p = s.slice(0, 10).split('-');
  if (p.length !== 3 || p[0].length !== 4 || !p[1] || !p[2]) return s;
  return `${p[2]}/${p[1]}/${p[0]}`;
}

export function toIsoParts(dd, mm, yyyy) {
  dd = parseInt(dd, 10); mm = parseInt(mm, 10); yyyy = parseInt(yyyy, 10);
  if (yyyy < 100) yyyy = yyyy > 30 ? 1900 + yyyy : 2000 + yyyy;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yyyy < 1910 || yyyy > 2035) return '';
  const iso = `${yyyy}-${(mm < 10 ? '0' : '') + mm}-${(dd < 10 ? '0' : '') + dd}`;
  return isValidIsoDate(iso) ? iso : '';
}

export const MONTHS = {
  // EN / PT / ES / FR / DE / IT / NL / Nordic / PL / common OCR
  JAN: 1, ENE: 1, GEN: 1, STY: 1,
  FEB: 2, FEV: 2, FEBR: 2, LUT: 2,
  MAR: 3, MRT: 3, MARZ: 3,
  APR: 4, ABR: 4, AVR: 4, APRI: 4, KWI: 4,
  MAY: 5, MAI: 5, MAG: 5, MAJ: 5, MEI: 5,
  JUN: 6, GIU: 6, JUIN: 6, CZER: 6,
  JUL: 7, LUG: 7, JUIL: 7, LIP: 7,
  AUG: 8, AGO: 8, AOU: 8, AOUT: 8, SIE: 8,
  SEP: 9, SET: 9, SEPT: 9, WRZ: 9,
  OCT: 10, OUT: 10, OTT: 10, OKT: 10, PAZ: 10,
  NOV: 11, LIS: 11,
  DEC: 12, DEZ: 12, DIC: 12, DES: 12, GRU: 12
};

export function datesFromViz(text) {
  const u = String(text || '').toUpperCase();
  const out = [];
  let m, iso;
  const re1 = /(\d{1,2})\s*[\.\/\-]\s*(\d{1,2})\s*[\.\/\-]\s*(\d{2,4})/g;
  while ((m = re1.exec(u))) {
    iso = toIsoParts(m[1], m[2], m[3]);
    if (iso && !out.includes(iso)) out.push(iso);
  }
  const re2 = /(\d{1,2})[.\s\/\-]+([A-Z]{3})[.\s\/\-]+(\d{2,4})/g;
  while ((m = re2.exec(u))) {
    if (!MONTHS[m[2]]) continue;
    iso = toIsoParts(m[1], MONTHS[m[2]], m[3]);
    if (iso && !out.includes(iso)) out.push(iso);
  }
  const re2b = /(\d{1,2})\s+([A-Z]{3})\/[A-Z]{3}\s+(\d{2,4})/g;
  while ((m = re2b.exec(u))) {
    if (!MONTHS[m[2]]) continue;
    iso = toIsoParts(m[1], MONTHS[m[2]], m[3]);
    if (iso && !out.includes(iso)) out.push(iso);
  }
  const re3 = /(\d{4})\s*[\.\/\-]\s*(\d{1,2})\s*[\.\/\-]\s*(\d{1,2})/g;
  while ((m = re3.exec(u))) {
    iso = toIsoParts(m[3], m[2], m[1]);
    if (iso && !out.includes(iso)) out.push(iso);
  }
  return out;
}

export function dateNearBirthLabel(text) {
  const rest = restAfterLabel(text, BIRTH_LABELS);
  if (rest) {
    const dates = datesFromViz(rest.slice(0, 120));
    if (dates.length) return dates[0];
  }
  // fallback: rótulo embutido no bloco
  const u = normalizeSearch(text);
  for (const label of [...BIRTH_LABELS].sort((a, b) => b.length - a.length)) {
    const needle = normalizeSearch(label).trim();
    const idx = u.indexOf(needle);
    if (idx < 0) continue;
    const dates = datesFromViz(u.slice(idx, idx + 100));
    if (dates.length) return dates[0];
  }
  return '';
}

export function foldKey(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[Ñ]/g, 'N')
    .replace(/[^A-Z0-9]/g, '');
}

export function nameTokens(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z\s]/g, ' ').split(/\s+/).filter(t => t.length >= 2);
}

export function nameCompatible(mrzName, vizName) {
  const a = nameTokens(mrzName), b = nameTokens(vizName);
  if (!a.length || !b.length) return false;
  let hits = 0;
  for (const token of a) {
    const ok = b.some(t => t === token || t.startsWith(token) || token.startsWith(t) ||
      (token.length >= 4 && t.length >= 4 && token.slice(0, 4) === t.slice(0, 4)));
    if (ok) hits++;
  }
  return hits >= Math.min(2, a.length) || (hits / a.length) >= 0.6;
}

export function looksLikeName(name) {
  if (!name || name.length < 3) return false;
  if (!/[A-Z]{2,}/.test(name)) return false;
  if ((name.match(/[0-9]/g) || []).length > 0) return false;
  return (name.match(/[A-Z]/g) || []).length >= 4;
}

export function afterLabel(text, labels) {
  const rest = restAfterLabel(text, labels);
  if (!rest) return '';
  const lines = rest.split(/\n+/);
  for (let j = 0; j < Math.min(3, lines.length); j++) {
    const line = lines[j].replace(/[^A-Z0-9\u0400-\u04FF\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (line.length < 2) continue;
    if (/^(SURNAME|SOBRENOME|GIVEN|NAMES|NOME|APELLIDO|NATIONALITY|NACIONALIDADE|NACIONALIDAD|NACHNAME|PRENOM|COGNOME|VORNAME|NOMBRE|NOMBRES|FAMILY|FIRST|DATE|FECHA|DATA|PASSPORT|PASSAPORTE)/.test(line)) {
      continue;
    }
    return line;
  }
  return '';
}
