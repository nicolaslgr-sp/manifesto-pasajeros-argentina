/**
 * Test binary BIFF patcher vs SheetJS write fidelity.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import { buildExcelAssignments } from '../src/excel/assignments.js';
import * as BiffPatchExport from '../src/excel/biff-patch-export.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const TMPL = path.join(ROOT, 'public/template/manifesto-template.xls');
const OUT = path.join(__dirname, 'test-biff-patch.xls');

const state = {
  header: {
    medio: 'AUTOMOVIL', placa: 'ABC1D23', nacion: 'BRASIL', paso: 'PTN',
    fecha: '2026-08-18', nro: '12345', hoja: 1, hojaTotal: 1,
    del: 'FOZ DO IGUACU', por: 'PUERTO IGUAZU', consignado: 'AGENCIA TESTE LTDA'
  },
  guia: { nombre: 'REGINALDO PEREIRA GOMES', documento: 'PASAPORTE BR123456', nacionalidad: 'BRASILEÑA' },
  tripulacion: [{ id: 'c1', nombre: 'JOAO SILVA', documento: 'RG 1234567' }],
  pasajeros: [
    { id: 'p1', apellidoNombre: 'SILVA SANTOS MARIA', nacimiento: '1985-03-15', nacionalidad: 'BRASILEÑA', documento: 'PASAPORTE BR987654', visa: 'sin' },
    { id: 'p2', apellidoNombre: 'OLIVEIRA COSTA JOAO', nacimiento: '1990-07-22', nacionalidad: 'BRASILEÑA', documento: 'PASAPORTE BR876543', visa: 'con' },
    { id: 'p3', apellidoNombre: 'PEREIRA LIMA ANA', nacimiento: '1978-11-08', nacionalidad: 'BRASILEÑA', documento: 'PASAPORTE BR765432', visa: 'sin' }
  ]
};

const tmplBuf = fs.readFileSync(TMPL);
const assignments = buildExcelAssignments(state);
const outBuf = Buffer.from(BiffPatchExport.patchTemplateArrayBuffer(new Uint8Array(tmplBuf), assignments));
fs.writeFileSync(OUT, outBuf);

const wb = XLSX.read(outBuf, { type: 'buffer' });
const ws = wb.Sheets['Hoja1'];
function v(r, c) {
  return ws[XLSX.utils.encode_cell({ r, c })]?.v ?? '';
}

const guiaLine = [state.guia.nombre, state.guia.documento].filter(s => s.trim()).join('  ');
const checks = [
  ['B18', v(17, 1), 'SILVA SANTOS MARIA'],
  ['C18', v(17, 2), '15/03/1985'],
  ['F19', v(18, 5), ''],
  ['G19', v(18, 6), 'X'],
  ['B53', v(52, 1), 'SILVA SANTOS MARIA'],
  ['D42', v(41, 3), 'PTN'],
  ['A13 guia', v(12, 0), guiaLine]
];

const mergeCount = (ws['!merges'] || []).length;
console.log(`Template: ${tmplBuf.length} bytes, patched: ${outBuf.length} bytes`);
console.log(`Merges: ${mergeCount}`);

if (mergeCount < 20) {
  console.log('FAIL merges: expected >= 20');
  process.exit(1);
}
if (outBuf.length < 250000) {
  console.log('FAIL size: expected >= 250KB');
  process.exit(1);
}

let failed = 0;
for (const [label, got, expected] of checks) {
  const ok = String(got) === String(expected);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${JSON.stringify(got)} expected ${JSON.stringify(expected)}`);
  if (!ok) failed++;
}
process.exit(failed ? 1 : 0);
