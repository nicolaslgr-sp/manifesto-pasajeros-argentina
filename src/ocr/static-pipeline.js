import { makeMrzBand, makeVizBand, detectMrzBandY, isTwoPagePhoto } from './preprocess.js';
import { ocrCanvas, ensureWorker } from './tesseract-client.js';
import {
  collectTd3Candidates, pickBestMrz, MRZ_CHARS,
  isMrzQualityOk, isGarbageMrz, isAutoApplyReady
} from '../mrz/parse.js';
import { parseVIZ, mergeMrzAndViz, buildResultFromViz, natLabel } from '../viz/parse-visual.js';
import { looksLikeName } from '../lib/dates.js';

/** Jobs MRZ no fundo — evita y>0.95 (borda/vazio) e VIZ no meio. */
const BOTTOM_MRZ_JOBS = [
  { y0: 0.86, y1: 0.98, mode: 'contrast', psms: ['6', '7', '13'], wide: true },
  { y0: 0.88, y1: 1.0, mode: 'sharp', psms: ['6', '7', '13'], wide: true },
  { y0: 0.90, y1: 1.0, mode: 'otsu', psms: ['6', '13'], wide: true },
  { y0: 0.85, y1: 0.97, mode: 'stretch_otsu', psms: ['7', '13'], wide: true },
  { y0: 0.87, y1: 0.99, mode: 'adaptive', psms: ['6', '7'], wide: true },
  { y0: 0.89, y1: 1.0, mode: 'invert', psms: ['6', '13'], wide: true }
];

const SINGLE_PAGE_MRZ_JOBS = [
  { y0: 0.78, y1: 0.99, mode: 'sharp', psms: ['6', '13'], wide: true },
  { y0: 0.75, y1: 0.96, mode: 'otsu', psms: ['6', '7'], wide: true },
  { y0: 0.80, y1: 1.0, mode: 'contrast', psms: ['6', '11'], wide: true },
  { y0: 0.82, y1: 0.98, mode: 'adaptive', psms: ['6'], wide: true }
];

/** Mobile / viewport estreito — cap de passes MRZ (mesma lógica de leitura). */
export function isConstrainedDevice() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
  if (typeof window !== 'undefined' && window.matchMedia) {
    try {
      if (window.matchMedia('(max-width: 900px)').matches) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

function looksLikeMrzText(text) {
  const u = String(text || '').toUpperCase().replace(/\s/g, '');
  if (u.length < 30) return false;
  const fillers = (u.match(/</g) || []).length;
  if (fillers >= 8 && (/P[<KCX]/.test(u) || /<<[A-Z]/.test(u))) return true;
  // Fragmentos de linha 2: doc+nat+birth+sex
  if (/[A-Z0-9]{7,9}.{0,3}[A-Z]{3}\d{6}[0-9][MF]/.test(u.replace(/</g, ''))) return true;
  return fillers >= 15;
}

function considerText(text, pool) {
  if (!text) return pool;
  if (looksLikeMrzText(text) || text.length > 60) {
    pool.push(...collectTd3Candidates(text));
  }
  return pool;
}

function buildMrzJobs(frame, twoPage, light) {
  const jobs = [];
  const detected = detectMrzBandY(frame);
  if (detected) {
    // Nunca começar abaixo de 0.85; nunca só a última fatia da borda
    let y0 = Math.min(0.92, Math.max(twoPage ? 0.85 : 0.75, detected.y0));
    let y1 = Math.min(1, Math.max(detected.y1, y0 + 0.08));
    if (y0 > 0.93) y0 = 0.88;
    jobs.push(
      { y0, y1, mode: 'contrast', psms: ['6', '7', '13'], wide: true, detected: true },
      { y0, y1, mode: 'sharp', psms: ['6', '13'], wide: true, detected: true },
      { y0, y1, mode: 'otsu', psms: ['6', '7'], wide: true, detected: true }
    );
  }
  if (twoPage) jobs.push(...BOTTOM_MRZ_JOBS);
  else {
    jobs.push(...SINGLE_PAGE_MRZ_JOBS);
    jobs.push(...BOTTOM_MRZ_JOBS.slice(0, 3));
  }
  if (light) {
    // Prioriza detecção + primeiros fundos; corta o restante
    return jobs.slice(0, Math.min(jobs.length, 4));
  }
  return jobs;
}

async function runMrzJobs(frame, jobs, pool, onStatus, dumps, maxPasses = Infinity) {
  let pass = 0;
  const totalPsms = Math.min(
    maxPasses,
    jobs.reduce((n, j) => n + j.psms.length, 0)
  );

  for (let ji = 0; ji < jobs.length; ji++) {
    const job = jobs[ji];
    const best = pickBestMrz(pool);
    if (best?.docCheckOk && best?.birthCheckOk && best?.compositeOk && looksLikeName(best.apellidoNombre)) {
      return best;
    }
    if (best?.score >= 82 && best.docCheckOk && best.birthCheckOk && best.compositeOk) {
      return best;
    }

    for (const psm of job.psms) {
      if (pass >= maxPasses) return pickBestMrz(pool);
      pass++;
      const tag = job.detected ? 'auto' : job.mode;
      onStatus?.(`Lendo MRZ (${pass}/${totalPsms}, ${tag}, y=${job.y0.toFixed(2)})…`);
      const band = makeMrzBand(frame, job.y0, job.y1, job.mode, job.wide);
      const text = await ocrCanvas(band, psm, MRZ_CHARS);
      if (dumps) dumps.push({ kind: 'mrz', y0: job.y0, mode: job.mode, psm, text: (text || '').slice(0, 200) });
      considerText(text, pool);
      const candidate = pickBestMrz(pool);
      if (candidate?.docCheckOk && candidate?.birthCheckOk && candidate?.compositeOk) {
        return candidate;
      }
    }
  }
  return pickBestMrz(pool);
}

async function readMrzFromStatic(frame, onStatus, twoPage, dumps, { light = false, maxPasses = Infinity } = {}) {
  await ensureWorker(onStatus);
  const jobs = buildMrzJobs(frame, twoPage, light);
  const pool = [];
  return runMrzJobs(frame, jobs, pool, onStatus, dumps, maxPasses);
}

async function readVizFromStatic(frame, onStatus, twoPage, dumps) {
  const vizChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789ÑñÁÉÍÓÚáéíóúÃÕãõÇç /.-:()';
  // 2 páginas: página de dados (evitar assinatura e borda inferior vazia)
  const crops = twoPage
    ? [
      { y0: 0.48, y1: 0.92, mode: 'contrast', psm: '4' },
      { y0: 0.50, y1: 0.90, mode: 'contrast', psm: '6' },
      { y0: 0.52, y1: 0.88, mode: 'otsu', psm: '6' },
      { y0: 0.55, y1: 0.78, mode: 'contrast', psm: '4' },
      { y0: 0.58, y1: 0.82, mode: 'sharp', psm: '6' },
      { y0: 0.62, y1: 0.86, mode: 'contrast', psm: '11' },
      { y0: 0.70, y1: 0.95, mode: 'contrast', psm: '6' }
    ]
    : [
      { y0: 0.02, y1: 0.82, mode: 'contrast', psm: '4' },
      { y0: 0.02, y1: 0.86, mode: 'otsu', psm: '6' },
      { y0: 0.05, y1: 0.80, mode: 'contrast', psm: '6' },
      { y0: 0.10, y1: 0.55, mode: 'sharp', psm: '4' }
    ];

  let bestText = '';
  const parts = [];
  for (let i = 0; i < crops.length; i++) {
    onStatus?.(`Lendo página impressa (${i + 1}/${crops.length})…`);
    const band = makeVizBand(frame, crops[i].y0, crops[i].y1, crops[i].mode);
    const text = await ocrCanvas(band, crops[i].psm, vizChars);
    if (dumps) dumps.push({ kind: 'viz', y0: crops[i].y0, mode: crops[i].mode, text: (text || '').slice(0, 400) });
    if (text && text.replace(/\s/g, '').length > 15) parts.push(text);
    if ((text || '').replace(/\s/g, '').length > bestText.replace(/\s/g, '').length) {
      bestText = text;
    }
  }
  // Concatenar todas as leituras — cada crop pode trazer um campo diferente
  const merged = parts.length ? parts.join('\n') : bestText;
  if (typeof window !== 'undefined' && window.__OCR_DEBUG) {
    console.log('VIZ_DEBUG', (merged || '').slice(0, 2500));
  }
  return merged || '';
}

function finalizeWithMrzViz(mrz, vizText, onStatus, dumps, options) {
  if (mrz && isGarbageMrz(mrz)) {
    onStatus?.('MRZ ilegível — usando página impressa…');
    mrz = null;
  }

  const fromVizPool = [];
  considerText(vizText, fromVizPool);
  const mrzFromViz = pickBestMrz(fromVizPool);
  if (mrzFromViz && isMrzQualityOk(mrzFromViz) && (!mrz || isGarbageMrz(mrz))) {
    mrz = mrzFromViz;
  }

  const viz = parseVIZ(vizText, mrz);

  if (mrz && isMrzQualityOk(mrz)) {
    onStatus?.(`MRZ OK: ${natLabel(mrz.nacionalidadCode, mrz.nacionalidad) || 'conferindo…'}. Cruzando com página…`);
    const vizWithMrz = parseVIZ(vizText, mrz);
    const merged = mergeMrzAndViz(mrz, vizWithMrz);
    if (merged) {
      onStatus?.(`Nacionalidad: ${natLabel(merged.nacionalidadCode, merged.nacionalidad) || 'confira no passaporte'}`);
    }
    if (options.debugDump) return { result: merged, dumps };
    return merged;
  }

  onStatus?.('Conferindo nome, data e passaporte na página impressa…');
  const vizResult = buildResultFromViz(viz);
  if (vizResult) {
    onStatus?.(`Lido da página: ${natLabel(vizResult.nacionalidadCode, vizResult.nacionalidad)}`);
    if (options.debugDump) return { result: vizResult, dumps };
    return vizResult;
  }

  if (mrz && !isGarbageMrz(mrz)) {
    const vizWithMrz = parseVIZ(vizText, mrz);
    const merged = mergeMrzAndViz(mrz, vizWithMrz);
    if (merged && !isGarbageMrz(merged)) {
      if (options.debugDump) return { result: merged, dumps };
      return merged;
    }
  }

  // Qualquer campo útil → UI de confirmação (nome / data / nat / doc)
  const vizPartial = buildResultFromViz(viz);
  if (vizPartial) {
    if (options.debugDump) return { result: vizPartial, dumps };
    return vizPartial;
  }

  if (options.debugDump) return { result: null, dumps };
  return null;
}

export async function readPassportFromStaticImage(frame, onStatus, options = {}) {
  const dumps = options.debugDump ? [] : null;
  onStatus?.('Analisando foto completa do passaporte…');
  const twoPage = isTwoPagePhoto(frame);
  if (twoPage) onStatus?.('Foto com 2 páginas — priorizando página de dados…');

  const constrained = options.forceMobilePipeline
    ?? (twoPage || isConstrainedDevice());

  await ensureWorker(onStatus);

  // Mobile / 2 páginas: VIZ primeiro → se 4 campos OK, retorna; senão MRZ leve
  if (constrained) {
    onStatus?.('Lendo página impressa primeiro (mais rápido no celular)…');
    const vizText = await readVizFromStatic(frame, onStatus, twoPage, dumps);

    const earlyPool = [];
    considerText(vizText, earlyPool);
    let mrzEarly = pickBestMrz(earlyPool);
    if (mrzEarly && isGarbageMrz(mrzEarly)) mrzEarly = null;

    const vizEarly = parseVIZ(vizText, mrzEarly && isMrzQualityOk(mrzEarly) ? mrzEarly : null);
    const vizResult = buildResultFromViz(vizEarly);
    if (vizResult && (isAutoApplyReady(vizResult) || (
      (vizResult.documento || '').length >= 5
      && vizResult.nacimiento
      && looksLikeName(vizResult.apellidoNombre)
      && vizResult.nacionalidadCode
    ))) {
      onStatus?.(`Lido da página: ${natLabel(vizResult.nacionalidadCode, vizResult.nacionalidad)}`);
      if (options.debugDump) return { result: vizResult, dumps };
      return vizResult;
    }

    onStatus?.('Complementando com faixa MRZ (modo rápido)…');
    const mrz = await readMrzFromStatic(frame, onStatus, twoPage, dumps, {
      light: true,
      maxPasses: 8
    });
    return finalizeWithMrzViz(mrz, vizText, onStatus, dumps, options);
  }

  // Desktop / página única: MRZ completo depois VIZ
  onStatus?.('Lendo faixa MRZ (pode levar ~1–2 min)…');
  const mrz = await readMrzFromStatic(frame, onStatus, twoPage, dumps);
  const vizText = await readVizFromStatic(frame, onStatus, twoPage, dumps);
  return finalizeWithMrzViz(mrz, vizText, onStatus, dumps, options);
}

export async function readMrzFromText(raw) {
  const list = collectTd3Candidates(raw);
  return list.length ? pickBestMrz(list) : null;
}
