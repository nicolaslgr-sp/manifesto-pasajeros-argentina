import {
  PAX_ROWS_ENTRADA, PAX_ROWS_SALIDA, crewCount, filledPax
} from '../lib/constants.js';
import { fmtDateBR } from '../lib/dates.js';

function guiaDocLine(state) {
  const g = state.guia;
  return [g.nombre || '', g.documento || ''].filter(s => s.trim()).join('  ');
}

function tripDocLine(state) {
  const t = state.tripulacion[0] || {};
  return [t.nombre || '', t.documento || ''].filter(s => s.trim()).join('  ');
}

function paxNumLabel(kind, i) {
  if (kind === 'ENTRADA' && i === 0) return '1. ';
  return `${i + 1}.`;
}

function setAssign(assignments, row, col, val) {
  if (val === '' || val == null) return;
  assignments[`${row},${col}`] = String(val);
}

export function buildExcelAssignments(state) {
  const h = state.header;
  const pax = filledPax(state);
  const a = {};
  const tripN = crewCount(state);
  const fecha = fmtDateBR(h.fecha);
  const hn = h.hoja || 1;
  const ht = h.hojaTotal || 1;

  function block(R, sal, slice) {
    setAssign(a, R.hoja, 0, `HOJA Nº: ${hn}         / ${ht}`);
    setAssign(a, R.nro, 5, `Nº DE MANIFIESTO: ${h.nro || ''}`);
    setAssign(a, R.del, 0, `DEL: ${h.del || ''}`);
    setAssign(a, R.placa, 3, `PLACA : ${(h.placa || '').toUpperCase()}`);
    if (sal) {
      setAssign(a, R.medio, 0, `Medio de Transporte: ${h.medio || ''}`);
      setAssign(a, R.nacion, 3, `Nación:  ${h.nacion || ''}`);
      setAssign(a, R.fecha, 0, `Con FECHA: ${fecha}`);
      setAssign(a, R.paxcount, 4, `PASSAGEIROS:${pax.length}`);
      setAssign(a, R.pasoV, 3, h.paso || '');
    } else {
      setAssign(a, R.medio, 0, `Medio de Transporte:${h.medio || ''}`);
      setAssign(a, R.nacion, 3, `Nación: ${h.nacion || ''}`);
      setAssign(a, R.fecha, 0, `Con FECHA ${fecha}`);
      setAssign(a, R.paxcount, 4, `PASSAGEIROS: ${pax.length}`);
    }
    setAssign(a, R.por, 2, `Por: ${h.por || ''}`);
    setAssign(a, R.pasoL, 2, 'Paso fronterizo');
    setAssign(a, R.trip, 4, `TRIPULANTE: ${tripN}`);
    setAssign(a, R.consignado, 0, `CONSIGNADO A: ${h.consignado || ''}`);
    setAssign(a, R.guia, 0, guiaDocLine(state));
    setAssign(a, R.tripul, 2, tripDocLine(state));
    for (let i = 0; i < R.paxRows; i++) {
      const row = R.paxStart + i;
      const p = slice[i];
      setAssign(a, row, 0, paxNumLabel(sal ? 'SALIDA' : 'ENTRADA', i));
      if (!p) continue;
      setAssign(a, row, 1, p.apellidoNombre || '');
      setAssign(a, row, 2, fmtDateBR(p.nacimiento));
      setAssign(a, row, 3, p.nacionalidad || '');
      setAssign(a, row, 4, p.documento || '');
      setAssign(a, row, 5, p.visa !== 'con' ? 'X' : '');
      setAssign(a, row, 6, p.visa === 'con' ? 'X' : '');
    }
  }

  block({
    hoja: 1, nro: 3, del: 4, placa: 4, medio: 5, nacion: 5, fecha: 6, por: 6, paxcount: 6,
    pasoL: 7, trip: 7, consignado: 8, guia: 12, tripul: 12, paxStart: 17, paxRows: PAX_ROWS_ENTRADA
  }, false, pax.slice(0, PAX_ROWS_ENTRADA));

  block({
    hoja: 35, nro: 37, del: 38, placa: 38, medio: 39, nacion: 39, fecha: 40, por: 40, paxcount: 40,
    pasoL: 41, pasoV: 41, trip: 41, consignado: 42, guia: 46, tripul: 46, paxStart: 52, paxRows: PAX_ROWS_SALIDA
  }, true, pax.slice(0, PAX_ROWS_SALIDA));

  return a;
}
