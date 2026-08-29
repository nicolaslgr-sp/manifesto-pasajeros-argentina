import { NAT, MRZ_CHARS } from '../lib/constants.js';
import { yymmddToIso, isValidIsoDate, normalizeBirthDigits, looksLikeName } from '../lib/dates.js';

export const CONFUSION = {
  '0': ['O', 'D', 'Q'], '1': ['I', 'L', '7', 'T'], '2': ['Z'], '3': ['8', 'B'],
  '4': ['A'], '5': ['S'], '6': ['G'], '8': ['B', '3'], '9': ['G'],
  'A': ['4'], 'B': ['8', 'E', '3'], 'C': ['<', 'G'], 'D': ['0', 'O'],
  'E': ['F', 'B'], 'F': ['P', 'E'], 'G': ['6', 'C'], 'I': ['1', 'L'],
  'K': ['<', 'X'], 'L': ['1', 'I'], 'M': ['N'], 'N': ['M'],
  'O': ['0', 'D', 'Q'], 'P': ['F', 'R'], 'Q': ['0', 'O'], 'R': ['P'],
  'S': ['5'], 'T': ['1'], 'X': ['<', 'K'], 'Z': ['2'],
  '<': ['K', 'C', 'X', '|'], '|': ['<', 'I', '1']
};

const BIRTH_DIGIT_OCR = {
  O: '0', D: '0', Q: '0', U: '0', I: '1', L: '1', T: '1',
  Z: '2', A: '4', S: '5', G: '6', C: '6', B: '8', E: '8'
};

function mrzValue(ch) {
  if (ch === '<') return 0;
  if (ch >= '0' && ch <= '9') return ch.charCodeAt(0) - 48;
  if (ch >= 'A' && ch <= 'Z') return ch.charCodeAt(0) - 55;
  return 0;
}

export function mrzCheck(str, check) {
  return mrzDigit(str) === String(check);
}

export function mrzDigit(str) {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < str.length; i++) sum += mrzValue(str[i]) * weights[i % 3];
  return String(sum % 10);
}

function hamming(a, b) {
  if (a.length !== b.length) return 99;
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n;
}

export function repairNat(code) {
  code = String(code || '').toUpperCase();
  if (NAT[code]) return code;
  for (const k of Object.keys(NAT)) {
    if (hamming(k, code) === 1) return k;
  }
  for (let p = 0; p < 3; p++) {
    for (const alt of (CONFUSION[code[p]] || [])) {
      const trial = code.slice(0, p) + alt + code.slice(p + 1);
      if (NAT[trial]) return trial;
    }
  }
  return code;
}

function repairCheckedField(field, check) {
  field = String(field || '');
  check = String(check || '');
  if (mrzCheck(field, check)) return field;
  for (let i = 0; i < field.length; i++) {
    for (const alt of (CONFUSION[field[i]] || [])) {
      const trial = field.slice(0, i) + alt + field.slice(i + 1);
      if (mrzCheck(trial, check)) return trial;
    }
  }
  return field;
}

function birthFieldValid(field, check) {
  return /^\d{6}$/.test(field) && !!yymmddToIso(field) && mrzCheck(field, check);
}

function repairBirthField(field, check) {
  let digits = normalizeBirthDigits(field);
  const checkCh = String(check || '');
  let checkDigit = /[0-9]/.test(checkCh) ? checkCh : (BIRTH_DIGIT_OCR[checkCh] || checkCh);

  if (birthFieldValid(digits, checkDigit)) return digits;

  let repaired = normalizeBirthDigits(repairCheckedField(digits, checkDigit));
  if (birthFieldValid(repaired, checkDigit)) return repaired;

  if (/^\d{6}$/.test(digits) && /^\d$/.test(checkDigit)) {
    for (let i = 0; i < 6; i++) {
      for (let d = 0; d <= 9; d++) {
        const trial = digits.slice(0, i) + String(d) + digits.slice(i + 1);
        if (birthFieldValid(trial, checkDigit)) return trial;
      }
    }
  }
  return /^\d{6}$/.test(digits) ? digits : String(field || '').slice(0, 6);
}

function softenFillers(s) {
  return String(s || '').replace(/[KCX]{3,}/g, m => '<'.repeat(m.length));
}

export function sanitizeMrzOcrText(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[«»‹›〈〉|¦\\]/g, '<')
    .replace(/[\u00A0\s]+/g, '')
    .replace(/[^A-Z0-9<\n]/g, '')
    .replace(/([A-Z])I([A-Z])/g, '$1<$2')
    .replace(/([A-Z])L([A-Z])/g, '$1<$2');
}

function repairLine2Fuzzy(line2) {
  line2 = softenFillers(String(line2 || '').replace(/\s/g, '').toUpperCase().replace(/\|/g, '<'));
  if (line2.length < 38) return line2;
  line2 = (line2 + '<'.repeat(44)).slice(0, 44);
  const doc = repairCheckedField(line2.slice(0, 9), line2[9]);
  const birth = repairBirthField(line2.slice(13, 19), line2[19]);
  const expiry = repairCheckedField(line2.slice(21, 27), line2[27]);
  return doc + line2[9] + line2.slice(10, 13) + birth + line2[19] + line2[20] +
    expiry + line2.slice(27);
}

function repairLine1Fuzzy(line1) {
  line1 = softenFillers(String(line1 || '').replace(/\s/g, '').toUpperCase().replace(/\|/g, '<'));
  if (line1.length < 38) return line1;
  line1 = (line1 + '<'.repeat(44)).slice(0, 44);
  if (line1[0] !== 'P') line1 = 'P' + line1.slice(1);
  if (line1[1] === 'K' || line1[1] === 'C' || line1[1] === 'X' || line1[1] === '(') {
    line1 = 'P<' + line1.slice(2);
  } else if (line1[1] !== '<' && !/[A-Z]/.test(line1[1])) {
    line1 = 'P<' + line1.slice(2);
  }
  return line1;
}

function parseNames(field) {
  field = softenFillers(field || '');
  const bits = field.split('<<');
  const surname = (bits[0] || '').replace(/</g, ' ').replace(/\s+/g, ' ').trim();
  const given = (bits.slice(1).join(' ') || '').replace(/</g, ' ').replace(/\s+/g, ' ').trim();
  return { surname, given, full: (surname + ' ' + given).replace(/\s+/g, ' ').trim() };
}

function scoreParse(p) {
  if (!p) return 0;
  let s = 0;
  if (p.line1?.[0] === 'P') s += 8;
  if (NAT[p.issuer] || NAT[p.nacionalidadCode]) s += 12;
  if (NAT[p.nacionalidadCode]) s += 14;
  if (p.docCheckOk) s += 22;
  if (p.birthCheckOk) s += 22;
  if (p.expiryCheckOk) s += 8;
  if (p.compositeOk) s += 10;
  if (p.nacimiento && isValidIsoDate(p.nacimiento)) s += 10;
  if (looksLikeName(p.apellidoNombre)) s += 12;
  if (p.sexo === 'M' || p.sexo === 'F') s += 4;
  if ((p.documento || '').length >= 5) s += 4;
  if (p.apellidoNombre && /[0-9]/.test(p.apellidoNombre)) s -= 20;
  if (!NAT[p.nacionalidadCode]) s -= 8;
  return s;
}

export function parseTD3(line1, line2) {
  if (!line1 || !line2) return null;
  line1 = repairLine1Fuzzy(line1);
  line2 = repairLine2Fuzzy(line2);
  if (line1.length < 38 || line2.length < 38) return null;
  line1 = (line1 + '<'.repeat(44)).slice(0, 44);
  line2 = (line2 + '<'.repeat(44)).slice(0, 44);
  if (line1[0] !== 'P' && line1[0] !== 'R' && line1[0] !== 'F') return null;
  if (line1[0] !== 'P') line1 = 'P' + line1.slice(1);

  const issuer = repairNat(line1.slice(2, 5));
  const names = parseNames(line1.slice(5));
  const docField = repairCheckedField(line2.slice(0, 9), line2[9]);
  const docNum = docField.replace(/</g, '');
  const nationality = repairNat(line2.slice(10, 13));
  const birthCheckCh = line2[19];
  const birthField = repairBirthField(line2.slice(13, 19), birthCheckCh);
  const birth = yymmddToIso(birthField);
  let birthCheckOk = mrzCheck(birthField, birthCheckCh);
  if (!birthCheckOk) {
    const birthCheckDigit = /[0-9]/.test(birthCheckCh) ? birthCheckCh : (BIRTH_DIGIT_OCR[birthCheckCh] || birthCheckCh);
    birthCheckOk = mrzCheck(birthField, birthCheckDigit);
  }
  let sex = line2[20];
  if (sex !== 'M' && sex !== 'F' && sex !== '<') {
    if (sex === 'H' || sex === 'N') sex = 'M';
    else if (sex === 'E' || sex === 'P') sex = 'F';
  }
  const expiryField = repairCheckedField(line2.slice(21, 27), line2[27]);
  const optional = line2.slice(28, 43);
  const compositeSrc = docField + line2[9] + birthField + line2[19] + expiryField + line2[27] + optional;
  const compositeOk = mrzCheck(compositeSrc, line2[43]);

  const parsed = {
    tipo: 'PASAPORTE',
    documento: docNum,
    apellidoNombre: names.full,
    apellido: names.surname,
    nombre: names.given,
    nacionalidad: NAT[nationality] || nationality,
    nacionalidadCode: nationality,
    issuer,
    nacimiento: birth,
    sexo: sex === 'F' ? 'F' : (sex === 'M' ? 'M' : ''),
    docCheckOk: mrzCheck(docField, line2[9]),
    birthCheckOk,
    expiryCheckOk: mrzCheck(expiryField, line2[27]),
    compositeOk,
    line1,
    line2,
    checks: []
  };
  parsed.score = scoreParse(parsed);
  return parsed;
}

export function collectTd3Candidates(raw) {
  const text = sanitizeMrzOcrText(raw);
  const lines = text.split(/\n+/).map(l => l.replace(/[^A-Z0-9<]/g, '')).filter(l => l.length >= 20);
  const blob = text.replace(/\n/g, '');
  const seen = {};

  function add(p) {
    if (!p || !p.apellidoNombre) return;
    const key = `${p.documento}|${p.apellidoNombre}|${p.nacimiento}`;
    if (seen[key] && seen[key].score >= p.score) return;
    seen[key] = p;
  }

  for (let i = 0; i < lines.length; i++) {
    if (lines[i + 1]) add(parseTD3(lines[i], lines[i + 1]));
  }
  for (let idx = 0; idx < blob.length - 87; idx++) {
    const ch = blob[idx];
    if (ch !== 'P' && ch !== 'R' && ch !== 'F') continue;
    add(parseTD3(blob.substr(idx, 44), blob.substr(idx + 44, 44)));
  }
  return Object.values(seen).sort((a, b) => b.score - a.score);
}

export function extractMRZFromText(raw) {
  const list = collectTd3Candidates(raw);
  return list.length ? list[0] : null;
}

export function pickBestMrz(pool) {
  let best = null;
  for (const c of pool) {
    if (!c) continue;
    if (!best) { best = c; continue; }
    if (c.compositeOk && !best.compositeOk) { best = c; continue; }
    if (c.docCheckOk && c.birthCheckOk && !(best.docCheckOk && best.birthCheckOk)) { best = c; continue; }
    if (c.score > best.score) best = c;
  }
  return best;
}

export function isAutoApplyReady(parsed) {
  if (!parsed) return false;
  return parsed.docCheckOk && parsed.birthCheckOk &&
    isValidIsoDate(parsed.nacimiento) &&
    parsed.score >= 70 && looksLikeName(parsed.apellidoNombre) &&
    (parsed.documento || '').length >= 5 && !!NAT[parsed.nacionalidadCode];
}

export { MRZ_CHARS };
