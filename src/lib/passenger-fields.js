import { NAT } from './constants.js';
import { toStoredNacimiento, isValidIsoDate } from './dates.js';

/** Contrato fixo: o que a foto deve preencher no passageiro. */
export const PASSPORT_FIELD_KEYS = [
  'apellidoNombre',
  'nacimiento',
  'nacionalidad',
  'documento'
];

/**
 * Há pelo menos um dos 4 campos utilizáveis?
 */
export function hasAnyPassportField(parsed) {
  if (!parsed) return false;
  const name = String(parsed.apellidoNombre || '').trim();
  const birth = String(parsed.nacimiento || '').trim();
  const nat = String(
    NAT[parsed.nacionalidadCode] || parsed.nacionalidad || parsed.nacionalidadCode || ''
  ).trim();
  const doc = String(parsed.documento || '').replace(/^PASAPORTE\s+/i, '').trim();
  return !!(name || birth || nat || doc);
}

/**
 * Normaliza resultado OCR → 4 campos de UI (sem prefixo PASAPORTE no doc).
 */
export function toConfirmFields(parsed) {
  if (!parsed) {
    return { apellidoNombre: '', nacimiento: '', nacionalidad: '', documento: '' };
  }
  const nac = toStoredNacimiento(parsed.nacimiento);
  return {
    apellidoNombre: String(parsed.apellidoNombre || '').trim(),
    nacimiento: isValidIsoDate(nac) ? nac : '',
    nacionalidad: NAT[parsed.nacionalidadCode] || parsed.nacionalidad || '',
    documento: String(parsed.documento || '').replace(/^PASAPORTE\s+/i, '').trim()
  };
}

/**
 * Confirmação/UI → payload do passageiro na lista e no Excel.
 */
export function toPassengerPayload(fields, { visa = 'sin' } = {}) {
  const f = fields || {};
  const docNum = String(f.documento || '').replace(/^PASAPORTE\s+/i, '').trim();
  return {
    apellidoNombre: String(f.apellidoNombre || '').trim().toUpperCase(),
    nacimiento: toStoredNacimiento(f.nacimiento) || '',
    nacionalidad: String(f.nacionalidad || '').trim().toUpperCase(),
    documento: docNum ? `PASAPORTE ${docNum}` : '',
    visa: visa === 'con' ? 'con' : 'sin'
  };
}
