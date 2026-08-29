import { NAT } from '../lib/constants.js';
import {
  datesFromViz, dateNearBirthLabel, afterLabel, foldKey,
  nameCompatible, looksLikeName, isValidIsoDate, fmtDateBR
} from '../lib/dates.js';
import { natLabel, nationalityFromViz } from '../mrz/nationality.js';

function hamming(a, b) {
  if (a.length !== b.length) return 99;
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n;
}

export function parseVIZ(text, mrz) {
  const viz = { documento: '', nacimiento: '', nacionalidadCode: '', nacionalidadWord: '', apellidoNombre: '' };
  const u = String(text || '').toUpperCase();
  const folded = foldKey(u);

  if (mrz?.documento && folded.includes(foldKey(mrz.documento))) {
    viz.documento = mrz.documento;
  } else {
    const nums = u.match(/\b[A-Z0-9]{6,9}\b/g) || [];
    for (const n of nums) {
      if (mrz?.documento && hamming(n, mrz.documento) <= 1) {
        viz.documento = mrz.documento;
        break;
      }
    }
  }

  const dates = datesFromViz(u);
  const labeled = dateNearBirthLabel(u);
  if (labeled) viz.nacimiento = labeled;
  else if (mrz?.nacimiento && dates.includes(mrz.nacimiento)) viz.nacimiento = mrz.nacimiento;
  else if (dates.length) {
    for (const iso of dates) {
      const age = new Date().getFullYear() - parseInt(iso.slice(0, 4), 10);
      if (age >= 0 && age <= 100) { viz.nacimiento = iso; break; }
    }
  }

  const vizNat = nationalityFromViz(u);
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
  const given = afterLabel(u, ['GIVEN NAMES', 'GIVEN NAME', 'NOMES', 'NOME/', 'NOME ', 'PRENOM']);
  const combined = (surname + ' ' + given).replace(/\s+/g, ' ').trim();
  if (combined.length >= 4) viz.apellidoNombre = combined;
  else {
    const named = afterLabel(u, ['APELLIDO Y NOMBRE', 'NOME COMPLETO']);
    if (named) viz.apellidoNombre = named;
  }
  if (mrz?.apellidoNombre && nameCompatible(mrz.apellidoNombre, u) && !viz.apellidoNombre) {
    viz.apellidoNombre = mrz.apellidoNombre;
  }
  return viz;
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
