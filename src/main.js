import {
  defaultState, loadState, saveState, uid, escapeHtml,
  GUIDE_NAME, PAX_MAX_TOTAL, NAT, crewCount, filledPax
} from './lib/constants.js';
import { toStoredNacimiento, isValidIsoDate, fmtDateBR } from './lib/dates.js';
import { isAutoApplyReady } from './mrz/parse.js';
import { natLabel } from './viz/parse-visual.js';
import { loadStaticImage } from './ocr/static-image-loader.js';
import { readPassportFromStaticImage, readMrzFromText } from './ocr/static-pipeline.js';
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

function openScanPanel(targetId = null) {
  scanTargetId = targetId;
  $('scan-panel').classList.remove('hidden');
  $('scan-confirm').classList.add('hidden');
  pendingParsed = null;
  setScanStatus('Toque em Galeria / Foto e escolha a foto completa da página do passaporte.');
}

function closeScanPanel() {
  $('scan-panel').classList.add('hidden');
  $('scan-confirm').classList.add('hidden');
  pendingParsed = null;
  setScanBusy(false);
}

function showConfirm(parsed) {
  pendingParsed = parsed;
  $('cf-nombre').textContent = parsed.apellidoNombre || '—';
  $('cf-nacim').value = isValidIsoDate(parsed.nacimiento) ? parsed.nacimiento : '';
  $('cf-nacio').textContent = natLabel(parsed.nacionalidadCode, parsed.nacionalidad) || '—';
  $('cf-doc').textContent = parsed.documento || '—';
  $('cf-raw').textContent = `${parsed.line1 || ''}\n${parsed.line2 || ''}`;
  const checks = [...(parsed.checks || [])];
  if (!parsed.nacimiento) checks.unshift('Fecha de nacimiento não veio completa — preencha acima.');
  $('cf-note').textContent = checks.join(' ');
  $('scan-confirm').classList.remove('hidden');
  setScanStatus(`Confira: ${natLabel(parsed.nacionalidadCode, parsed.nacionalidad) || 'nacionalidad'}`);
}

function applyParsed(parsed) {
  if (!parsed) return;
  const nac = toStoredNacimiento(parsed.nacimiento);
  const payload = {
    apellidoNombre: (parsed.apellidoNombre || '').toUpperCase(),
    nacimiento: nac,
    nacionalidad: NAT[parsed.nacionalidadCode] || parsed.nacionalidad || '',
    documento: (`PASAPORTE ${parsed.documento || ''}`).trim(),
    visa: 'sin'
  };
  if (scanTargetId) {
    const found = state.pasajeros.find(p => p.id === scanTargetId);
    if (found) {
      if (!nac && found.nacimiento) delete payload.nacimiento;
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

function finishScanResult(result) {
  if (!result) {
    setScanStatus('Não consegui ler com segurança. Tente outra foto com boa luz e página inteira.');
    return;
  }
  if (isAutoApplyReady(result)) {
    setScanStatus(`Leitura validada — ${natLabel(result.nacionalidadCode, result.nacionalidad)}. Adicionando…`);
    applyParsed(result);
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
    setScanStatus('Processando imagem fixa (pode levar ~15s)…');
    const result = await readPassportFromStaticImage(frame, setScanStatus);
    finishScanResult(result);
  } catch (e) {
    setScanStatus(e?.message || 'Falha ao ler a foto.');
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

  $('scan-accept').onclick = () => {
    if (pendingParsed) {
      pendingParsed.nacimiento = $('cf-nacim').value || pendingParsed.nacimiento;
      applyParsed(pendingParsed);
    }
  };
  $('scan-retry').onclick = () => {
    $('scan-confirm').classList.add('hidden');
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
