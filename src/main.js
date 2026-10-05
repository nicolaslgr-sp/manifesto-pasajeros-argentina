import {
  defaultState, loadState, saveState, uid, escapeHtml,
  GUIDE_NAME, PAX_MAX_TOTAL, NAT, crewCount, filledPax
} from './lib/constants.js';
import { isGarbageName } from './mrz/parse.js';
import { loadStaticImage } from './ocr/static-image-loader.js';
import { readPassportFromStaticImage, readMrzFromText } from './ocr/static-pipeline.js';
import {
  hasAnyPassportField, toConfirmFields, toPassengerPayload
} from './lib/passenger-fields.js';
import { generateExcel } from './excel/export.js';
import * as BiffPatchExport from './excel/biff-patch-export.js';

const state = loadState() || defaultState();
let scanTargetId = null;
let pendingParsed = null;
let ocrBusy = false;

const $ = id => document.getElementById(id);

function bindHeader() {
  const map = {
    'f-medio': 'medio', 'f-placa': 'placa', 'f-nacion': 'nacion',
    'f-paso': 'paso', 'f-fecha': 'fecha', 'f-nro': 'nro',
    'f-hoja': 'hoja', 'f-hoja-total': 'hojaTotal',
    'f-del': 'del', 'f-por': 'por', 'f-consignado': 'consignado'
  };
  for (const [id, key] of Object.entries(map)) {
    const el = $(id);
    el.value = state.header[key] ?? '';
    el.addEventListener('input', () => {
      state.header[key] = el.value;
      saveState(state);
    });
  }
  $('g-nombre').value = state.guia.nombre || GUIDE_NAME;
  $('g-doc').value = state.guia.documento || '';
  $('g-nac').value = state.guia.nacionalidad || '';
  for (const id of ['g-nombre', 'g-doc', 'g-nac']) {
    $(id).addEventListener('input', () => {
      state.guia.nombre = $('g-nombre').value;
      state.guia.documento = $('g-doc').value;
      state.guia.nacionalidad = $('g-nac').value;
      saveState(state);
    });
  }
}

function renderCrew() {
  $('crew-list').innerHTML = state.tripulacion.map((c, idx) =>
    `<div class="rounded-xl border border-slate-200 p-3 space-y-2">
      <div class="flex justify-between items-center">
        <p class="text-[11px] font-semibold uppercase text-slate-500">Tripulante ${idx + 1}</p>
        <button type="button" data-del-crew="${c.id}" class="text-xs text-red-600">Remover</button>
      </div>
      <input data-crew="${c.id}" data-field="nombre" class="w-full rounded-xl border px-3 py-2" placeholder="Apellido y Nombre" value="${escapeHtml(c.nombre)}" />
      <input data-crew="${c.id}" data-field="documento" class="w-full rounded-xl border px-3 py-2" placeholder="Tipo y Nº de documento" value="${escapeHtml(c.documento)}" />
    </div>`
  ).join('');
}

function renderPax() {
  const filled = filledPax(state).length;
  $('pax-count').textContent = `${state.pasajeros.length} na lista · ${crewCount(state)} tripulante(s) · ${filled}/${PAX_MAX_TOTAL} com nome`;
  const root = $('pax-list');
  if (!state.pasajeros.length) {
    root.innerHTML = '<p class="text-sm text-slate-500 text-center py-6">Nenhum passageiro ainda. Use Galeria / Foto ou adicione manualmente.</p>';
    return;
  }
  root.innerHTML = state.pasajeros.map((p, i) =>
    `<article class="bg-white rounded-2xl p-4 border border-slate-200 space-y-2">
      <div class="flex items-center justify-between">
        <p class="text-xs font-semibold text-navy-700">Passageiro ${i + 1}</p>
        <div class="flex gap-2">
          <button type="button" class="text-xs font-semibold text-navy-700" data-rescan="${p.id}">Reler foto</button>
          <button type="button" class="text-xs text-red-600" data-del="${p.id}">Remover</button>
        </div>
      </div>
      <label class="text-xs font-medium block">Apellido y Nombre
        <input data-pax="${p.id}" data-field="apellidoNombre" class="mt-1 w-full rounded-xl border px-3 py-2" value="${escapeHtml(p.apellidoNombre)}" /></label>
      <div class="grid grid-cols-2 gap-2">
        <label class="text-xs font-medium">Fecha de nacimiento
          <input type="date" data-pax="${p.id}" data-field="nacimiento" class="mt-1 w-full rounded-xl border px-3 py-2" value="${escapeHtml(p.nacimiento)}" /></label>
        <label class="text-xs font-medium">Nacionalidad
          <input data-pax="${p.id}" data-field="nacionalidad" class="mt-1 w-full rounded-xl border px-3 py-2" value="${escapeHtml(p.nacionalidad)}" /></label>
      </div>
      <label class="text-xs font-medium block">Tipo y Nº de documento
        <input data-pax="${p.id}" data-field="documento" class="mt-1 w-full rounded-xl border px-3 py-2" value="${escapeHtml(p.documento)}" /></label>
      <label class="text-xs font-medium">Calificación migratoria
        <select data-pax="${p.id}" data-field="visa" class="mt-1 w-full rounded-xl border px-3 py-2 bg-white">
          <option value="sin"${p.visa !== 'con' ? ' selected' : ''}>Sin Visa</option>
          <option value="con"${p.visa === 'con' ? ' selected' : ''}>Con Visa</option>
        </select></label>
    </article>`
  ).join('');
}

function setScanStatus(msg) {
  const el = $('scan-status');
  if (el) el.textContent = msg;
}

function setScanBusy(on) {
  ocrBusy = on;
  const btn = $('scan-gallery');
  if (btn) {
    btn.disabled = on;
    btn.style.opacity = on ? '0.55' : '1';
  }
}

function setPanelVisible(id, visible) {
  const el = $(id);
  if (!el) return;
  el.hidden = !visible;
  el.classList.toggle('hidden', !visible);
}

function scanErrorMessage(err) {
  const msg = String(err?.message || err || '');
  if (/timeout|não carregou/i.test(msg)) {
    return msg;
  }
  if (/tesseract|worker|wasm|network|fetch|Failed to fetch|CDN/i.test(msg)) {
    return 'Motor OCR não carregou (rede ou bloqueio). Abra no Chrome/Safari do sistema, recarregue e tente de novo.';
  }
  if (/heic|heif/i.test(msg)) {
    return msg.includes('JPEG') ? msg : 'Não consegui converter a foto HEIC. Tente JPEG ou PNG.';
  }
  return msg || 'Falha ao ler a foto.';
}

function openScanPanel(targetId = null) {
  scanTargetId = targetId;
  setPanelVisible('scan-panel', true);
  setPanelVisible('scan-confirm', false);
  pendingParsed = null;
  setScanStatus('Escolha a foto inteira da página do passaporte. Os 4 campos serão preenchidos para você conferir.');
}

function closeScanPanel() {
  setPanelVisible('scan-panel', false);
  setPanelVisible('scan-confirm', false);
  pendingParsed = null;
  setScanBusy(false);
}

function showConfirm(parsed) {
  const cleaned = { ...parsed };
  if (isGarbageName(cleaned.apellidoNombre)) {
    cleaned.apellidoNombre = '';
    cleaned.checks = [
      ...(cleaned.checks || []),
      'Nome não confiado — digite olhando o passaporte.'
    ];
  }

  const fields = toConfirmFields(cleaned);
  pendingParsed = { ...cleaned, ...fields };

  $('cf-nombre').value = fields.apellidoNombre;
  $('cf-nacim').value = fields.nacimiento;
  $('cf-nacio').value = fields.nacionalidad;
  $('cf-doc').value = fields.documento;
  $('cf-raw').textContent = `${cleaned.line1 || ''}\n${cleaned.line2 || ''}`;

  const checks = [...(cleaned.checks || [])];
  if (!fields.apellidoNombre) checks.unshift('Preencha o nome.');
  if (!fields.nacimiento) checks.unshift('Preencha a data de nascimento.');
  if (!fields.nacionalidad) checks.unshift('Preencha a nacionalidad.');
  if (!fields.documento) checks.unshift('Preencha o nº do passaporte.');
  $('cf-note').textContent = checks.join(' ');

  setPanelVisible('scan-confirm', true);
  const filled = [fields.apellidoNombre, fields.nacimiento, fields.nacionalidad, fields.documento]
    .filter(Boolean).length;
  setScanStatus(`Confira os campos (${filled}/4 lidos da foto).`);
}

function applyFromConfirm() {
  const fields = {
    apellidoNombre: $('cf-nombre').value,
    nacimiento: $('cf-nacim').value,
    nacionalidad: $('cf-nacio').value,
    documento: $('cf-doc').value
  };
  const payload = toPassengerPayload(fields);
  if (!payload.apellidoNombre && !payload.documento) {
    setScanStatus('Informe pelo menos nome ou número do passaporte.');
    return;
  }
  if (scanTargetId) {
    const found = state.pasajeros.find(p => p.id === scanTargetId);
    if (found) {
      if (!payload.nacimiento && found.nacimiento) delete payload.nacimiento;
      Object.assign(found, payload);
    }
  } else {
    if (filledPax(state).length >= PAX_MAX_TOTAL) {
      alert(`Limite de ${PAX_MAX_TOTAL} passageiros (6 ENTRADA + 5 SALIDA).`);
      return;
    }
    payload.id = uid();
    state.pasajeros.push(payload);
  }
  saveState(state);
  renderPax();
  closeScanPanel();
}

/** Sempre abre confirmação com os 4 campos — nunca aplica em silêncio. */
function finishScanResult(result) {
  if (!result || !hasAnyPassportField(result)) {
    setScanStatus(
      'Não consegui ler os dados. Tire outra foto da página inteira (boa luz) ou preencha manualmente abaixo.'
    );
    return;
  }
  showConfirm(result);
}

async function processGalleryFile(file) {
  if (ocrBusy || !file) return;
  setScanBusy(true);
  setScanStatus('Carregando foto…');
  try {
    const frame = await loadStaticImage(file);
    setScanStatus('Processando foto (no celular ~20–40s; no Chrome desktop pode ser mais rápido)…');
    const result = await readPassportFromStaticImage(frame, setScanStatus);
    finishScanResult(result);
  } catch (e) {
    console.error('OCR gallery error:', e);
    setScanStatus(scanErrorMessage(e));
  } finally {
    setScanBusy(false);
  }
}

async function applyManualMrz() {
  const raw = $('scan-manual').value.trim();
  if (!raw) return;
  setScanBusy(true);
  try {
    const result = await readMrzFromText(raw);
    if (result) {
      result.nacionalidad = NAT[result.nacionalidadCode] || result.nacionalidad || '';
      finishScanResult(result);
    } else {
      setScanStatus('MRZ inválida. Cole as duas linhas completas.');
    }
  } finally {
    setScanBusy(false);
  }
}

function bindEvents() {
  $('btn-add-crew').onclick = () => {
    state.tripulacion.push({ id: uid(), nombre: '', documento: '' });
    saveState(state);
    renderCrew();
  };

  $('btn-add-pax').onclick = () => {
    if (filledPax(state).length >= PAX_MAX_TOTAL) {
      alert(`Limite de ${PAX_MAX_TOTAL} passageiros.`);
      return;
    }
    state.pasajeros.push({
      id: uid(), apellidoNombre: '', nacimiento: '', nacionalidad: 'BRASILEÑA',
      documento: '', visa: 'sin'
    });
    saveState(state);
    renderPax();
  };

  $('btn-gallery').onclick = () => openScanPanel(null);
  $('scan-close').onclick = closeScanPanel;

  $('scan-gallery').onclick = () => $('scan-file').click();
  $('scan-file').addEventListener('change', e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) processGalleryFile(file);
  });

  $('scan-accept').onclick = () => applyFromConfirm();
  $('scan-retry').onclick = () => {
    setPanelVisible('scan-confirm', false);
    pendingParsed = null;
    setScanStatus('Escolha outra foto na Galeria.');
  };
  $('scan-parse-manual').onclick = applyManualMrz;

  $('btn-xlsx').onclick = () => {
    generateExcel(state, BiffPatchExport).catch(e => alert(e.message || e));
  };

  document.addEventListener('click', e => {
    const t = e.target;
    if (t.dataset.del) {
      state.pasajeros = state.pasajeros.filter(p => p.id !== t.dataset.del);
      saveState(state);
      renderPax();
    }
    if (t.dataset.rescan) openScanPanel(t.dataset.rescan);
    if (t.dataset.delCrew) {
      state.tripulacion = state.tripulacion.filter(c => c.id !== t.dataset.delCrew);
      saveState(state);
      renderCrew();
    }
  });

  document.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.pax) {
      state.pasajeros.forEach(p => {
        if (p.id === t.dataset.pax) p[t.dataset.field] = t.value;
      });
      saveState(state);
    }
    if (t.dataset.crew) {
      state.tripulacion.forEach(c => {
        if (c.id === t.dataset.crew) c[t.dataset.field] = t.value;
      });
      saveState(state);
    }
  });
}

export function initApp() {
  bindHeader();
  renderCrew();
  renderPax();
  bindEvents();
}

initApp();
