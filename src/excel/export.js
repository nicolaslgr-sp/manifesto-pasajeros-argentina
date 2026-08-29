import { buildExcelAssignments } from './assignments.js';

export { buildExcelAssignments } from './assignments.js';

export function downloadBlob(data, filename, mime) {
  const blob = new Blob([data], { type: mime || 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const BASE = import.meta.env?.BASE_URL || '/';
const TEMPLATE_URL = `${BASE}template/manifesto-template.xls`;
const CACHE_NAME = 'manifesto-v1';

export async function loadTemplateBuffer() {
  try {
    const cache = await caches.open(CACHE_NAME);
    let res = await cache.match(TEMPLATE_URL);
    if (!res) {
      res = await fetch(TEMPLATE_URL);
      if (!res.ok) throw new Error('Modelo não encontrado');
      await cache.put(TEMPLATE_URL, res.clone());
    }
    return res.arrayBuffer();
  } catch {
    const res = await fetch(TEMPLATE_URL);
    if (!res.ok) throw new Error('Modelo não encontrado');
    return res.arrayBuffer();
  }
}

export async function generateExcel(state, BiffPatchExport) {
  const buf = await loadTemplateBuffer();
  const out = BiffPatchExport.patchTemplateArrayBuffer(
    new Uint8Array(buf),
    buildExcelAssignments(state)
  );
  downloadBlob(out, 'LISTA DE PASSAGEIROS PRA ARGENTINA.xls');
}
