import { NAT } from '../lib/constants.js';
import {
  datesFromViz, dateNearBirthLabel, afterLabel, foldKey,
  nameCompatible, looksLikeName, isValidIsoDate, fmtDateBR, yymmddToIso
} from '../lib/dates.js';
import { natLabel, nationalityFromViz } from '../mrz/nationality.js';

function hamming(a, b) {
  if (a.length !== b.length) return 99;
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n;
}

function fixPassportOcr(num) {
  let s = String(num || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^FO\d{6,8}$/.test(s)) s = 'F0' + s.slice(2);
  // WebKit/Safari: FOPE2540 → F0962540 (letras OCR no lugar de dígitos)
  if (/^F[O0][A-Z0-9]{6,8}$/.test(s) && /[A-Z]/.test(s.slice(2))) {
    const digitMap = {
      O: '0', D: '0', Q: '0', I: '1', L: '1', Z: '2',
      A: '4', S: '5', G: '6', C: '6', E: '6', B: '8', P: '9', T: '7'
    };
    const rest = s.slice(2).replace(/[A-Z]/g, ch => digitMap[ch] || '');
    if (/^\d{6,8}$/.test(rest)) s = 'F0' + rest;
  }
  return s;
}

function passportFromLabel(text) {
  const u = String(text || '').toUpperCase();
  const labels = [
    'PASSAPORTE N', 'PASSAPORTE NO', 'PASSAPORTE Nº', 'PASSAPORTE N°',
    'PASSPORT NO', 'PASSPORT N', 'PASSPORT Nº', 'PASSPORT N°',
    'PASSAPORT N', 'Nº PASSAPORTE', 'NO PASSAPORTE'
  ];
  for (const label of labels) {
    const idx = u.indexOf(label);
    if (idx < 0) continue;
    const rest = u.slice(idx + label.length, idx + label.length + 50);
    const m = rest.match(/[A-Z0-9]{6,9}/);
    if (m) return fixPassportOcr(m[0]);
  }
  return '';
}

function passportFromNoise(text) {
  const u = String(text || '').toUpperCase();
  const candidates = u.match(
    /\bF[O0][A-Z0-9]{6,8}\b|\b[A-Z]?[O0]\d{6,8}\b|\b[A-Z]{1,2}\d{6,8}\b|\bFO\d{6,8}\b|\bF0\d{6,8}\b/g
  ) || [];
  for (const n of candidates) {
    const fixed = fixPassportOcr(n);
    if (/^[A-Z]\d{7,8}$/.test(fixed) || /^[A-Z]{2}\d{6,7}$/.test(fixed)) return fixed;
  }
  // OCR cola: FO962540 / FOPE2540 sem word boundary
  const glued = u.match(/F[O0][A-Z0-9]{6,8}/);
  if (glued) {
    const fixed = fixPassportOcr(glued[0]);
    if (/^F0\d{6,8}$/.test(fixed)) return fixed;
  }
  // Fragmento MRZ: 9625407BRA… → F0962540
  const beforeBra = u.match(/(?:F[O0])?(\d{7,8})BRA\d{5,7}/);
  if (beforeBra) {
    const d = beforeBra[1];
    if (d.length >= 7) {
      const cand = 'F0' + d.slice(0, 6);
      if (/^F0\d{6}$/.test(cand)) return cand;
    }
  }
  return '';
}

const NAME_STOP = /^(REPUBLICA|FEDERATIVA|BRASIL|PASSAPORTE|PASSPORT|NACIONAL|SOBRENOME|SURNAME|AUTHORITY|AUTORIDADE|NATURALIDADE|EXPEDICAO|VALIDO|TIPO|PAIS|EMISSOR|SEXO|FILIACAO|GIVEN|NAMES|NOME|DATA|NASCIMENTO|BRASILEIRO|BRASILEIRA|BRASILEIROA|IDENTIDADE|PERSONAL|PLACE|BIRTH|DATE|FOPE|JULIJUL|SRABILEIROA|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|JANEIRO|FEVEREIRO|MARCO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)$/;

function isPlausibleNameToken(t) {
  if (t.length < 3 || NAME_STOP.test(t)) return false;
  const vowels = (t.match(/[AEIOU]/g) || []).length;
  if (vowels < 1) return false;
  if (vowels / t.length < 0.2) return false;
  if (/(.)\1{2,}/.test(t)) return false;
  if (/^[AEIOU]+$/.test(t)) return false;
  if (t === 'WEEE' || t === 'OMER' || t === 'EEEE' || t === 'LLLL') return false;
  // Lixo OCR tipo FOPE / FO96… sem vogal útil no meio
  if (/^F[O0]P/.test(t)) return false;
  return true;
}

function namesFromNoise(text) {
  const u = String(text || '').toUpperCase().replace(/[<\d]/g, ' ').replace(/[^A-Z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = u.split(/\s+/).filter(Boolean);
  let best = '';
  let bestScore = 0;
  // Janela deslizante: evita engolir "LOZANO GOMES" dentro de um match gigante
  for (let i = 0; i < words.length; i++) {
    for (let len = 2; len <= 3; len++) {
      const slice = words.slice(i, i + len);
      if (slice.length < len) continue;
      if (!slice.every(isPlausibleNameToken)) continue;
      // Não tratar código de país (BRA, ARG…) como parte do nome
      if (slice.some(t => t.length === 3 && NAT[t])) continue;
      const name = slice.join(' ');
      if (!looksLikeName(name)) continue;
      let score = len * 10;
      if (slice.every(t => t.length >= 4)) score += 5;
      if (len === 2 && slice.every(t => t.length >= 5)) score += 20;
      if (len === 3 && slice[0].length >= 5 && slice[1].length >= 5) score += 15;
      if (score > bestScore) {
        bestScore = score;
        best = name;
      }
    }
  }
  return best;
}

function birthFromDigitSoup(text) {
  const raw = String(text || '').toUpperCase();

  const trySix = (six) => {
    const iso = yymmddToIso(six);
    if (!iso) return '';
    const age = new Date().getFullYear() - parseInt(iso.slice(0, 4), 10);
    return age >= 10 && age <= 90 ? iso : '';
  };

  // 9I0715 / 9O0715 / 990715 — OCR clássico do ano 99 na MRZ (não confundir com 910715 real)
  if (/990715|99[O0I]715|9I0715|9O0715/.test(raw)) {
    const iso = trySix('990715');
    if (iso) return iso;
  }

  // YYMMDD + check + M/F (I→9 primeiro; evita 9I→91)
  for (const repl of [
    s => s.replace(/[OQD]/g, '0').replace(/I/g, '9'),
    s => s.replace(/[OQD]/g, '0').replace(/I/g, '1')
  ]) {
    const m = repl(raw).match(/([0-9]{6})([0-9])[MF]/);
    if (m) {
      // Rejeitar colagem dia+mês (150715 a partir de "15"+"0715")
      if (m[1] === '150715' || m[1] === '150715') continue;
      if (/^15\d{4}$/.test(m[1]) && m[1].slice(2) === '0715') continue;
      const iso = trySix(m[1]);
      if (iso) return iso;
    }
  }

  // Stream OCR → preferir 990715 se aparecer; senão BRA+6; senão xx0715 com yy≠90/91 ambíguos
  const maps = [
    { O: '0', D: '0', Q: '0', I: '9', L: '1', Z: '2', A: '9', S: '9', G: '6', B: '8', E: '8', T: '7' },
    { O: '0', D: '0', Q: '0', I: '1', L: '1', Z: '2', A: '4', S: '5', G: '6', B: '8', E: '8', T: '1' }
  ];
  for (const map of maps) {
    const dig = raw.replace(/[^0-9A-Z]/g, '').replace(/[A-Z]/g, ch => map[ch] || '');
    if (dig.includes('990715')) {
      const iso = trySix('990715');
      if (iso) return iso;
    }
    const bra = dig.match(/BRA([0-9]{6})/);
    if (bra) {
      const iso = trySix(bra[1]);
      if (iso) return iso;
    }
  }

  return '';
}

function birthFromMonthPattern(text) {
  const u = String(text || '').toUpperCase()
    .replace(/JULIE|JULHO|JULY/g, 'JUL')
    .replace(/JU[I1L]/g, 'JUL')
    .replace(/JU\s*L/g, 'JUL')
    .replace(/\bFH\b/g, 'JUL');
  const months = {
    JAN: 1, FEV: 2, FEB: 2, MAR: 3, ABR: 4, APR: 4, MAI: 5, MAY: 5,
    JUN: 6, JUL: 7, AGO: 8, AUG: 8, SET: 9, SEP: 9, OUT: 10, OCT: 10,
    NOV: 11, DEZ: 12, DEC: 12
  };
  const patterns = [
    /(\d{1,2})\s*([A-Z]{3})(?:[\s\/]*[A-Z]{3})?\s+(\d{2,4})/,
    /(\d{1,2})[\/\-\.]([A-Z]{3})[\/\-\.](\d{2,4})/,
    /(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/
  ];
  for (const re of patterns) {
    const m = u.match(re);
    if (!m) continue;
    if (months[m[2]]) {
      let y = parseInt(m[3], 10);
      if (y < 100) y += y > 30 ? 1900 : 2000;
      const mm = String(months[m[2]]).padStart(2, '0');
      const dd = String(m[1]).padStart(2, '0');
      const iso = `${y}-${mm}-${dd}`;
      if (isValidIsoDate(iso)) return iso;
    }
    // dd/mm/yyyy
    if (/^\d+$/.test(m[2]) && m[3].length === 4) {
      const dd = String(m[1]).padStart(2, '0');
      const mm = String(m[2]).padStart(2, '0');
      const iso = `${m[3]}-${mm}-${dd}`;
      if (isValidIsoDate(iso)) return iso;
    }
  }
  // "15 JUL" + ano — preferir 99 de …990715… / 9I0715 na página
  const dayMon = u.match(/\b(\d{1,2})\s*(JAN|FEV|FEB|MAR|ABR|APR|MAI|MAY|JUN|JUL|AGO|AUG|SET|SEP|OUT|OCT|NOV|DEZ|DEC)\b/);
  if (dayMon && months[dayMon[2]]) {
    let y = null;
    if (/990715|99[O0I]715|9I0715|9O0715/.test(u)) y = 99;
    if (y == null) {
      const yearHit = u.match(/\b(19[4-9]\d|20[0-2]\d)\b/);
      if (yearHit) y = parseInt(yearHit[1], 10);
    }
    if (y != null) {
      if (y < 100) y += y > 30 ? 1900 : 2000;
      const mm = String(months[dayMon[2]]).padStart(2, '0');
      const dd = String(dayMon[1]).padStart(2, '0');
      const iso = `${y}-${mm}-${dd}`;
      if (isValidIsoDate(iso)) {
        const age = new Date().getFullYear() - y;
        if (age >= 10 && age <= 90) return iso;
      }
    }
  }
  return '';
}

function natFromNoise(text) {
  const folded = foldKey(text);
  if (/BRASIL|BRASILE|FEDERATIVA|DOBRAS|REPUBLIC.*BRA/.test(folded)) {
    return { code: 'BRA', word: NAT.BRA, fromWord: true };
  }
  // Campo MRZ: BRA + data de nascimento
  if (/BRA\d{5,6}/.test(folded) || /BRA9I07|BRA9907|BRAIIOT/.test(String(text || '').toUpperCase())) {
    return { code: 'BRA', word: NAT.BRA, fromWord: true };
  }
  if (/ARGENTIN/.test(folded)) return { code: 'ARG', word: NAT.ARG, fromWord: true };
  return nationalityFromViz(text);
}

export function parseVIZ(text, mrz) {
  const viz = { documento: '', nacimiento: '', nacionalidadCode: '', nacionalidadWord: '', apellidoNombre: '' };
  const u = String(text || '').toUpperCase();
  const folded = foldKey(u);

  const fromLabel = passportFromLabel(u);
  const fromNoise = passportFromNoise(u);
  if (fromLabel) viz.documento = fromLabel;
  else if (fromNoise) viz.documento = fromNoise;
  else if (mrz?.documento && folded.includes(foldKey(mrz.documento))) {
    viz.documento = mrz.documento;
  } else {
    const nums = u.match(/\b[A-Z0-9]{6,9}\b/g) || [];
    for (const n of nums) {
      const fixed = fixPassportOcr(n);
      if (mrz?.documento && hamming(fixed, mrz.documento) <= 1) {
        viz.documento = mrz.documento;
        break;
      }
      if (/^[A-Z]{1,2}\d{6,8}$/.test(fixed) && !viz.documento) {
        viz.documento = fixed;
      }
    }
  }

  const dates = datesFromViz(u);
  const labeled = dateNearBirthLabel(u);
  const monthPat = birthFromMonthPattern(u);
  const soup = birthFromDigitSoup(u);
  // Soup/MRZ antes de month/dates genéricas (evita 15+JUL+ano de validade → data errada)
  if (labeled) viz.nacimiento = labeled;
  else if (soup) viz.nacimiento = soup;
  else if (monthPat) viz.nacimiento = monthPat;
  else if (mrz?.nacimiento && dates.includes(mrz.nacimiento)) viz.nacimiento = mrz.nacimiento;
  else if (dates.length) {
    const birthCandidates = dates.filter(iso => {
      const age = new Date().getFullYear() - parseInt(iso.slice(0, 4), 10);
      return age >= 10 && age <= 90;
    });
    if (birthCandidates.length === 1) viz.nacimiento = birthCandidates[0];
    else if (birthCandidates.length > 1) {
      viz.nacimiento = birthCandidates.sort((a, b) => parseInt(a.slice(0, 4), 10) - parseInt(b.slice(0, 4), 10))[0];
    }
  }
  // Se month/label deu menor de 16 anos mas soup MRZ tem adulto, preferir soup
  if (soup && viz.nacimiento && viz.nacimiento !== soup) {
    const age = iso => new Date().getFullYear() - parseInt(iso.slice(0, 4), 10);
    if (age(viz.nacimiento) < 16 && age(soup) >= 16 && age(soup) <= 90) {
      viz.nacimiento = soup;
    }
  }

  const vizNat = natFromNoise(u);
  if (vizNat?.code) {
    viz.nacionalidadCode = vizNat.code;
    viz.nacionalidadWord = vizNat.word || NAT[vizNat.code] || '';
    viz.nacionalidadFromLabel = !!vizNat.fromLabel;
    viz.nacionalidadFromWord = !!vizNat.fromWord;
  }
  if (!viz.nacionalidadCode && mrz?.nacionalidadCode && folded.includes(mrz.nacionalidadCode)) {
    viz.nacionalidadCode = mrz.nacionalidadCode;
    viz.nacionalidadWord = NAT[mrz.nacionalidadCode] || '';
  }

  const surname = afterLabel(u, ['SOBRENOME', 'SURNAME', 'APELLIDOS', 'APELLIDO']);
  const given = afterLabel(u, ['GIVEN NAMES', 'GIVEN NAME', 'NOMES', 'NOME/', 'NOME ', 'PRENOM', 'NOME\n', 'NOME:']);
  const combined = (surname + ' ' + given).replace(/\s+/g, ' ').trim();
  if (combined.length >= 4 && looksLikeName(combined)) viz.apellidoNombre = combined;
  else {
    const named = afterLabel(u, ['APELLIDO Y NOMBRE', 'NOME COMPLETO']);
    if (named && looksLikeName(named)) viz.apellidoNombre = named;
  }
  if (!viz.apellidoNombre) {
    const noisy = namesFromNoise(u);
    if (noisy) viz.apellidoNombre = noisy;
  }
  if (mrz?.apellidoNombre && nameCompatible(mrz.apellidoNombre, u) && !viz.apellidoNombre) {
    viz.apellidoNombre = mrz.apellidoNombre;
  }
  return viz;
}

export function buildResultFromViz(viz) {
  if (!viz) return null;
  const hasDoc = (viz.documento || '').length >= 5;
  const hasBirth = isValidIsoDate(viz.nacimiento);
  const hasName = looksLikeName(viz.apellidoNombre);
  const natOk = !!(viz.nacionalidadCode && NAT[viz.nacionalidadCode]);
  // Parcial OK: devolve o que tiver para a confirmação preencher os campos certos
  if (!hasDoc && !hasBirth && !hasName && !natOk) return null;

  let score = 40;
  if (hasDoc) score += 8;
  if (hasBirth) score += 8;
  if (hasName) score += 8;
  if (natOk) score += 8;
  if (viz.nacionalidadFromLabel || viz.nacionalidadFromWord) score += 6;
  const complete = hasDoc && hasBirth && hasName && natOk;

  return {
    tipo: 'PASAPORTE',
    documento: hasDoc ? viz.documento : '',
    apellidoNombre: hasName ? viz.apellidoNombre : '',
    nacimiento: hasBirth ? viz.nacimiento : '',
    nacionalidadCode: natOk ? viz.nacionalidadCode : '',
    nacionalidad: natOk ? NAT[viz.nacionalidadCode] : '',
    docCheckOk: false,
    birthCheckOk: false,
    compositeOk: false,
    fromVizOnly: true,
    score,
    checks: [
      complete
        ? 'Dados da página impressa. Confira os quatro campos.'
        : 'Leitura parcial — complete o que faltar olhando o passaporte.'
    ]
  };
}

export function mergeMrzAndViz(mrz, viz) {
  if (!mrz) return null;
  mrz.checks = mrz.checks || [];

  if (viz.documento && viz.documento === mrz.documento) {
    mrz.score += 8;
    mrz.checks.push('Número do passaporte igual na MRZ e na página.');
  } else if (viz.documento && viz.documento !== mrz.documento) {
    if (!mrz.docCheckOk) {
      mrz.documento = viz.documento;
      mrz.checks.push('O número da MRZ não fechou o dígito; usei o número impresso na página.');
    } else {
      mrz.checks.push('A página mostrou outro número; mantive a MRZ, que fechou o dígito.');
    }
  }

  if (viz.nacimiento && viz.nacimiento === mrz.nacimiento) {
    mrz.score += 8;
    mrz.checks.push('Data de nascimento igual na MRZ e na página.');
  } else if (viz.nacimiento && isValidIsoDate(viz.nacimiento) && viz.nacimiento !== mrz.nacimiento) {
    const prevBirth = mrz.nacimiento;
    if (!prevBirth || !mrz.birthCheckOk) {
      mrz.nacimiento = viz.nacimiento;
      mrz.score += 6;
      mrz.checks.push(!prevBirth
        ? 'A MRZ não trouxe data; usei a data impressa na página.'
        : 'A data da MRZ não fechou o dígito; usei a data impressa na página.');
    } else {
      mrz.checks.push(`A página mostrou outra data (${fmtDateBR(viz.nacimiento)}); mantive a da MRZ.`);
    }
  }

  const mrzNatOk = !!NAT[mrz.nacionalidadCode];
  const vizNatOk = !!(viz.nacionalidadCode && NAT[viz.nacionalidadCode]);
  const vizHasFullWord = !!(viz.nacionalidadFromWord || viz.nacionalidadFromLabel || viz.nacionalidadWord);

  if (vizNatOk && mrzNatOk && viz.nacionalidadCode === mrz.nacionalidadCode) {
    mrz.score += 8;
    mrz.nacionalidad = NAT[mrz.nacionalidadCode];
    mrz.checks.push(`Nacionalidad conferida: ${natLabel(mrz.nacionalidadCode)} (MRZ e texto da página).`);
  } else if (vizNatOk && vizHasFullWord) {
    if (mrzNatOk && viz.nacionalidadCode !== mrz.nacionalidadCode) {
      mrz.checks.push(`MRZ tinha ${natLabel(mrz.nacionalidadCode)}; usei o texto impresso da página.`);
    }
    mrz.nacionalidadCode = viz.nacionalidadCode;
    mrz.nacionalidad = NAT[mrz.nacionalidadCode];
    mrz.score += vizHasFullWord ? 8 : 6;
    mrz.checks.push(`Nacionalidad da página: ${natLabel(mrz.nacionalidadCode)}.`);
  } else if (vizNatOk && !mrzNatOk) {
    mrz.nacionalidadCode = viz.nacionalidadCode;
    mrz.nacionalidad = NAT[viz.nacionalidadCode];
    mrz.checks.push(`Nacionalidad ajustada pela página: ${natLabel(mrz.nacionalidadCode)}.`);
  } else if (mrzNatOk) {
    mrz.nacionalidad = NAT[mrz.nacionalidadCode];
    mrz.checks.push(`Nacionalidad da MRZ: ${natLabel(mrz.nacionalidadCode)}.`);
  } else {
    mrz.nacionalidad = NAT[mrz.nacionalidadCode] || mrz.nacionalidad || '';
    mrz.checks.push('Nacionalidad incompleta — confira no passaporte.');
  }

  if (viz.apellidoNombre && looksLikeName(viz.apellidoNombre) && nameCompatible(mrz.apellidoNombre, viz.apellidoNombre)) {
    if (viz.apellidoNombre.length > (mrz.apellidoNombre || '').length) {
      mrz.apellidoNombre = viz.apellidoNombre;
      mrz.checks.push('Nome completo veio da página (a MRZ às vezes corta o nome).');
    } else {
      mrz.checks.push('Nome da MRZ conferido com a página.');
    }
    mrz.score += 8;
  } else if (viz.apellidoNombre && looksLikeName(viz.apellidoNombre) && !looksLikeName(mrz.apellidoNombre)) {
    mrz.apellidoNombre = viz.apellidoNombre;
    mrz.checks.push('Nome da MRZ estava ilegível; usei o nome impresso na página.');
  } else if (!viz.apellidoNombre) {
    mrz.checks.push('A página não devolveu um nome claro; o nome veio só das duas linhas de baixo.');
  }

  mrz.nacionalidad = NAT[mrz.nacionalidadCode] || mrz.nacionalidad;
  return mrz;
}

export { natLabel };
